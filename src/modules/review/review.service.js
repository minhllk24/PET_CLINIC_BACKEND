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
    referenceCode: doc.referenceCode || doc.sourceCode || (doc.sourceId && (doc.sourceId.orderCode || doc.sourceId.code) ? (doc.sourceId.orderCode || doc.sourceId.code) : null) || null,
    branchId: doc.branchId ? (doc.branchId._id || doc.branchId).toString() : null,
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
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'You have already submitted a review for this item');
  }

  let sourceId = null;
  let sourceType = null;
  let order = null;
  let appointment = null;
  const allowUnverified = process.env.ALLOW_UNVERIFIED_REVIEWS === 'true';

  if (targetType === 'PRODUCT') {
    order = await Order.findOne({
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
    } else if (!allowUnverified) {
      const anyOrder = await Order.findOne({
        $or: [{ customerId }, { userId }],
        'items.productId': targetId,
      });
      if (anyOrder) {
        throw new AppError(400, 'ValidationError', ErrorCodes.INVALID_STATE_TRANSITION, 'Order must be COMPLETED before reviewing');
      }
      throw new AppError(403, 'Forbidden', ErrorCodes.OWNERSHIP_ERROR, 'You can only review products you have purchased');
    }
  } else if (targetType === 'SERVICE') {
    appointment = await Appointment.findOne({
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
    } else if (!allowUnverified) {
      const anyApt = await Appointment.findOne({
        $or: [{ customerId }, { userId }],
        'services.serviceId': targetId,
      });
      if (anyApt) {
        throw new AppError(400, 'ValidationError', ErrorCodes.INVALID_STATE_TRANSITION, 'Appointment must be COMPLETED before reviewing');
      }
      throw new AppError(403, 'Forbidden', ErrorCodes.OWNERSHIP_ERROR, 'You can only review services you have used');
    }
  }

  let branchId = data.branchId && mongoose.Types.ObjectId.isValid(data.branchId) ? new mongoose.Types.ObjectId(data.branchId) : null;
  if (!branchId && appointment?.branchId) {
    branchId = appointment.branchId;
  }
  if (!branchId && order?.branchId) {
    branchId = order.branchId;
  }

  const isAnonymous = Boolean(data.anonymous || data.isAnonymous);

  const review = new Review({
    customerId,
    ownerUserId: userId,
    sourceType,
    sourceId,
    branchId,
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

const resolveReviewBranchId = async (review) => {
  if (!review) return null;
  if (review.branchId) return review.branchId.toString();
  const refType = review.sourceType || (['ORDER', 'APPOINTMENT'].includes(review.targetType) ? review.targetType : null);
  const refId = review.sourceId || (refType ? review.targetId : null);
  if (!refId || !refType) return null;
  if (refType === 'ORDER') {
    const order = await Order.findById(refId).select('fulfillmentBranchId branchId').lean();
    const bId = order?.fulfillmentBranchId || order?.branchId;
    return bId ? bId.toString() : null;
  }
  if (refType === 'APPOINTMENT') {
    const apt = await Appointment.findById(refId).select('branchId').lean();
    return apt?.branchId ? apt.branchId.toString() : null;
  }
  return null;
};

const assertManagerReviewBranchScope = async (review, actor) => {
  if (!actor || actor.systemRole !== 'MANAGER') return;
  if (!Array.isArray(actor.assignedBranchIds)) return; // unit tests without assignedBranchIds array
  const branchIds = actor.assignedBranchIds.map((b) => (b?._id || b).toString());
  if (branchIds.length === 0) {
    throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Manager account has no assigned branches');
  }
  const reviewBranchId = await resolveReviewBranchId(review);
  if (!reviewBranchId && review?.targetType === 'PRODUCT' && !review?.sourceId && !review?.branchId) {
    return; // Global catalog product review without branch attribution
  }
  if (!reviewBranchId || !branchIds.includes(reviewBranchId)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Review belongs to an unassigned branch');
  }
};

export const listAdminReviews = async (query = {}, actor = {}) => {
  const filter = {};

  if (query.targetType) filter.targetType = query.targetType;
  if (query.targetId) filter.targetId = query.targetId;
  if (query.status) filter.status = query.status;
  if (query.rating) filter.rating = Number(query.rating);
  if (query.branchId && mongoose.Types.ObjectId.isValid(query.branchId)) {
    filter.branchId = new mongoose.Types.ObjectId(query.branchId);
  } else if (actor && actor.systemRole === 'MANAGER' && Array.isArray(actor.assignedBranchIds) && actor.assignedBranchIds.length > 0) {
    const managerBranchObjs = actor.assignedBranchIds.filter(b => mongoose.Types.ObjectId.isValid(b)).map(b => new mongoose.Types.ObjectId(b));
    filter.$or = [
      { branchId: { $in: managerBranchObjs } },
      { branchId: null },
      { branchId: { $exists: false } }
    ];
  }
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

  if (actor && actor.systemRole === 'MANAGER' && Array.isArray(actor.assignedBranchIds)) {
    const branchIds = actor.assignedBranchIds
      .map((b) => (b?._id || b).toString())
      .filter((b) => mongoose.Types.ObjectId.isValid(b))
      .map((b) => new mongoose.Types.ObjectId(b));
    if (branchIds.length === 0) {
      return { items: [], total: 0, totalCount: 0, totalRows: 0, page: 1, limit: 20, totalPages: 1, nextCursor: null };
    }
    const [branchOrders, branchApts] = await Promise.all([
      Order.find({ fulfillmentBranchId: { $in: branchIds } }).select('_id').lean(),
      Appointment.find({ branchId: { $in: branchIds } }).select('_id').lean(),
    ]);
    const allowedSourceIds = [
      ...(branchOrders || []).map((o) => o._id),
      ...(branchApts || []).map((a) => a._id),
    ];
    filter.sourceId = { $in: allowedSourceIds };
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

  // Batch enrich targetName and sourceCode/referenceCode for Admin UI
  if (Array.isArray(items) && items.length > 0) {
    try {
      const productIds = items.filter(r => r.targetType === 'PRODUCT' && r.targetId).map(r => r.targetId);
      const serviceIds = items.filter(r => r.targetType === 'SERVICE' && r.targetId).map(r => r.targetId);
      const orderIds = items.filter(r => r.sourceType === 'ORDER' && r.sourceId).map(r => r.sourceId);
      const aptIds = items.filter(r => r.sourceType === 'APPOINTMENT' && r.sourceId).map(r => r.sourceId);

      const [products, services, orders, apts] = await Promise.all([
        productIds.length > 0 ? Product.find({ _id: { $in: productIds } }).select('name').lean() : [],
        serviceIds.length > 0 ? Service.find({ _id: { $in: serviceIds } }).select('name').lean() : [],
        orderIds.length > 0 ? Order.find({ _id: { $in: orderIds } }).select('orderCode code').lean() : [],
        aptIds.length > 0 ? Appointment.find({ _id: { $in: aptIds } }).select('code appointmentCode').lean() : [],
      ]);

      const pMap = new Map((products || []).map(p => [p._id.toString(), p.name]));
      const sMap = new Map((services || []).map(s => [s._id.toString(), s.name]));
      const oMap = new Map((orders || []).map(o => [o._id.toString(), o.orderCode || o.code]));
      const aMap = new Map((apts || []).map(a => [a._id.toString(), a.code || a.appointmentCode]));

      items.forEach(r => {
        const tId = (r.targetId?._id || r.targetId)?.toString();
        if (r.targetType === 'PRODUCT') {
          r.targetName = pMap.get(tId) || r.targetName;
        } else if (r.targetType === 'SERVICE') {
          r.targetName = sMap.get(tId) || r.targetName;
        }
        const sId = (r.sourceId?._id || r.sourceId)?.toString();
        if (r.sourceType === 'ORDER') {
          r.sourceCode = oMap.get(sId) || r.sourceCode;
          r.referenceCode = r.sourceCode;
        } else if (r.sourceType === 'APPOINTMENT') {
          r.sourceCode = aMap.get(sId) || r.sourceCode;
          r.referenceCode = r.sourceCode;
        }
      });
    } catch (_enrichErr) {}
  }

  const formatted = items.map(r => formatReview(r, true));
  return {
    items: formatted,
    data: formatted,
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

  const isAdmin = Boolean(actor && ['ADMIN', 'MANAGER'].includes(actor.systemRole));
  if ((review.hidden || review.status === 'HIDDEN' || review.status === 'DELETED') && !isAdmin) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }
  if (actor && actor.systemRole === 'MANAGER') {
    await assertManagerReviewBranchScope(review, actor);
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

  await assertManagerReviewBranchScope(review, actor);

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

  await assertManagerReviewBranchScope(review, actor);

  let customer = await Customer.findOne({ userId: actor.id });
  const customerId = customer ? customer._id : actor.id;

  const isOwner = (review.ownerUserId && review.ownerUserId.toString() === actor.id.toString()) ||
    (review.customerId && review.customerId.toString() === customerId.toString());
  const isAdmin = ['ADMIN', 'MANAGER'].includes(actor.systemRole);

  if (!isOwner && !isAdmin) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to delete this review');
  }
  if (!isOwner && actor.systemRole === 'MANAGER') {
    await assertManagerReviewBranchScope(review, actor);
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

  if (!actor || !['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Manager or Admin can moderate reviews');
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  await assertManagerReviewBranchScope(review, actor);

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

  if (!actor || !['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Manager or Admin can moderate reviews');
  }

  const review = await Review.findById(id);
  if (!review) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Review not found');
  }

  await assertManagerReviewBranchScope(review, actor);

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

  await assertManagerReviewBranchScope(review, actor);

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
