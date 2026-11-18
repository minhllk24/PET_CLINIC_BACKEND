import express from 'express';
import * as paymentController from './payment.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();
const staffOrAbove = requireRole(['STAFF', 'MANAGER', 'ADMIN'], ['RECEPTIONIST']);

router.get('/:id', optionalAuth, paymentController.getPaymentById);
router.post(
  '/:id/mock/complete',
  optionalAuth,
  idempotency('paymentMockComplete', { required: false }),
  paymentController.mockCompletePayment
);
router.post('/:id/cancel', optionalAuth, paymentController.cancelPendingPayment);
router.post(
  '/:id/record-at-store',
  staffOrAbove,
  idempotency('paymentRecordAtStore', { required: false }),
  paymentController.recordPaymentAtStore
);
router.post(
  '/bookings/:appointmentId/balance',
  staffOrAbove,
  idempotency('paymentBookingBalance', { required: false }),
  paymentController.createAndPayBookingBalance
);

export default router;

