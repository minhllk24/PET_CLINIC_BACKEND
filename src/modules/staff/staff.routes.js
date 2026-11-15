import mongoose from 'mongoose';
import express from 'express';
import * as staffController from './staff.controller';
import * as shiftController from './shift.controller';
import { authenticate, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';
import StaffProfile from './models/StaffProfile';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

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

router.post(
  '/:id/reset-password',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  staffController.resetStaffPassword
);

// ================= SHIFTS FOR STAFF (NESTED) =================
router.get(
  '/:staffId/shifts',
  authenticate,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  async (req, res, next) => {
    try {
      if (req.actor?.systemRole === 'STAFF') {
        const targetId = req.params.staffId?.toString();
        const actorUserId = req.actor.id?.toString();
        let isSelf = Boolean(targetId && actorUserId && targetId === actorUserId);
        if (!isSelf && targetId && actorUserId && (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction)) {
          const profile = await StaffProfile.findOne({ userId: actorUserId }).select('_id').lean();
          isSelf = Boolean(profile?._id && profile._id.toString() === targetId);
        }
        if (!isSelf) {
          return next(new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Staff can only view their own shifts'));
        }
      }
      req.query.staffId = req.params.staffId;
      return shiftController.listShifts(req, res, next);
    } catch (error) {
      return next(error);
    }
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
