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

export const getAllowedActions = (status) => {
  switch (status) {
    case 'NEW':
      return ['MARK_READ', 'START_PROCESSING', 'REPLY', 'REJECT'];
    case 'READ':
      return ['START_PROCESSING', 'REPLY', 'REJECT'];
    case 'PROCESSING':
      return ['RESOLVE', 'NEED_CONTACT', 'REPLY', 'REJECT'];
    case 'NEED_CONTACT':
      return ['START_PROCESSING', 'RESOLVE', 'REPLY', 'REJECT'];
    case 'PROCESSED':
    case 'REJECTED':
    default:
      return [];
  }
};

export const formatFeedback = (doc) => {
  if (!doc) return null;
  const raw = doc.toObject ? doc.toObject() : doc;
  return {
    ...raw,
    id: (raw._id || raw.id).toString(),
    allowedActions: getAllowedActions(raw.status),
  };
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
    gender: data.gender || null,
    sourceCode: data.sourceCode || 'CONTACT_FORM',
    subject: data.subject.trim(),
    message: data.message.trim(),
    category: data.category || 'GENERAL',
    customerId,
    status: 'NEW',
    statusHistory: [{
      status: 'NEW',
      notes: 'Customer submitted feedback',
      at: new Date(),
    }],
  });

  await feedback.save();
  return formatFeedback(feedback);
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
    items: items.map(formatFeedback),
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

  return formatFeedback(feedback);
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

  feedback.statusHistory = feedback.statusHistory || [];
  feedback.statusHistory.push({
    status: targetStatus,
    notes: data.notes || data.processingNotes || null,
    reason: data.reason || null,
    actorId: actor.id,
    at: new Date(),
  });

  await feedback.save();
  return formatFeedback(feedback);
};

export const replyFeedback = async (id, data = {}, actor = {}) => {
  if (!['ADMIN', 'MANAGER'].includes(actor.systemRole)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Manager or Admin can reply to customer feedback');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid feedback ID');
  }

  const feedback = await Feedback.findById(id);
  if (!feedback) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Feedback not found');
  }

  const message = data.message || data.responseMessage || data.replyText;
  if (!message || !message.trim()) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Reply message is required');
  }

  const subject = data.subject || `[Dr.Pet Clinic] Phản hồi yêu cầu: ${feedback.subject}`;
  const now = new Date();

  feedback.responseMessage = message.trim();
  feedback.replyDelivery = {
    subject,
    message: message.trim(),
    deliveryStatus: 'SENT',
    sentAt: now,
    sentBy: actor.id,
    providerMessageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  };

  // If status is not completed, auto transition to PROCESSED or targetStatus
  const nextStatus = data.status || (['NEW', 'READ', 'PROCESSING'].includes(feedback.status) ? 'PROCESSED' : feedback.status);
  feedback.status = nextStatus;
  feedback.processedBy = actor.id;
  feedback.processedAt = now;

  feedback.statusHistory = feedback.statusHistory || [];
  feedback.statusHistory.push({
    status: nextStatus,
    notes: `Sent email reply: "${subject}"`,
    actorId: actor.id,
    at: now,
  });

  await feedback.save();
  return formatFeedback(feedback);
};
