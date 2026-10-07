import express from 'express';
import * as bookingController from './booking.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';

const router = express.Router();

router.post('/', optionalAuth, bookingController.createAppointment);
router.get('/', optionalAuth, bookingController.listAppointments);
router.patch('/:id/confirm', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), bookingController.confirmAppointment);
router.patch('/:id/reschedule', optionalAuth, bookingController.rescheduleAppointment);
router.patch('/:id/cancel', optionalAuth, bookingController.cancelAppointment);
router.patch('/:id/no-show', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), bookingController.markNoShow);
router.patch('/:id/start', requireRole(['STAFF']), bookingController.startSegment);

export default router;
