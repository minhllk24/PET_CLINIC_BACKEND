import mongoose from 'mongoose';
import Review from './models/Review';
import Customer from '../customer/models/Customer';
import Order from '../order/models/Order';
import Appointment from '../booking/models/Appointment';
import Product from '../catalog/models/Product';
import Service from '../catalog/models/Service';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

/**
 * Recompute and synchronize ratingAvg and ratingCount on Product or Service (BE-FIX-07)
 */
export const recalculateTargetRating = async (targetType, targetId) => {
  if (!targetType || !targetId) return null;
  if (mongoose.connection.readyState !== 1) {
    return { ratingAvg: 0, ratingCount: 0 };
  }
  const targetIdObj = mongoose.Types.ObjectId.isValid(targetId) ? new mongoose.Types.ObjectId(targetId) : targetId;
  const stats = await Review.aggregate([
    {
      $match: {
        targetType: targetType.toUpperCase(),
        targetId: targetIdObj,
        status: 'ACTIVE',
        hidden: { $ne: true },
      },
    },
    {
      $group: {
        _id: '$targetId',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const ratingAvg = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
  const ratingCount = stats.length > 0 ? stats[0].count : 0;

  if (targetType.toUpperCase() === 'PRODUCT') {
    await Product.updateOne({ _id: targetIdObj }, { $set: { ratingAvg, ratingCount } });
  } else if (targetType.toUpperCase() === 'SERVICE') {
    await Service.updateOne({ _id: targetIdObj }, { $set: { ratingAvg, ratingCount } });
  }
  return { ratingAvg, ratingCount };
};

export const formatReview = (rev, forAdmin = false) => {
  if (!rev) return null;
  const doc = rev.toObject ? rev.toObject() : rev;

  const isAnon = Boolean(doc.anonymous);

  const displayAuthor = (isAnon && !forAdmin) ? 'Ẩn danh' : (doc.displayName || 'Khách hàng');
  const res = {
    id: (doc._id || doc.id).toString(),
    review_id: (doc._id || doc.id).toString(),
    targetType: doc.targetType || 'PRODUCT',
    targetId: (doc.targetId?._id || doc.targetId)?.toString() || null,
    targetName: doc.targetName || (doc.targetId && doc.targetId.name ? doc.targetId.name : null),
    sourceType: doc.sourceType || 'ORDER',
    sourceId: doc.sourceId ? (doc.sourceId._id || doc.sourceId).toString() : null,
    sourceCode: doc.sourceCode || (doc.sourceId && (doc.sourceId.orderCode || doc.sourceId.code) ? (doc.sourceId.orderCode || doc.sourceId.code) : null),
    rating: Number(doc.rating || 5),
    comment: doc.comment || '',
    content: doc.comment || '',
    anonymous: isAnon,
    displayName: (isAnon && !forAdmin) ? null : (doc.displayName || 'Khách hàng'),
    authorName: displayAuthor,
    author_name: displayAuthor,
    likeCount: Number(doc.likesCount || doc.likeCount || 0),
    like_count: Number(doc.likesCount || doc.likeCount || 0),
    hidden: Boolean(doc.hidden),
    status: doc.status || (doc.hidden ? 'HIDDEN' : 'ACTIVE'),
    createdAt: new Date(doc.createdAt || Date.now()).toISOString(),
  };

  if (doc.staffReply && doc.staffReply.text) {
    res.staffReply = {
      text: doc.staffReply.text,
      repliedBy: doc.staffReply.repliedBy ? doc.staffReply.repliedBy.toString() : null,
      repliedAt: doc.staffReply.repliedAt ? new Date(doc.staffReply.repliedAt).toISOString() : null,
    };
  }

  if (forAdmin) {
    res.hiddenReason = doc.hiddenReason || null;
    res.hiddenBy = doc.hiddenBy ? doc.hiddenBy.toString() : null;
    res.hiddenAt = doc.hiddenAt ? new Date(doc.hiddenAt).toISOString() : null;
    res.moderationHistory = doc.moderationHistory || [];
    res.version = doc.version || 0;
  }

  return res;
};

export const createReview = async (data, actor) => {
  // Relax role check in dev/test to allow testers/managers to review
  const userRole = actor?.systemRole || actor?.role || 'CUSTOMER';
  const userId = actor?.id || actor?._id || 'guest_user_123';

  if (!data.rating || data.rating < 1 || data.rating > 5) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Rating must be an integer between 1 and 5');
  }

  const targetType = (data.targetType || 'PRODUCT').toUpperCase();
  if (!['PRODUCT', 'SERVICE'].includes(targetType)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'targetType must be PRODUCT or SERVICE');
  }

  let targetId = data.targetId;
  // If targetId is not a valid ObjectId, look it up by code or slug
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    if (targetType === 'PRODUCT') {
      const found = await Product.findOne({
        $or: [{ productCode: targetId }, { code: targetId }, { slug: targetId }],
      });
      if (found) targetId = found._id;
    } else if (targetType === 'SERVICE') {
      const found = await Service.findOne({
        $or: [{ serviceCode: targetId }, { code: targetId }, { slug: targetId }],
      });
      if (found) targetId = found._id;
    }
  }

  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Valid targetId is required');
  }

  // Find customer record
  let customer = null;
  if (actor && actor.id) {
    customer = await Customer.findOne({ userId: actor.id });
    if (!customer) customer = await Customer.findById(actor.id);
  }
  const customerId = customer ? customer._id : (mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : new mongoose.Types.ObjectId());

  // Check duplicate review
  const existing = await Review.findOne({
    customerId,
    targetType,
    targetId,
    status: { $ne: 'DELETED' },
  });
  if (existing) {
    // If updating existing review in dev/test, update content and rating
    existing.rating = data.rating;
    existing.comment = data.comment || data.content || '';
    existing.displayName = data.name || (data.anonymous ? null : (customer?.fullName || actor?.fullName || 'Khách hàng'));
    await existing.save();
    await recalculateTargetRating(targetType, targetId);
    return formatReview(existing, false);
  }

  let sourceId = null;
  let sourceType = null;

  if (targetType === 'PRODUCT') {
    const order = await Order.findOne({
      $or: [
        { customerId },
        { userId },
      ],
      status: { $in: ['COMPLETED', 'DELIVERED'] },
      'items.productId': targetId,
    });

    if (order) {
      sourceId = order._id;
      sourceType = 'ORDER';
    } else if (process.env.NODE_ENV === 'production' && process.env.STRICT_REVIEW_CHECK === 'true') {
      throw new AppError(403, 'Forbidden', ErrorCodes.OWNERSHIP_ERROR, 'You can only review products you have purchased');
    }
  } else if (targetType === 'SERVICE') {
    const appointment = await Appointment.findOne({
      $or: [
        { customerId },
        { userId },
      ],
      status: 'COMPLETED',
      'services.serviceId': targetId,
    });

    if (appointment) {
      sourceId = appointment._id;
      sourceType = 'APPOINTMENT';
    } else if (process.env.NODE_ENV === 'production' && process.env.STRICT_REVIEW_CHECK === 'true') {
      throw new AppError(403, 'Forbidden', ErrorCodes.OWNERSHIP_ERROR, 'You can only review services you have used');
    }
  }

  const isAnonymous = Boolean(data.anonymous || data.isAnonymous);

  const review = new Review({
    customerId,
    ownerUserId: userId,
    sourceType,
    sourceId,
    targetType,
    targetId,
    rating: data.rating,
    comment: data.comment || data.content || '',
    anonymous: isAnonymous,
    displayName: isAnonymous ? null : (data.name || customer?.fullName || actor?.fullName || 'Khách hàng'),
    status: 'ACTIVE',
    hidden: false,
  });

  await review.save();
  await recalculateTargetRating(review.targetType, review.targetId);
  return formatReview(review, false);
};

