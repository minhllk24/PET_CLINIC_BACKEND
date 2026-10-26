import mongoose from 'mongoose';
import BookingRefund from '../payment/models/BookingRefund';
import Payment from '../payment/models/Payment';
import Appointment from './models/Appointment';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

export const formatBookingRefund = (refund) => {
  if (!refund) return null;
  const doc = refund.toObject ? refund.toObject() : refund;

  return {
    id: doc._id ? doc._id.toString() : (doc.id || ''),
    paymentId: (doc.paymentId?._id || doc.paymentId || '').toString(),
    appointmentId: (doc.appointmentId?._id || doc.appointmentId || '').toString(),
    amount: Number(doc.amount || 0),
    rule: doc.rule || 'CUSTOMER_EARLY_FULL',
    status: doc.status || 'REQUESTED',
    history: (doc.history || []).map((h) => ({
      status: h.status,
      actorId: h.actorId ? h.actorId.toString() : null,
      note: h.note || '',
      timestamp: h.timestamp ? new Date(h.timestamp).toISOString() : new Date().toISOString(),
    })),
  };
};

/**
 * Customer / Guest requests refund for a cancelled/no-show appointment
 */
export const requestRefund = async (data, actor, guestToken) => {
  const { appointmentId, reason } = data;
  if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Valid appointmentId is required');
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Appointment not found');
  }

  // Ownership check
  if (actor && actor.systemRole === 'CUSTOMER') {
    if (appointment.customerId && appointment.customerId.toString() !== actor.id.toString()) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not own this appointment');
    }
  }

  // Must be in CANCELLED or NO_SHOW status
  if (!['CANCELLED', 'NO_SHOW'].includes(appointment.status)) {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'Appointment must be CANCELLED or NO_SHOW to request refund');
  }

  // Find prepayment/payment
  const payment = await Payment.findOne({
    'target.id': appointment._id,
    status: { $in: ['PAID', 'PENDING'] },
  });

  if (!payment || !payment.paidAmount || payment.paidAmount <= 0) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.BUSINESS_RULE_VIOLATION, 'No refundable prepayment found for this appointment');
  }

  // Check existing active or terminal refund
  const existingActive = await BookingRefund.findOne({
    paymentId: payment._id,
    status: { $in: ['REQUESTED', 'PROCESSING', 'APPROVED', 'REFUNDED'] },
  });
  if (existingActive) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'A refund request already exists for this payment');
  }

  // Calculate refund amount based on cancellation policy
  let rule = 'CUSTOMER_EARLY_FULL';
  let refundableAmount = payment.paidAmount;

  if (appointment.cancellationReason === 'SYSTEM_TIMEOUT' || appointment.cancellationReason === 'STORE_CANCEL') {
    rule = 'SYSTEM_FULL';
    refundableAmount = payment.paidAmount;
  } else if (appointment.status === 'NO_SHOW' || (appointment.scheduledStart && (new Date(appointment.scheduledStart) - new Date()) < 24 * 3600000)) {
    rule = 'CUSTOMER_LATE_RETAIN_30';
    const finalAmount = appointment.pricing?.finalAmount || payment.paidAmount;
    const retainedAmount = Math.round(finalAmount * 0.3);
    refundableAmount = Math.max(0, payment.paidAmount - retainedAmount);
  }

  if (refundableAmount <= 0) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.BUSINESS_RULE_VIOLATION, 'Refundable amount after retention is zero; no refund issued');
  }

  const refund = new BookingRefund({
    paymentId: payment._id,
    appointmentId: appointment._id,
    amount: refundableAmount,
    rule,
    reason: reason || '',
    status: 'REQUESTED',
    history: [{
      status: 'REQUESTED',
      actorId: actor?.id || null,
      note: reason || 'Customer refund requested',
      timestamp: new Date(),
    }],
  });
  await refund.save();

  return formatBookingRefund(refund);
};

/**
 * List booking refunds with filtering and branch scoping
 */
