import express from 'express';
import * as returnController from './return.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

export const returnRouter = express.Router();
export const refundRouter = express.Router();

const staffOrAbove = requireRole(['STAFF', 'MANAGER', 'ADMIN'], ['RECEPTIONIST']);
const managerOrAdmin = requireRole(['MANAGER', 'ADMIN']);

// --- Order Return Routes ---
returnRouter.post(
  '/',
  optionalAuth,
  idempotency('orderReturnCreate', { required: true }),
  returnController.createReturn
);

returnRouter.get('/', optionalAuth, returnController.listReturns);
returnRouter.get('/:id', optionalAuth, returnController.getReturn);

returnRouter.post('/:id/process', staffOrAbove, returnController.processReturn);
returnRouter.post('/:id/receive', staffOrAbove, returnController.receiveReturn);

returnRouter.post('/:id/approve', managerOrAdmin, returnController.approveReturn);
returnRouter.post('/:id/reject', managerOrAdmin, returnController.rejectReturn);

returnRouter.post('/:id/cancel', optionalAuth, returnController.cancelReturn);

// --- Order Refund Routes ---
refundRouter.get('/:id', managerOrAdmin, returnController.getOrderRefund);
refundRouter.post(
  '/:id/process',
  managerOrAdmin,
  idempotency('orderRefundProcess', { required: true }),
  returnController.processOrderRefund
);