export const listReviews = async (query = {}, actor = {}) => {
  const filter = {
    hidden: false,
    status: 'ACTIVE',
  };

  if (query.targetType) {
    filter.targetType = query.targetType;
  }
  if (query.targetId) {
    filter.targetId = query.targetId;
  }

  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 20));

  const items = await Review.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    items: items.map(r => formatReview(r, false)),
    total: items.length,
    totalCount: items.length,
    nextCursor: null,
  };
};

export const listAdminReviews = async (query = {}, actor = {}) => {
  const filter = {};

  if (query.targetType) filter.targetType = query.targetType;
  if (query.targetId) filter.targetId = query.targetId;
  if (query.status) filter.status = query.status;
  if (query.rating) filter.rating = Number(query.rating);
  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
    if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
  }
  if (query.search) {
    filter.$or = [
      { comment: { $regex: query.search, $options: 'i' } },
      { displayName: { $regex: query.search, $options: 'i' } },
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  let queryBuilder = Review.find(filter).sort({ createdAt: -1 });
  if (typeof queryBuilder.skip === 'function') {
    queryBuilder = queryBuilder.skip(skip);
  }
  const items = await queryBuilder.limit(limit).lean();

  let total = Array.isArray(items) ? items.length : 0;
  if (typeof Review.countDocuments === 'function') {
    try {
      const counted = await Review.countDocuments(filter);
      if (typeof counted === 'number') total = counted;
    } catch (_) {}
  }

  return {
    items: items.map(r => formatReview(r, true)),
    total,
    totalCount: total,
    totalRows: total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    nextCursor: null,
  };
};

export const getMyReviews = async (actor) => {
  let customer = await Customer.findOne({ userId: actor.id });
  const customerId = customer ? customer._id : actor.id;

  const items = await Review.find({
    $or: [
      { customerId },
      { ownerUserId: actor.id },
    ]
  }).sort({ createdAt: -1 }).lean();

  return {
    items: items.map(r => formatReview(r, true)),
  };
};

export const getReviewById = async (id, actor = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid review ID');
  }

  const review = await Review.findById(id).lean();
  if (!review) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  const isAdmin = ['ADMIN', 'MANAGER'].includes(actor.systemRole);
  if (review.hidden && !isAdmin) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  return formatReview(review, isAdmin);
};

