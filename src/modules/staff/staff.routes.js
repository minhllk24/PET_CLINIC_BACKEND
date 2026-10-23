import express from 'express';
import * as staffController from './staff.controller';
import * as shiftController from './shift.controller';
import { authenticate, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// ================= STAFF PROFILES =================
router.get(
  '/',
  authenticate,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  staffController.listStaff
);

router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  idempotency('staffCreate'),
  staffController.createStaff
);

router.get(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  staffController.getStaffById
);

router.patch(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  staffController.updateStaff
);

router.put(
  '/:id/branches',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  staffController.updateStaffBranches
);

// ================= SHIFTS FOR STAFF (NESTED) =================
router.get(
  '/:staffId/shifts',
  authenticate,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  (req, res, next) => {
    req.query.staffId = req.params.staffId;
    shiftController.listShifts(req, res, next);
  }
);

router.post(
  '/:staffId/shifts',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  (req, res, next) => {
    req.body.staffId = req.params.staffId;
    shiftController.createShift(req, res, next);
  }
);

export default router;
