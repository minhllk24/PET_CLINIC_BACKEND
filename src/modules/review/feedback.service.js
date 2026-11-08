import mongoose from 'mongoose';
import Feedback from './models/Feedback';
import Customer from '../customer/models/Customer';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { sendFeedbackReplyEmail } from '../../shared/emailOutbox.service';

const ALLOWED_TRANSITIONS = {
  NEW: ['READ', 'PROCESSING', 'REJECTED'],
  READ: ['PROCESSING', 'REJECTED'],
  PROCESSING: ['PROCESSED', 'REJECTED', 'NEED_CONTACT'],
  NEED_CONTACT: ['PROCESSING', 'REJECTED', 'PROCESSED'],
  PROCESSED: [],
  REJECTED: [],
};

export const getAllowedActions = (status, doc = null) => {
  const canResolve = Boolean(
    doc?.replyDelivery?.deliveryStatus === 'SENT' && doc?.replyDelivery?.providerMessageId
  );
  switch (status) {
    case 'NEW':
      return ['MARK_READ', 'START_PROCESSING', 'REPLY', 'REJECT'];
    case 'READ':
      return ['START_PROCESSING', 'REPLY', 'REJECT'];
    case 'PROCESSING':
      return canResolve
        ? ['RESOLVE', 'NEED_CONTACT', 'REPLY', 'REJECT']
        : ['NEED_CONTACT', 'REPLY', 'REJECT'];
    case 'NEED_CONTACT':
      return canResolve
        ? ['START_PROCESSING', 'RESOLVE', 'REPLY', 'REJECT']
        : ['START_PROCESSING', 'REPLY', 'REJECT'];
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
    allowedActions: getAllowedActions(raw.status, raw),
  };
};

export const createFeedback = async (data = {}, actor = null) => {
  const rawMessage = data.message ?? data.content ?? data.body ?? data.note ?? '';
  if (!rawMessage || typeof rawMessage !== 'string' || rawMessage.trim().length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Message is required');
  }

  const rawName = data.name ?? data.fullName ?? data.customerName ?? '';
  const name = (typeof rawName === 'string' && rawName.trim().length > 0) ? rawName.trim() : 'Khách hàng';

  const rawSubject = data.subject ?? data.title ?? '';
  const subject = (typeof rawSubject === 'string' && rawSubject.trim().length > 0) ? rawSubject.trim() : 'Liên hệ từ khách hàng';

  let normalizedGender = null;
  if (data.gender && typeof data.gender === 'string') {
    const g = data.gender.trim().toLowerCase();
    if (g === 'male' || g === 'nam') normalizedGender = 'male';
    else if (g === 'female' || g === 'nữ' || g === 'nu') normalizedGender = 'female';
    else if (g === 'other' || g === 'khác' || g === 'khac') normalizedGender = 'other';
  }

  let customerId = null;
  if (actor && actor.id) {
    const customer = await Customer.findOne({ userId: actor.id });
    if (customer) customerId = customer._id;
  }

  const feedback = new Feedback({
    name,
    email: data.email ? String(data.email).trim() : null,
    phone: data.phone ? String(data.phone).trim() : null,
    gender: normalizedGender,
    sourceCode: data.sourceCode || 'CONTACT_FORM',
    subject,
    message: rawMessage.trim(),
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
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Feedback.countDocuments(filter),
  ]);

  return {
    items: items.map(formatFeedback),
    total,
    totalCount: total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    nextCursor: skip + items.length < total ? String(page + 1) : null,
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

  // BE-FIX-04 Strict Guard: Do NOT allow transitioning to PROCESSED unless reply email was actually SENT
  if (targetStatus === 'PROCESSED') {
    const isEmailSent =
      feedback.replyDelivery?.deliveryStatus === 'SENT' &&
      Boolean(feedback.replyDelivery?.providerMessageId);
    if (!isEmailSent) {
      throw new AppError(
        409,
        'Conflict',
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Không thể chuyển trực tiếp sang PROCESSED khi email phản hồi chưa được gửi thành công (deliveryStatus phải là SENT)'
      );
    }
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

  // Send email through real EmailOutbox service
  const recipientEmail = feedback.email || feedback.customerEmail || data.toEmail;
  const emailResult = await sendFeedbackReplyEmail({
    to: recipientEmail,
    subject,
    message: message.trim(),
    feedbackId: feedback._id,
    actorId: actor.id,
    idempotencyKey: data.idempotencyKey,
    forceFail: process.env.NODE_ENV === 'test' && Boolean(data.simulateEmailFailure),
  });

  feedback.responseMessage = message.trim();

  if (emailResult.success) {
    feedback.replyDelivery = {
      subject,
      message: message.trim(),
      deliveryStatus: 'SENT',
      sentAt: now,
      sentBy: actor.id,
      providerMessageId: emailResult.providerMessageId,
      outboxId: emailResult.outbox?._id,
      errorMessage: null,
    };

    const nextStatus = data.status || (['NEW', 'READ', 'PROCESSING'].includes(feedback.status) ? 'PROCESSED' : feedback.status);
    feedback.status = nextStatus;
    feedback.processedBy = actor.id;
    feedback.processedAt = now;

    feedback.statusHistory = feedback.statusHistory || [];
    feedback.statusHistory.push({
      status: nextStatus,
      notes: `Sent email reply: "${subject}" (MessageId: ${emailResult.providerMessageId})`,
      actorId: actor.id,
      at: now,
    });
  } else {
    // Delivery failed: BE-FIX-04 requires deliveryStatus=FAILED and status keeps PROCESSING (no false success)
    feedback.replyDelivery = {
      subject,
      message: message.trim(),
      deliveryStatus: 'FAILED',
      failedAt: now,
      sentBy: actor.id,
      providerMessageId: null,
      errorMessage: emailResult.error || 'Email sending failed',
      outboxId: emailResult.outbox?._id,
    };

    // Keep status as PROCESSING
    feedback.status = 'PROCESSING';
    feedback.processedBy = actor.id;

    feedback.statusHistory = feedback.statusHistory || [];
    feedback.statusHistory.push({
      status: 'PROCESSING',
      notes: `Failed to deliver email reply: ${emailResult.error || 'Unknown error'}`,
      actorId: actor.id,
      at: now,
    });
  }

  await feedback.save();
  return formatFeedback(feedback);
};