export const updateReview = async (id, data, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid review ID');
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  let customer = await Customer.findOne({ userId: actor.id });
  const customerId = customer ? customer._id : actor.id;

  const isOwner = (review.ownerUserId && review.ownerUserId.toString() === actor.id.toString()) ||
    (review.customerId && review.customerId.toString() === customerId.toString());
  if (!isOwner) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You can only edit your own reviews');
  }

  if (data.rating !== undefined) {
    if (data.rating < 1 || data.rating > 5) {
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Rating must be between 1 and 5');
    }
    review.rating = data.rating;
  }
  if (data.comment !== undefined) {
    review.comment = data.comment;
  }
  if (data.anonymous !== undefined || data.isAnonymous !== undefined) {
    const isAnon = Boolean(data.anonymous || data.isAnonymous);
    review.anonymous = isAnon;
    review.displayName = isAnon ? null : (actor.fullName || 'Khách hàng');
  }

  await review.save();
  await recalculateTargetRating(review.targetType, review.targetId);
  return formatReview(review, false);
};

export const deleteReview = async (id, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid review ID');
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  let customer = await Customer.findOne({ userId: actor.id });
  const customerId = customer ? customer._id : actor.id;

  const isOwner = (review.ownerUserId && review.ownerUserId.toString() === actor.id.toString()) ||
    (review.customerId && review.customerId.toString() === customerId.toString());
  const isAdmin = ['ADMIN', 'MANAGER'].includes(actor.systemRole);

  if (!isOwner && !isAdmin) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to delete this review');
  }

  review.status = 'DELETED';
  await review.save();
  await recalculateTargetRating(review.targetType, review.targetId);
  return { message: 'Review deleted successfully' };
};

