import mongoose from 'mongoose';
import Feedback from './models/Feedback';
import Customer from '../customer/models/Customer';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

const ALLOWED_TRANSITIONS = {
  NEW: ['READ', 'PROCESSING', 'REJECTED'],
  READ: ['PROCESSING', 'REJECTED'],
  PROCESSING: ['PROCESSED', 'REJECTED', 'NEED_CONTACT'],
  NEED_CONTACT: ['PROCESSING', 'REJECTED', 'PROCESSED'],
  PROCESSED: [],
  REJECTED: [],
};

export const createFeedback = async (data = {}, actor = null) => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Name is required');
  }
  if (!data.subject || typeof data.subject !== 'string' || data.subject.trim().length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Subject is required');
  }
  if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Message is required');
  }

  let customerId = null;
  if (actor && actor.id) {
    const customer = await Customer.findOne({ userId: actor.id });
    if (customer) customerId = customer._id;
  }

  const feedback = new Feedback({
    name: data.name.trim(),
    email: data.email ? data.email.trim() : null,
    phone: data.phone ? data.phone.trim() : null,
    subject: data.subject.trim(),
    message: data.message.trim(),
    category: data.category || 'GENERAL',
    customerId,
    status: 'NEW',
  });

  await feedback.save();
  return feedback;
};

export const listFeedback = async (query = {}, actor = {}) => {
  if (!['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Manager or Admin can view customer feedback');
  }

  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Feedback.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getFeedbackById = async (id, actor = {}) => {
  if (!['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Manager or Admin can view feedback detail');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid feedback ID');
  }

  const feedback = await Feedback.findById(id).lean();
  if (!feedback) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Feedback not found');
  }

  return feedback;
};

export const updateFeedbackStatus = async (id, data = {}, actor = {}) => {
  if (!['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Manager or Admin can process feedback');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid feedback ID');
  }

  const targetStatus = data.status;
  if (!targetStatus) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'target status is required');
  }

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Feedback not found');
  }

  const currentStatus = feedback.status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.INVALID_STATE_TRANSITION,
      `Invalid feedback status transition from ${currentStatus} to ${targetStatus}`
    );
  }

  feedback.status = targetStatus;
  feedback.processedBy = actor.id;
  feedback.processedAt = new Date();
  if (data.notes || data.processingNotes) {
    feedback.processingNotes = data.notes || data.processingNotes;
  }
  if (data.response || data.responseMessage) {
    feedback.responseMessage = data.response || data.responseMessage;
  }

  await feedback.save();
  return feedback;
};
