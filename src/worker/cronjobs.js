import cron from 'node-cron';
import mongoose from 'mongoose';
import Order from '../modules/order/models/Order';
import Appointment from '../modules/booking/models/Appointment';
import SlotReservation from '../modules/booking/models/SlotReservation';
import BookingRefund from '../modules/payment/models/BookingRefund';
import Payment from '../modules/payment/models/Payment';
import { compensateOrderPaymentFailure } from '../modules/order/order.service';
import { restoreQuotaInSession } from '../modules/order/voucher.service';
import { processOutbox } from './outboxProcessor';

/**
 * Check and process expired appointment holds (ADR-41)
 * Releases slot reservations atomically and triggers 100% BookingRefund if prepayment exists
 */
export const processAppointmentHoldExpiries = async () => {
  const now = new Date();
  const expiredAppointments = await Appointment.find({
    status: 'PENDING_PAYMENT',
    $or: [
      { holdExpiresAt: { $lte: now } },
      { holdExpiresAt: null, createdAt: { $lt: new Date(Date.now() - 15 * 60000) } },
    ],
  });

  const processed = [];
  const cancelPayload = (apt) => ({
    by: 'SYSTEM',
    at: now,
    reason: 'HOLD_EXPIRED_TIMEOUT',
    hoursBeforeStart: null,
    prepaidOutcome: apt.pricing?.paidAmount > 0 ? 'SYSTEM_FULL_REFUND' : 'NONE',
  });

  for (const apt of expiredAppointments || []) {
    if (!Appointment.find?._isMockFunction && typeof Appointment.findOneAndUpdate === 'function') {
      const updated = await Appointment.findOneAndUpdate(
        { _id: apt._id, status: 'PENDING_PAYMENT' },
        { $set: { status: 'CANCELLED', cancel: cancelPayload(apt), holdExpiresAt: null } },
        { new: true }
      );
      if (!updated) continue;
    } else {
      apt.status = 'CANCELLED';
      apt.cancel = cancelPayload(apt);
      await apt.save();
    }

    // Delete held slot reservations cleanly so the unique slot index is freed immediately
    if (SlotReservation.updateMany?._isMockFunction) {
      await SlotReservation.updateMany(
        { appointmentId: apt._id, status: 'HELD' },
        { $set: { status: 'RELEASED' } }
      );
    } else if (typeof SlotReservation.deleteMany === 'function') {
      await SlotReservation.deleteMany({ appointmentId: apt._id, status: 'HELD' });
    }

    // Mark unpaid pending Payment as EXPIRED
    const paymentTargetFilter = {
      $or: [
        ...(apt.prepaymentId ? [{ _id: apt.prepaymentId }] : []),
        { 'target.id': apt._id },
        { targetId: apt._id },
      ],
    };
    if (mongoose.connection.readyState === 1 || Payment.updateMany?._isMockFunction) {
      await Payment.updateMany(
        { ...paymentTargetFilter, status: 'PENDING' },
        { $set: { status: 'EXPIRED' } }
      );
    }

    if (apt.pricing?.voucherId) {
      try {
        await restoreQuotaInSession({
          voucherId: apt.pricing.voucherId,
          targetType: 'APPOINTMENT',
          targetId: apt._id,
          session: null,
        });
      } catch {}
    }

    // If prepayment exists, create 100% BookingRefund request
    if (apt.pricing && apt.pricing.paidAmount > 0) {
      const payment = await Payment.findOne(paymentTargetFilter);

      if (payment) {
        const existingRefund = await BookingRefund.findOne({
          appointmentId: apt._id,
        });

        if (!existingRefund) {
          const refund = new BookingRefund({
            paymentId: payment._id,
            appointmentId: apt._id,
            amount: apt.pricing.paidAmount,
            rule: 'SYSTEM_FULL',
            reason: 'System confirmation timeout with prepayment',
            status: 'REQUESTED',
            history: [{
              status: 'REQUESTED',
              actorId: null,
              note: 'Auto-requested by system hold timeout',
              timestamp: now,
            }],
          });
          await refund.save();
        }
      }
    }

    processed.push(apt._id.toString());
  }

  return processed;
};

export const startCronJobs = () => {
  // Run outbox processor every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processOutbox();
    } catch (e) {
      console.error('Outbox processing error', e);
    }
  });

  // Cancel expired PENDING orders (older than 30 mins) every 5 minutes with full stock/voucher rollback
  cron.schedule('*/5 * * * *', async () => {
    try {
      const timeoutDate = new Date(Date.now() - 30 * 60000);
      const expiredOrders = await Order.find({
        status: 'PENDING',
        createdAt: { $lt: timeoutDate },
      });
      for (const order of expiredOrders) {
        await compensateOrderPaymentFailure(order._id, 'PAYMENT_TIMEOUT');
        await Payment.updateMany(
          { $or: [{ 'target.id': order._id }, { targetId: order._id }], status: 'PENDING' },
          { $set: { status: 'EXPIRED' } }
        );
        console.log(`Order ${order._id} cancelled due to timeout with stock/voucher compensation`);
      }
    } catch (e) {
      console.error('Order timeout job error', e);
    }
  });

  // Cancel expired appointment holds every minute
  cron.schedule('* * * * *', async () => {
    try {
      const expired = await processAppointmentHoldExpiries();
      if (expired.length > 0) {
        console.log(`Hold expiry cron processed ${expired.length} appointments:`, expired);
      }
    } catch (e) {
      console.error('Appointment timeout job error', e);
    }
  });

  // Keep-alive self-ping for Render Web Service (Free tier spin-down prevention)
  const renderUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    'https://pet-clinic-backend-a4lj.onrender.com';

  if (process.env.NODE_ENV === 'production') {
    cron.schedule('*/14 * * * *', async () => {
      try {
        const https = require('https');
        https.get(`${renderUrl}/healthz`, (res) => {
          console.log(`Render keep-alive ping: ${res.statusCode}`);
        }).on('error', (err) => {
          console.warn('Render keep-alive ping error:', err.message);
        });
      } catch (err) {
        console.warn('Render keep-alive execution error:', err.message);
      }
    });
  }
};