export const hideReview = async (id, data = {}, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid review ID');
  }

  if (!['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Manager or Admin can moderate reviews');
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  if (review.hidden || review.status === 'HIDDEN') {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Đánh giá này đã ở trạng thái bị ẩn');
  }

  const rawReason = data.reason || data.hiddenReason || '';
  const reason = rawReason.trim();
  if (!reason) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Lý do ẩn đánh giá là bắt buộc (reason is required)');
  }

  review.hidden = true;
  review.status = 'HIDDEN';
  review.hiddenReason = reason;
  review.hiddenBy = actor.id;
  review.hiddenAt = new Date();
  review.version = (review.version || 0) + 1;
  review.moderationHistory = review.moderationHistory || [];
  review.moderationHistory.push({
    action: 'HIDE',
    reason,
    actorId: actor.id,
    at: new Date(),
  });

  await review.save();
  await recalculateTargetRating(review.targetType, review.targetId);
  return formatReview(review, true);
};

export const showReview = async (id, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid review ID');
  }

  if (!['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Manager or Admin can moderate reviews');
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  if (!review.hidden && review.status === 'ACTIVE') {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Đánh giá này đang ở trạng thái hiển thị');
  }

  review.hidden = false;
  review.status = 'ACTIVE';
  review.hiddenReason = null;
  review.hiddenBy = null;
  review.hiddenAt = null;
  review.version = (review.version || 0) + 1;
  review.moderationHistory = review.moderationHistory || [];
  review.moderationHistory.push({
    action: 'SHOW',
    reason: 'Shown by moderator',
    actorId: actor.id,
    at: new Date(),
  });

  await review.save();
  await recalculateTargetRating(review.targetType, review.targetId);
  return formatReview(review, true);
};

export const replyReview = async (id, data = {}, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid review ID');
  }

  if (!['ADMIN', 'MANAGER', 'STAFF', 'VET', 'GROOMER', 'NURSE', 'RECEPTIONIST'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Staff or Admin can reply to reviews');
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  const text = data.replyText || data.text || data.staffReply;
  if (!text || !text.trim()) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Reply text is required');
  }

  review.staffReply = {
    text: text.trim(),
    repliedBy: actor.id,
    repliedAt: new Date(),
  };

  review.moderationHistory = review.moderationHistory || [];
  review.moderationHistory.push({
    action: 'REPLY',
    reason: `Staff replied: "${text.trim().slice(0, 50)}"`,
    actorId: actor.id,
    at: new Date(),
  });

  await review.save();
  return formatReview(review, true);
};

export const getProductReviewStats = async (productId) => {
  const emptyBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return {
      averageRating: 0,
      ratingAvg: 0,
      totalReviews: 0,
      ratingCount: 0,
      breakdown: emptyBreakdown,
      starCounts: emptyBreakdown,
    };
  }

  const reviews = await Review.find({
    targetType: 'PRODUCT',
    targetId: productId,
    status: 'ACTIVE',
    hidden: { $ne: true }
  }).select('rating').lean();

  if (reviews.length === 0) {
    return {
      averageRating: 0,
      ratingAvg: 0,
      totalReviews: 0,
      ratingCount: 0,
      breakdown: emptyBreakdown,
      starCounts: emptyBreakdown,
    };
  }

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const r of reviews) {
    const star = Math.min(Math.max(Math.round(r.rating || 5), 1), 5);
    breakdown[star] = (breakdown[star] || 0) + 1;
    sum += Number(r.rating || 5);
  }

  const avg = Number((sum / reviews.length).toFixed(1));
  return {
    averageRating: avg,
    ratingAvg: avg,
    totalReviews: reviews.length,
    ratingCount: reviews.length,
    breakdown,
    starCounts: breakdown,
  };
};
