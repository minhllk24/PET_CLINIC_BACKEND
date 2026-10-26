import cron from 'node-cron';
import Order from '../modules/order/models/Order';
import Appointment from '../modules/booking/models/Appointment';
import SlotReservation from '../modules/booking/models/SlotReservation';
import BookingRefund from '../modules/payment/models/BookingRefund';
import Payment from '../modules/payment/models/Payment';
import { processOutbox } from './outboxProcessor';

/**
 * Check and process expired appointment holds (ADR-41)
 * Releases slot reservations and triggers 100% BookingRefund if prepayment exists
 */
export const processAppointmentHoldExpiries = async () => {
  const now = new Date();
  const expiredAppointments = await Appointment.find({
    status: { $in: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'] },
    $or: [
      { holdExpiresAt: { $lt: now } },
      { holdExpiresAt: null, createdAt: { $lt: new Date(Date.now() - 15 * 60000) } },
    ],
  });

  const processed = [];

  for (const apt of expiredAppointments) {
    apt.status = 'CANCELLED';
    apt.cancel = {
      by: 'SYSTEM',
      at: now,
      reason: 'HOLD_EXPIRED_TIMEOUT',
      hoursBeforeStart: null,
      prepaidOutcome: apt.pricing?.paidAmount > 0 ? 'SYSTEM_FULL_REFUND' : 'NONE',
    };
    await apt.save();

    // Release held slot reservations
    await SlotReservation.updateMany(
      { appointmentId: apt._id, status: 'HELD' },
      { $set: { status: 'RELEASED' } }
    );

    // If prepayment exists, create 100% BookingRefund request
    if (apt.pricing && apt.pricing.paidAmount > 0) {
      const payment = await Payment.findOne({
        'target.id': apt._id,
      });

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

  // Cancel expired PENDING orders (older than 30 mins) every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const timeoutDate = new Date(Date.now() - 30 * 60000);
      const expiredOrders = await Order.find({
        status: 'PENDING',
        createdAt: { $lt: timeoutDate },
      });
      for (const order of expiredOrders) {
        order.status = 'CANCELLED';
        order.cancellationReason = 'PAYMENT_TIMEOUT';
        await order.save();
        console.log(`Order ${order._id} cancelled due to timeout`);
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
