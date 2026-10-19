import express from 'express';
import * as bookingController from './booking.controller';
import { requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

router.post(
  '/appointments',
  requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']),
  idempotency('internalAppointmentsCreate', { required: true }),
  bookingController.createInternalAppointment
);

export default router;
