import cron from 'node-cron';
import Order from '../modules/order/models/Order';
import Appointment from '../modules/booking/models/Appointment';
import { processOutbox } from './outboxProcessor';

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
        createdAt: { $lt: timeoutDate }
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

  // Cancel expired PENDING_CONFIRMATION appointments (holdExpiresAt in the past) every minute
  cron.schedule('* * * * *', async () => {
    try {
      // Assuming we added holdExpiresAt field based on State Machines doc
      const expiredAppointments = await Appointment.find({
        status: 'PENDING_CONFIRMATION',
        // holdExpiresAt: { $lt: new Date() } // Simplified to createdAt for skeleton
        createdAt: { $lt: new Date(Date.now() - 15 * 60000) } // 15 mins timeout
      });
      for (const apt of expiredAppointments) {
        apt.status = 'CANCELLED';
        await apt.save();
        // Here we should also release reservations...
        console.log(`Appointment ${apt._id} cancelled due to hold timeout`);
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

  cron.schedule('*/10 * * * *', async () => {
    try {
      if (process.env.NODE_ENV === 'production' || process.env.ENABLE_KEEP_ALIVE === 'true') {
        const pingTarget = `${renderUrl.replace(/\/$/, '')}/healthz`;
        const res = await fetch(pingTarget, {
          method: 'GET',
          headers: { 'User-Agent': 'PetClinic-KeepAlive/1.0' },
        });
        console.log(`[KEEP-ALIVE] Pinged ${pingTarget} -> HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`[KEEP-ALIVE] Self-ping warning (non-fatal):`, err.message);
    }
  });

  console.log('Cron jobs started (including Render keep-alive)');
};
