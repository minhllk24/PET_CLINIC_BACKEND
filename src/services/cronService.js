import cron from 'node-cron';
import prisma from '../configs/prisma';
import { sendAppointmentReminderEmail } from '../utils/emailHelpers';
import { toBigIntId } from '../utils/prismaHelpers';
import appointmentAPIService from './appointmentAPIService';

// Run every hour to check for appointments 24 hours from now
export const initCronJobs = () => {
  // Generate slots immediately on server startup
  appointmentAPIService.generateAutoSlots(7);

  // Generate slots everyday at 00:00
  cron.schedule('0 0 * * *', async () => {
    console.log('Running cron job: Generate auto slots');
    try {
      await appointmentAPIService.generateAutoSlots(7);
    } catch (error) {
      console.error('Error generating slots in cron job:', error);
    }
  });

  cron.schedule('0 * * * *', async () => {
    console.log('Running cron job: Check for 24h appointment reminders');
    try {
      const now = new Date();
      // Target window: 24h from now, up to 25h from now (to catch appointments in the next hour)
      const targetStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const targetEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const upcomingAppointments = await prisma.appointment.findMany({
        where: {
          appointment_date: {
            gte: targetStart,
            lt: targetEnd
          },
          status: 'confirmed',
          payment_status: {
            not: 'unpaid' // Only remind if they paid online or selected store payment
          }
        },
        include: {
          user: true
        }
      });

      for (const appointment of upcomingAppointments) {
        if (appointment.user && appointment.user.email) {
          const formattedDate = appointment.appointment_date.toLocaleDateString('vi-VN');
          await sendAppointmentReminderEmail(
            appointment.user.email,
            appointment.appointment_code,
            formattedDate,
            appointment.start_time
          );
          
          // Optionally create a system notification for the reminder
          await prisma.notification.create({
            data: {
              user_id: appointment.user_id,
              title: 'Nhắc nhở lịch hẹn',
              content: `Bạn có một lịch hẹn (Mã: ${appointment.appointment_code}) vào lúc ${appointment.start_time} ngày ${formattedDate}.`,
              type: 'system',
              is_read: false
            }
          });
        }
      }
    } catch (error) {
      console.error('Error in appointment reminder cron job:', error);
    }
  });
};
