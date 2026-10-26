import express from 'express';
import * as bookingController from './booking.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// List & Create Appointments
router.get('/', optionalAuth, bookingController.listAppointments);
router.post('/', optionalAuth, idempotency('appointmentsCreate', { required: true }), bookingController.createAppointment);

// Detail
router.get('/:id', optionalAuth, bookingController.getAppointmentById);

// Canonical POST Endpoints (OpenAPI v7)
router.post('/:id/confirm', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), idempotency('appointmentsConfirm', { required: true }), bookingController.confirmAppointment);
router.post('/:id/reject', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), idempotency('appointmentsReject', { required: true }), bookingController.rejectAppointment);
router.post('/:id/no-show', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), idempotency('appointmentsMarkNoShow', { required: true }), bookingController.markNoShow);
router.post('/:id/start', requireRole(['STAFF', 'MANAGER', 'ADMIN']), bookingController.startSegment);
router.post('/:id/reschedule', optionalAuth, idempotency('appointmentsReschedule', { required: true }), bookingController.rescheduleAppointment);
router.post('/:id/reschedule-override', requireRole(['MANAGER', 'ADMIN']), idempotency('appointmentsRescheduleOverride', { required: true }), bookingController.rescheduleOverride);
router.post('/:id/cancel', optionalAuth, idempotency('appointmentsCancel', { required: true }), bookingController.cancelAppointment);
router.post('/:id/store-cancel', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), idempotency('appointmentsStoreCancel', { required: true }), bookingController.storeCancelAppointment);
router.post('/:id/cancel-override', requireRole(['MANAGER', 'ADMIN']), idempotency('appointmentsCancelOverride', { required: true }), bookingController.cancelOverride);

// Reassign Staff per segment
router.put('/:id/segments/:serviceId/staff', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), bookingController.reassignSegmentStaff);
router.put('/:id/reviewer', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), bookingController.assignReviewer);

// Backward Compatibility Aliases (PATCH)
router.patch('/:id/confirm', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), bookingController.confirmAppointment);
router.patch('/:id/reschedule', optionalAuth, bookingController.rescheduleAppointment);
router.patch('/:id/cancel', optionalAuth, bookingController.cancelAppointment);
router.patch('/:id/no-show', requireRole(['RECEPTIONIST', 'MANAGER', 'ADMIN']), bookingController.markNoShow);
router.patch('/:id/start', requireRole(['STAFF', 'MANAGER', 'ADMIN']), bookingController.startSegment);

export default router;
