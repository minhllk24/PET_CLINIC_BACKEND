import mongoose from 'mongoose';
import Review from './models/Review';
import Customer from '../customer/models/Customer';
import Order from '../order/models/Order';
import Appointment from '../booking/models/Appointment';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

export const formatReview = (rev, forAdmin = false) => {
  if (!rev) return null;
  const doc = rev.toObject ? rev.toObject() : rev;

  const isAnon = Boolean(doc.anonymous);

  const res = {
    id: (doc._id || doc.id).toString(),
    targetType: doc.targetType || 'PRODUCT',
    targetId: (doc.targetId?._id || doc.targetId).toString(),
    rating: Number(doc.rating || 5),
    comment: doc.comment || '',
    anonymous: isAnon,
    displayName: (isAnon && !forAdmin) ? null : (doc.displayName || 'Khách hàng'),
    hidden: Boolean(doc.hidden),
    createdAt: new Date(doc.createdAt || Date.now()).toISOString(),
  };

  return res;
};

export const createReview = async (data, actor) => {
  if (!actor || actor.systemRole !== 'CUSTOMER') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Customers can submit reviews');
  }

  if (!data.rating || data.rating < 1 || data.rating > 5) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Rating must be an integer between 1 and 5');
  }

  if (!data.targetType || !['PRODUCT', 'SERVICE'].includes(data.targetType)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'targetType must be PRODUCT or SERVICE');
  }

  if (!data.targetId || !mongoose.Types.ObjectId.isValid(data.targetId)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Valid targetId is required');
  }

  // Find customer record
  let customer = await Customer.findOne({ userId: actor.id });
  if (!customer) {
    customer = await Customer.findById(actor.id);
  }
  const customerId = customer ? customer._id : new mongoose.Types.ObjectId(actor.id);

  // Check duplicate review
  const existing = await Review.findOne({
    customerId,
    targetType: data.targetType,
    targetId: data.targetId,
    status: { $ne: 'DELETED' },
  });
  if (existing) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'You have already submitted a review for this item');
  }

  let sourceId = null;
  let sourceType = null;

  if (data.targetType === 'PRODUCT') {
    // Verify customer has a COMPLETED order containing this product
    const order = await Order.findOne({
      $or: [
        { customerId },
        { userId: actor.id },
      ],
      status: { $in: ['COMPLETED', 'DELIVERED'] },
      'items.productId': data.targetId,
    });

    if (!order) {
      // Check if there is an uncompleted order or no order
      const anyOrder = await Order.findOne({
        $or: [{ customerId }, { userId: actor.id }],
        'items.productId': data.targetId,
      });
      if (anyOrder) {
        throw new AppError(400, 'ValidationError', ErrorCodes.INVALID_STATE_TRANSITION, 'Order must be COMPLETED before reviewing');
      }
      throw new AppError(403, 'Forbidden', ErrorCodes.OWNERSHIP_ERROR, 'You can only review products you have purchased');
    }
    sourceId = order._id;
    sourceType = 'ORDER';
  } else if (data.targetType === 'SERVICE') {
    // Verify customer has a COMPLETED appointment containing this service
    const appointment = await Appointment.findOne({
      $or: [
        { customerId },
        { userId: actor.id },
      ],
      status: 'COMPLETED',
      'services.serviceId': data.targetId,
    });

    if (!appointment) {
      const anyApt = await Appointment.findOne({
        $or: [{ customerId }, { userId: actor.id }],
        'services.serviceId': data.targetId,
      });
      if (anyApt) {
        throw new AppError(400, 'ValidationError', ErrorCodes.INVALID_STATE_TRANSITION, 'Appointment must be COMPLETED before reviewing');
      }
      throw new AppError(403, 'Forbidden', ErrorCodes.OWNERSHIP_ERROR, 'You can only review services you have used');
    }
    sourceId = appointment._id;
    sourceType = 'APPOINTMENT';
  }

  const isAnonymous = Boolean(data.anonymous || data.isAnonymous);

  const review = new Review({
    customerId,
    ownerUserId: actor.id,
    sourceType,
    sourceId,
    targetType: data.targetType,
    targetId: data.targetId,
    rating: data.rating,
    comment: data.comment || '',
    anonymous: isAnonymous,
    displayName: isAnonymous ? null : (customer?.fullName || actor.fullName || 'Khách hàng'),
    status: 'ACTIVE',
    hidden: false,
  });

  await review.save();
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

  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  const items = await Review.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    items: items.map(r => formatReview(r, false)),
    nextCursor: null,
  };
};

export const listAdminReviews = async (query = {}, actor = {}) => {
  const filter = {};

  if (query.targetType) filter.targetType = query.targetType;
  if (query.targetId) filter.targetId = query.targetId;
  if (query.status) filter.status = query.status;

  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  const items = await Review.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return {
    items: items.map(r => formatReview(r, true)),
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

  review.hidden = true;
  review.status = 'HIDDEN';
  review.hiddenReason = data.reason || 'Hidden by moderator';
  review.hiddenBy = actor.id;
  review.hiddenAt = new Date();

  await review.save();
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

  review.hidden = false;
  review.status = 'ACTIVE';
  review.hiddenReason = null;
  review.hiddenBy = null;
  review.hiddenAt = null;

  await review.save();
  return formatReview(review, true);
};
