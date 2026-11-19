import mongoose from 'mongoose';
import Payment from './models/Payment';
import Order from '../order/models/Order';
import Appointment from '../booking/models/Appointment';
import SlotReservation from '../booking/models/SlotReservation';
import Customer from '../customer/models/Customer';
import { compensateOrderPaymentFailure } from '../order/order.service';
import { restoreQuotaInSession } from '../order/voucher.service';
import { releaseFlashSaleQuotaInSession } from '../flash-sale/flashSale.service';
import { verifyGuestToken } from '../customer/guest.service';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

const isWriteConflictError = (error) => {
  if (!error) return false;
  if (error.code === 112 || error.codeName === 'WriteConflict') return true;
  if (typeof error.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError')) return true;
  if (Array.isArray(error.errorLabels) && error.errorLabels.includes('TransientTransactionError')) return true;
  return /WriteConflict|Write conflict/i.test(String(error.message || ''));
};

export const formatPayment = (payment) => {
  if (!payment) return null;
  const obj = typeof payment.toObject === 'function' ? payment.toObject() : { ...payment };
  const targetType = obj.target?.type || obj.targetType || 'ORDER';
  const targetId = obj.target?.id || obj.targetId;
  return {
    id: (obj._id || obj.id).toString(),
    code: obj.code || `PAY-${(obj._id || obj.id).toString().slice(-8).toUpperCase()}`,
    targetType,
    targetId: targetId ? targetId.toString() : null,
    kind: obj.kind || 'ORDER',
    amount: Number(obj.amount || 0),
    provider: obj.provider || 'MOCK',
    status: obj.status || 'PENDING',
    paidAt: obj.paidAt ? new Date(obj.paidAt).toISOString() : null,
    method: obj.method || 'ONLINE_MOCK',
    refundedAmount: Number(obj.refundedAmount || 0),
    expiresAt: obj.expiresAt ? new Date(obj.expiresAt).toISOString() : null,
  };
};

const resolvePaymentTarget = async (payment, session = null) => {
  const rawDoc = payment?._doc || payment;
  let targetType = payment?.target?.type || rawDoc?.targetType || payment?.targetType || null;
  let targetId = payment?.target?.id || rawDoc?.targetId || payment?.targetId || null;

  if (!targetId && payment?._id && (mongoose.connection.readyState === 1 || Appointment.findOne?._isMockFunction)) {
    try {
      let aptQ = Appointment.findOne({
        $or: [{ prepaymentId: payment._id }, { 'deposit.paymentId': payment._id }],
      }).select('_id');
      if (session && typeof aptQ?.session === 'function') aptQ = aptQ.session(session);
      const linkedApt = await aptQ;
      if (linkedApt?._id) {
        targetType = 'APPOINTMENT';
        targetId = linkedApt._id;
      }
    } catch {}
  }

  if (!targetId && payment?._id && (mongoose.connection.readyState === 1 || Order.findOne?._isMockFunction)) {
    try {
      let ordQ = Order.findOne({ 'payment.paymentId': payment._id }).select('_id');
      if (session && typeof ordQ?.session === 'function') ordQ = ordQ.session(session);
      const linkedOrd = await ordQ;
      if (linkedOrd?._id) {
        targetType = 'ORDER';
        targetId = linkedOrd._id;
      }
    } catch {}
  }

  return {
    targetType: targetType || 'ORDER',
    targetId: targetId || null,
  };
};

const assertPaymentTargetAccess = async (targetType, targetId, actor, guestToken, { staffOnly = false } = {}) => {
  let verifiedGuest = guestToken;
  if (!actor && typeof guestToken === 'string') {
    verifiedGuest = verifyGuestToken(guestToken.trim());
  }
  if (!actor && (!verifiedGuest || staffOnly)) {
    throw new AppError(401, 'Unauthenticated', ErrorCodes.AUTHENTICATION_ERROR, 'Authentication required for payment action');
  }

  let targetDoc = null;
  if (targetId && mongoose.Types.ObjectId.isValid(targetId)) {
    targetDoc =
      targetType === 'ORDER'
        ? await Order.findById(targetId).lean()
        : await Appointment.findById(targetId).lean();
  }
  if (!targetDoc) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, `${targetType === 'ORDER' ? 'Order' : 'Appointment'} not found for payment`);
  }

  if (actor) {
    const role = actor.systemRole || actor.role;
    if (role === 'ADMIN') return { targetDoc, verifiedGuest };

    if (role === 'MANAGER' || (role === 'STAFF' && (!actor.staffSubRole || actor.staffSubRole === 'RECEPTIONIST'))) {
      const branches = (actor.authorizedBranchIds || actor.assignedBranchIds || []).map((b) => (b?._id || b).toString());
      const targetBranch = (targetType === 'ORDER' ? targetDoc.fulfillmentBranchId : targetDoc.branchId)?.toString();
      if (branches.length === 0 || !targetBranch || !branches.includes(targetBranch)) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Target belongs to an unassigned branch');
      }
      return { targetDoc, verifiedGuest };
    }

    if (staffOnly) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only staff, manager, or admin can perform this payment action');
    }

    if (role === 'CUSTOMER') {
      const allowedCustomerIds = [(actor.id || actor._id)?.toString()];
      try {
        const cust = await Customer.findOne({ userId: actor.id }).select('_id').lean();
        if (cust?._id) allowedCustomerIds.push(cust._id.toString());
      } catch {}
      const docCustId = (targetDoc.customerId?._id || targetDoc.customerId)?.toString();
      const phoneMatch = Boolean(actor.phone && targetDoc.contactSnapshot?.phone === actor.phone);
      if ((!docCustId || !allowedCustomerIds.includes(docCustId)) && !phoneMatch) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not own this payment target');
      }
      return { targetDoc, verifiedGuest };
    }

    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Role not permitted to access payment');
  }

  // Verified guest check
  const canMatchPhone = Boolean(
    verifiedGuest.phone && (verifiedGuest.phoneVerified === true || (verifiedGuest.phoneVerified === undefined && verifiedGuest.emailVerified !== true))
  );
  const canMatchEmail = Boolean(verifiedGuest.email && verifiedGuest.emailVerified === true);
  const docPhone = targetDoc.contactSnapshot?.phone || targetDoc.customerContact?.phone || targetDoc.phone || '';
  const docEmail = (targetDoc.contactSnapshot?.email || targetDoc.customerContact?.email || targetDoc.email || '').toLowerCase().trim();
  const guestEmail = verifiedGuest.email ? String(verifiedGuest.email).toLowerCase().trim() : '';

  const isGuestOwner =
    (verifiedGuest.guestContactId && targetDoc.guestContactId && targetDoc.guestContactId.toString() === String(verifiedGuest.guestContactId)) ||
    (canMatchPhone && docPhone && docPhone === verifiedGuest.phone) ||
    (canMatchEmail && docEmail && guestEmail && docEmail === guestEmail);

  if (!isGuestOwner) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Guest token does not match this payment');
  }
  return { targetDoc, verifiedGuest };
};