export const listRefunds = async (query = {}, actor = null) => {
  const { status, limit = 20, cursor } = query;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (actor && actor.systemRole === 'CUSTOMER') {
    // Only own appointments
    const ownApts = await Appointment.find({ customerId: actor.id }).select('_id');
    filter.appointmentId = { $in: ownApts.map((a) => a._id) };
  } else if (actor && actor.systemRole === 'STAFF' && actor.authorizedBranchIds?.length > 0) {
    // Scoped by authorized branches
    const branchApts = await Appointment.find({ branchId: { $in: actor.authorizedBranchIds } }).select('_id');
    filter.appointmentId = { $in: branchApts.map((a) => a._id) };
  }

  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const items = await BookingRefund.find(filter)
    .sort({ _id: -1 })
    .limit(parseInt(limit, 10));

  const nextCursor = items.length === parseInt(limit, 10) ? items[items.length - 1]._id.toString() : null;

  return {
    items: items.map(formatBookingRefund),
    nextCursor,
  };
};

/**
 * Get refund detail by ID
 */
export const getRefundById = async (id, actor = null) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid refund ID');
  }

  const refund = await BookingRefund.findById(id);
  if (!refund) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Booking refund not found');
  }

  return formatBookingRefund(refund);
};

/**
 * Receptionist receives / processes refund request (REQUESTED -> PROCESSING)
 */
export const receiveRefund = async (id, note, actor) => {
  const refund = await BookingRefund.findById(id);
  if (!refund) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Booking refund not found');
  }

  if (refund.status !== 'REQUESTED') {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, `Cannot receive refund in ${refund.status} status`);
  }

  refund.status = 'PROCESSING';
  refund.history.push({
    status: 'PROCESSING',
    actorId: actor?.id || null,
    note: note || 'Refund received by staff',
    timestamp: new Date(),
  });
  await refund.save();

  return formatBookingRefund(refund);
};

/**
 * Manager / Admin approves refund (PROCESSING -> APPROVED -> REFUNDED)
 */
export const approveRefund = async (id, note, actor) => {
  const refund = await BookingRefund.findById(id);
  if (!refund) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Booking refund not found');
  }

  if (refund.status !== 'PROCESSING') {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, `Cannot approve refund in ${refund.status} status`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Transition to APPROVED then immediately REFUNDED in mock environment
    refund.status = 'REFUNDED';
    refund.processedBy = actor?.id || null;
    refund.processedAt = new Date();
    refund.history.push(
      {
        status: 'APPROVED',
        actorId: actor?.id || null,
        note: note || 'Refund approved',
        timestamp: new Date(),
      },
      {
        status: 'REFUNDED',
        actorId: actor?.id || null,
        note: 'Mock refund completed',
        timestamp: new Date(),
      }
    );
    await refund.save({ session });

    // Update payment refundedAmount
    const payment = await Payment.findById(refund.paymentId).session(session);
    if (payment) {
      payment.refundedAmount = (payment.refundedAmount || 0) + refund.amount;
      if (payment.refundedAmount >= payment.paidAmount) {
        payment.status = 'REFUNDED';
      }
      await payment.save({ session });
    }

    // Update deposit status on appointment if applicable
    const appointment = await Appointment.findById(refund.appointmentId).session(session);
    if (appointment && appointment.deposit) {
      appointment.deposit.status = 'REFUNDED';
      await appointment.save({ session });
    }

    await session.commitTransaction();
    return formatBookingRefund(refund);
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
};

/**
 * Manager / Admin rejects refund (PROCESSING -> REJECTED)
 */
export const rejectRefund = async (id, reason, actor) => {
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Rejection reason is required');
  }

  const refund = await BookingRefund.findById(id);
  if (!refund) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Booking refund not found');
  }

  if (refund.status !== 'PROCESSING') {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, `Cannot reject refund in ${refund.status} status`);
  }

  refund.status = 'REJECTED';
  refund.rejectedReason = reason;
  refund.processedBy = actor?.id || null;
  refund.processedAt = new Date();
  refund.history.push({
    status: 'REJECTED',
    actorId: actor?.id || null,
    note: reason,
    timestamp: new Date(),
  });
  await refund.save();

  return formatBookingRefund(refund);
};

/**
 * Manager / Admin override
 */
export const overrideRefund = async (id, overrideData, actor) => {
  const { reason } = overrideData;
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Override reason is required');
  }

  const refund = await BookingRefund.findById(id);
  if (!refund) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Booking refund not found');
  }

  refund.history.push({
    status: refund.status,
    actorId: actor?.id || null,
    note: `[OVERRIDE] ${reason}`,
    timestamp: new Date(),
  });
  await refund.save();

  return formatBookingRefund(refund);
};
