import express from 'express';
import * as shiftController from './shift.controller';
import { authenticate, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// GET /api/v1/shifts (STAFF, MANAGER, ADMIN)
router.get(
  '/',
  authenticate,
  requireRole(['STAFF', 'MANAGER', 'ADMIN']),
  shiftController.listShifts
);

// POST /api/v1/shifts (MANAGER, ADMIN)
router.post(
  '/',
  authenticate,
  requireRole(['MANAGER', 'ADMIN']),
  idempotency('shiftsCreate'),
  shiftController.createShift
);

// PATCH /api/v1/shifts/:id (MANAGER, ADMIN)
router.patch(
  '/:id',
  authenticate,
  requireRole(['MANAGER', 'ADMIN']),
  shiftController.updateShift
);

// POST /api/v1/shifts/:id/cancel (MANAGER, ADMIN)
router.post(
  '/:id/cancel',
  authenticate,
  requireRole(['MANAGER', 'ADMIN']),
  idempotency('shiftsCancel'),
  shiftController.cancelShift
);

export default router;
