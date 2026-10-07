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
  
  console.log('Cron jobs started');
};