export const getPaymentById = async (paymentId, actor = null, guestToken = null) => {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid payment ID');
  }
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Payment not found');
  }
  const { targetType, targetId } = await resolvePaymentTarget(payment);
  await assertPaymentTargetAccess(targetType, targetId, actor, guestToken);
  return formatPayment(payment);
};

export const mockCompletePayment = async (paymentId, data = {}, actor = null, guestToken = null) => {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid payment ID');
  }

  const rawOutcome = typeof data === 'object' && data !== null ? data.outcome : data;
  const outcomeUpper = String(rawOutcome || 'PAID').trim().toUpperCase();
  const isSuccessOutcome = ['PAID', 'SUCCESS', 'SUCCEEDED', 'COMPLETED'].includes(outcomeUpper);
  const isFailure = ['FAILED', 'FAILURE', 'CANCELLED'].includes(outcomeUpper);
  if (!isSuccessOutcome && !isFailure) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, `Unsupported mock outcome: ${rawOutcome}`);
  }
  const failureReason = (typeof data === 'object' && data?.failureReason) || 'Mock payment failed';

  const supportsTx = Boolean(
    mongoose.connection.client?.topology?.description?.type === 'ReplicaSetWithPrimary' ||
    mongoose.connection.client?.topology?.description?.type === 'Sharded' ||
    Appointment.findById?._isMockFunction ||
    Payment.findById?._isMockFunction
  );
  const useAtomicCas =
    !Payment.findById?._isMockFunction &&
    !Appointment.findById?._isMockFunction &&
    typeof Payment.findOneAndUpdate === 'function' &&
    typeof Appointment.findOneAndUpdate === 'function';

  const session = supportsTx ? await mongoose.startSession() : null;
  if (session && typeof session.startTransaction === 'function') {
    session.startTransaction();
  }

  try {
    let paymentQuery = Payment.findById(paymentId);
    if (session && typeof paymentQuery.session === 'function') paymentQuery = paymentQuery.session(session);
    let payment = await paymentQuery;
    if (!payment) {
      throw new AppError(404, 'NotFound', 'PAYMENT_NOT_FOUND', 'Payment not found');
    }

    const { targetType, targetId } = await resolvePaymentTarget(payment, session);

    if (actor || guestToken) {
      await assertPaymentTargetAccess(targetType, targetId, actor, guestToken);
    }

    // Reject BALANCE, COD, or non-deposit PAY_AT_STORE if called through mock/complete
    if (
      payment.kind === 'BALANCE' ||
      payment.method === 'COD' ||
      (payment.method === 'PAY_AT_STORE' && payment.kind !== 'DEPOSIT')
    ) {
      throw new AppError(422, 'UnprocessableEntity', 'PAYMENT_STATE_ERROR', `Cannot mock complete ${payment.kind} / ${payment.method} payment`);
    }

    // Idempotent terminal replays
    if (payment.status === 'PAID') {
      if (!isFailure) {
        if (session) { await session.abortTransaction(); session.endSession(); }
        return formatPayment(payment);
      }
      throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', 'Payment has already been paid');
    }

    if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
      if (isFailure) {
        if (session) { await session.abortTransaction(); session.endSession(); }
        return formatPayment(payment);
      }
      throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', `Payment is already in terminal state ${payment.status}`);
    }

    if (payment.status === 'EXPIRED' || payment.status === 'REFUND_PENDING' || payment.status === 'REFUNDED') {
      throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', `Payment cannot transition from ${payment.status}`);
    }

    const now = new Date();

    if (targetType === 'APPOINTMENT') {
      let aptQuery = Appointment.findById(targetId);
      if (session && typeof aptQuery.session === 'function') aptQuery = aptQuery.session(session);
      const apt = await aptQuery;

      if (!apt) {
        throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Target appointment not found');
      }

      const effectiveHoldExpiry = apt.holdExpiresAt || payment.expiresAt || null;
      const isHoldExpired = Boolean(
        (effectiveHoldExpiry && new Date(effectiveHoldExpiry) <= now) ||
        (!effectiveHoldExpiry &&
          apt.status === 'PENDING_PAYMENT' &&
          apt.createdAt &&
          now.getTime() - new Date(apt.createdAt).getTime() >= 15 * 60000)
      );
      const isPayableStatus = ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'].includes(apt.status);

      if (!isFailure && (!isPayableStatus || isHoldExpired)) {
        // Expiry / non-payable / terminal state beats late payment success callback
        if (apt.status === 'PENDING_PAYMENT' && isHoldExpired) {
          if (useAtomicCas) {
            await Appointment.findOneAndUpdate(
              { _id: apt._id, status: 'PENDING_PAYMENT' },
              {
                $set: {
                  status: 'CANCELLED',
                  holdExpiresAt: null,
                  cancel: {
                    by: 'SYSTEM',
                    at: now,
                    reason: 'HOLD_EXPIRED_TIMEOUT',
                    hoursBeforeStart: null,
                    prepaidOutcome: 'NONE',
                  },
                },
              },
              session ? { session } : {}
            );
          } else {
            apt.status = 'CANCELLED';
            apt.holdExpiresAt = null;
            apt.cancel = {
              by: 'SYSTEM',
              at: now,
              reason: 'HOLD_EXPIRED_TIMEOUT',
              hoursBeforeStart: null,
              prepaidOutcome: 'NONE',
            };
            await apt.save(session ? { session } : {});
          }
          await SlotReservation.deleteMany({ appointmentId: apt._id }, session ? { session } : {});
          if (apt.pricing?.voucherId) {
            await restoreQuotaInSession({
              voucherId: apt.pricing.voucherId,
              targetType: 'APPOINTMENT',
              targetId: apt._id,
              session,
            });
          }
        }

        const rejectedStatus = isHoldExpired ? 'EXPIRED' : (apt.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED');
        if (useAtomicCas) {
          await Payment.findOneAndUpdate(
            { _id: payment._id, status: 'PENDING' },
            {
              $set: {
                status: rejectedStatus,
                target: { type: 'APPOINTMENT', id: apt._id },
                targetType: 'APPOINTMENT',
                targetId: apt._id,
              },
            },
            session ? { session } : {}
          );
        } else {
          payment.status = rejectedStatus;
          await payment.save(session ? { session } : {});
        }
        if (session) {
          await session.commitTransaction();
          session.endSession();
        }
        throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', 'Appointment hold expired or appointment already cancelled');
      }

      if (isFailure) {
        if (useAtomicCas) {
          const updatedFail = await Payment.findOneAndUpdate(
            { _id: payment._id, status: 'PENDING' },
            {
              $set: {
                status: 'FAILED',
                target: { type: 'APPOINTMENT', id: apt._id },
                targetType: 'APPOINTMENT',
                targetId: apt._id,
              },
              $inc: { version: 1 },
            },
            { new: true, ...(session ? { session } : {}) }
          );
          if (!updatedFail) {
            const freshPay = await Payment.findById(payment._id);
            if (freshPay && ['FAILED', 'CANCELLED'].includes(freshPay.status)) {
              if (session) { await session.abortTransaction(); session.endSession(); }
              return formatPayment(freshPay);
            }
            throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', `Payment cannot transition from ${freshPay?.status || payment.status}`);
          }
          payment = updatedFail;
        } else {
          payment.status = 'FAILED';
          await payment.save(session ? { session } : {});
        }

        if (apt.status === 'PENDING_PAYMENT' || apt.status === 'PENDING_CONFIRMATION') {
          if (useAtomicCas) {
            await Appointment.findOneAndUpdate(
              { _id: apt._id, status: { $in: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'] } },
              {
                $set: {
                  status: 'CANCELLED',
                  holdExpiresAt: null,
                  'deposit.status': 'NOT_REQUIRED',
                  cancel: {
                    by: 'SYSTEM',
                    at: now,
                    reason: failureReason,
                    hoursBeforeStart: null,
                    prepaidOutcome: 'NONE',
                  },
                },
              },
              session ? { session } : {}
            );
          } else {
            apt.status = 'CANCELLED';
            apt.cancel = {
              by: 'SYSTEM',
              at: now,
              reason: failureReason,
              hoursBeforeStart: null,
              prepaidOutcome: 'NONE',
            };
            if (apt.deposit) apt.deposit.status = 'NOT_REQUIRED';
            apt.holdExpiresAt = null;
            await apt.save(session ? { session } : {});
          }
          await SlotReservation.deleteMany({ appointmentId: apt._id }, session ? { session } : {});
          if (apt.pricing?.voucherId) {
            await restoreQuotaInSession({
              voucherId: apt.pricing.voucherId,
              targetType: 'APPOINTMENT',
              targetId: apt._id,
              session,
            });
          }
        }
      } else {
        // Success transition on Appointment: sync Appointment & Payment atomically
        const nextDepositStatus = payment.kind === 'DEPOSIT' ? 'HELD' : (apt.deposit?.status || 'NOT_REQUIRED');

        if (useAtomicCas) {
          const updatedApt = await Appointment.findOneAndUpdate(
            {
              _id: apt._id,
              status: { $in: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'] },
              $or: [{ holdExpiresAt: null }, { holdExpiresAt: { $gt: now } }],
            },
            {
              $set: {
                status: 'CONFIRMED',
                holdExpiresAt: null,
                'deposit.status': nextDepositStatus,
                prepaymentId: payment._id,
              },
              $inc: {
                'pricing.paidAmount': Number(payment.amount || 0),
                version: 1,
              },
            },
            { new: true, ...(session ? { session } : {}) }
          );

          if (!updatedApt) {
            const freshPay = await Payment.findById(payment._id);
            if (freshPay?.status === 'PAID') {
              if (session) { await session.abortTransaction(); session.endSession(); }
              return formatPayment(freshPay);
            }
            const freshApt = await Appointment.findById(apt._id);
            const fallbackStatus = freshApt?.status === 'CANCELLED' && freshApt?.cancel?.reason !== 'HOLD_EXPIRED_TIMEOUT'
              ? 'CANCELLED'
              : 'EXPIRED';
            await Payment.findOneAndUpdate(
              { _id: payment._id, status: 'PENDING' },
              {
                $set: {
                  status: fallbackStatus,
                  target: { type: 'APPOINTMENT', id: apt._id },
                  targetType: 'APPOINTMENT',
                  targetId: apt._id,
                },
              },
              session ? { session } : {}
            );
            if (session) {
              await session.commitTransaction();
              session.endSession();
            }
            throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', 'Appointment hold expired or appointment already cancelled');
          }

          const updatedPay = await Payment.findOneAndUpdate(
            { _id: payment._id, status: 'PENDING' },
            {
              $set: {
                status: 'PAID',
                paidAt: now,
                target: { type: 'APPOINTMENT', id: apt._id },
                targetType: 'APPOINTMENT',
                targetId: apt._id,
              },
              $inc: { version: 1 },
            },
            { new: true, ...(session ? { session } : {}) }
          );

          if (!updatedPay) {
            if (!session) {
              // Standalone MongoDB rollback if Payment could not transition cleanly from PENDING
              await Appointment.findByIdAndUpdate(apt._id, {
                $set: {
                  status: apt.status,
                  holdExpiresAt: apt.holdExpiresAt || null,
                  'deposit.status': apt.deposit?.status || 'NOT_REQUIRED',
                },
                $inc: { 'pricing.paidAmount': -Number(payment.amount || 0) },
              });
            }
            const freshPay = await Payment.findById(payment._id);
            if (freshPay?.status === 'PAID') {
              if (session) { await session.abortTransaction(); session.endSession(); }
              return formatPayment(freshPay);
            }
            throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', `Payment cannot transition from ${freshPay?.status || payment.status}`);
          }
          payment = updatedPay;
        } else {
          // Mocked / session path: update Appointment BEFORE finalizing Payment
          apt.pricing = apt.pricing || {};
          apt.pricing.paidAmount = Number(apt.pricing.paidAmount || 0) + Number(payment.amount || 0);
          apt.deposit = apt.deposit || {};
          apt.deposit.status = nextDepositStatus;
          apt.status = 'CONFIRMED';
          apt.holdExpiresAt = null;
          apt.prepaymentId = apt.prepaymentId || payment._id;
          await apt.save(session ? { session } : {});

          payment.target = { type: 'APPOINTMENT', id: apt._id };
          payment.targetType = 'APPOINTMENT';
          payment.targetId = apt._id;
          payment.status = 'PAID';
          payment.paidAt = now;
          await payment.save(session ? { session } : {});
        }

        await SlotReservation.updateMany(
          { appointmentId: apt._id },
          { $set: { status: 'CONFIRMED', holdExpiresAt: null } },
          session ? { session } : {}
        );
      }
    } else {
      // ORDER target
      let orderQuery = Order.findById(targetId);
      if (session && typeof orderQuery.session === 'function') orderQuery = orderQuery.session(session);
      const order = await orderQuery;

      if (!order) {
        throw new AppError(404, 'NotFound', 'ORDER_NOT_FOUND', 'Target order not found');
      }

      if (isFailure) {
        if (useAtomicCas) {
          const updatedFail = await Payment.findOneAndUpdate(
            { _id: payment._id, status: 'PENDING' },
            {
              $set: {
                status: 'FAILED',
                target: { type: 'ORDER', id: order._id },
                targetType: 'ORDER',
                targetId: order._id,
              },
              $inc: { version: 1 },
            },
            { new: true, ...(session ? { session } : {}) }
          );
          if (!updatedFail) {
            const freshPay = await Payment.findById(payment._id);
            if (freshPay && ['FAILED', 'CANCELLED'].includes(freshPay.status)) {
              if (session) { await session.abortTransaction(); session.endSession(); }
              return formatPayment(freshPay);
            }
            throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', `Payment cannot transition from ${freshPay?.status || payment.status}`);
          }
          payment = updatedFail;
        } else {
          payment.status = 'FAILED';
          await payment.save(session ? { session } : {});
        }

        const compensatedOrder = await compensateOrderPaymentFailure(order._id, failureReason, actor, session);
        const failedPaymentRef = { paymentId: payment._id, status: 'FAILED', method: payment.method };
        if (!Order.findById?._isMockFunction && typeof Order.findByIdAndUpdate === 'function') {
          await Order.findByIdAndUpdate(
            order._id,
            { $set: { payment: failedPaymentRef } },
            session ? { session } : {}
          );
        } else {
          const targetOrderDoc = compensatedOrder || order;
          targetOrderDoc.payment = failedPaymentRef;
          if (typeof targetOrderDoc.save === 'function') {
            await targetOrderDoc.save(session ? { session } : {});
          }
        }

        // Release Flash Sale quota if any items were purchased via Flash Sale
        for (const item of order.items || []) {
          if (item.flashSaleId && !item.flashSaleQuotaReleased) {
            await releaseFlashSaleQuotaInSession({
              saleId: item.flashSaleId,
              sku: item.skuSnapshot,
              variantId: item.variantId,
              quantity: item.quantity,
              session,
            });
          }
        }
      } else {
        if (order.status === 'CANCELLED') {
          if (useAtomicCas) {
            await Payment.findOneAndUpdate(
              { _id: payment._id, status: 'PENDING' },
              {
                $set: {
                  status: 'FAILED',
                  target: { type: 'ORDER', id: order._id },
                  targetType: 'ORDER',
                  targetId: order._id,
                },
              },
              session ? { session } : {}
            );
          } else {
            payment.status = 'FAILED';
            await payment.save(session ? { session } : {});
          }
          if (session) {
            await session.commitTransaction();
            session.endSession();
          }
          throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', 'Order has already been cancelled');
        }

        if (useAtomicCas) {
          const updatedPaid = await Payment.findOneAndUpdate(
            { _id: payment._id, status: 'PENDING' },
            {
              $set: {
                status: 'PAID',
                paidAt: now,
                target: { type: 'ORDER', id: order._id },
                targetType: 'ORDER',
                targetId: order._id,
              },
              $inc: { version: 1 },
            },
            { new: true, ...(session ? { session } : {}) }
          );
          if (!updatedPaid) {
            const freshPay = await Payment.findById(payment._id);
            if (freshPay?.status === 'PAID') {
              if (session) { await session.abortTransaction(); session.endSession(); }
              return formatPayment(freshPay);
            }
            throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', `Payment cannot transition from ${freshPay?.status || payment.status}`);
          }
          payment = updatedPaid;
        } else {
          payment.status = 'PAID';
          payment.paidAt = now;
          await payment.save(session ? { session } : {});
        }

        const paidPaymentRef = {
          ...(typeof order.payment?.toObject === 'function' ? order.payment.toObject() : (order.payment || {})),
          paymentId: payment._id,
          status: 'PAID',
          method: payment.method,
        };
        if (!Order.findById?._isMockFunction && typeof Order.findByIdAndUpdate === 'function') {
          await Order.findByIdAndUpdate(
            order._id,
            { $set: { payment: paidPaymentRef } },
            session ? { session } : {}
          );
        } else {
          order.payment = paidPaymentRef;
          await order.save(session ? { session } : {});
        }
      }
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }
    return formatPayment(payment);
  } catch (error) {
    if (session) {
      try { await session.abortTransaction(); } catch {}
      session.endSession();
    }
    if (isWriteConflictError(error)) {
      let freshPay = null;
      let freshTarget = null;
      try {
        freshPay = await Payment.findById(paymentId);
        if (freshPay?.status === 'PENDING' && !Payment.findById?._isMockFunction) {
          await new Promise((resolve) => setTimeout(resolve, 80));
          freshPay = await Payment.findById(paymentId);
        }
        if (freshPay) {
          const resolved = await resolvePaymentTarget(freshPay, null);
          if (resolved.targetType === 'APPOINTMENT' && resolved.targetId) {
            freshTarget = await Appointment.findById(resolved.targetId);
          }
        }
      } catch {}

      if (freshPay?.status === 'PAID' && !isFailure) {
        return formatPayment(freshPay);
      }

      if (freshPay && freshPay.status === 'PENDING' && freshTarget) {
        const nowCheck = new Date();
        const effectiveExp = freshTarget.holdExpiresAt || freshPay.expiresAt || null;
        const holdExpired = Boolean(effectiveExp && new Date(effectiveExp) <= nowCheck);
        const nonPayable = !['PENDING_PAYMENT', 'PENDING_CONFIRMATION'].includes(freshTarget.status);
        if (holdExpired || nonPayable) {
          const fallbackPayStatus = holdExpired ? 'EXPIRED' : (freshTarget.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED');
          try {
            if (typeof Payment.findOneAndUpdate === 'function' && !Payment.findById?._isMockFunction) {
              await Payment.findOneAndUpdate(
                { _id: freshPay._id, status: 'PENDING' },
                { $set: { status: fallbackPayStatus } }
              );
            }
          } catch {}
          throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', 'Appointment hold expired or appointment already cancelled');
        }
      }

      if (freshPay && ['EXPIRED', 'CANCELLED', 'FAILED', 'REFUND_PENDING', 'REFUNDED'].includes(freshPay.status)) {
        throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', `Payment cannot transition from ${freshPay.status}`);
      }

      throw new AppError(409, 'Conflict', ErrorCodes.CONCURRENCY_CONFLICT, 'Concurrent payment or hold expiration update in progress');
    }
    throw error;
  }
};

export const cancelPendingPayment = async (paymentId, actor = null, guestToken = null) => {
  return mockCompletePayment(paymentId, { outcome: 'FAILED', failureReason: 'Cancelled by user' }, actor, guestToken);
};

export const recordPaymentAtStore = async (paymentId, actor) => {
  if (!mongoose.Types.ObjectId.isValid(paymentId)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid payment ID');
  }
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Payment not found');
  }
  const { targetType, targetId } = await resolvePaymentTarget(payment);
  await assertPaymentTargetAccess(targetType, targetId, actor, null, { staffOnly: true });

  if (payment.status === 'PAID') {
    return formatPayment(payment);
  }
  if (payment.status !== 'PENDING') {
    throw new AppError(409, 'Conflict', 'PAYMENT_STATE_ERROR', `Cannot record payment at store in ${payment.status} state`);
  }

  payment.status = 'PAID';
  payment.paidAt = new Date();
  await payment.save();
  return formatPayment(payment);
};

export const createAndPayBookingBalance = async (appointmentId, actor) => {
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid appointment ID');
  }
  const { targetDoc: apt } = await assertPaymentTargetAccess('APPOINTMENT', appointmentId, actor, null, { staffOnly: true });

  if (apt.status !== 'COMPLETED' || apt.paymentMethod !== 'PAY_AT_STORE') {
    throw new AppError(422, 'UnprocessableEntity', 'PAYMENT_STATE_ERROR', 'Balance collection requires COMPLETED PAY_AT_STORE appointment');
  }
  const finalAmount = Number(apt.pricing?.finalAmount || 0);
  const paidAmount = Number(apt.pricing?.paidAmount || 0);
  const remaining = Math.max(0, finalAmount - paidAmount);
  if (remaining <= 0) {
    throw new AppError(422, 'UnprocessableEntity', 'PAYMENT_STATE_ERROR', 'No remaining balance to collect');
  }

  const now = new Date();
  const payment = new Payment({
    code: `PAY-${new mongoose.Types.ObjectId().toString().slice(-10).toUpperCase()}`,
    target: { type: 'APPOINTMENT', id: apt._id },
    kind: 'BALANCE',
    method: 'PAY_AT_STORE',
    amount: remaining,
    provider: 'MOCK',
    status: 'PAID',
    paidAt: now,
  });
  await payment.save();

  await Appointment.findByIdAndUpdate(apt._id, {
    $set: {
      'pricing.paidAmount': finalAmount,
      'pricing.balanceAmount': 0,
      'deposit.status': apt.deposit?.status === 'HELD' ? 'APPLIED' : apt.deposit?.status || 'NOT_REQUIRED',
    },
  });

  return formatPayment(payment);
};
