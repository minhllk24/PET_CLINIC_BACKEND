import express from 'express';
import * as branchController from './branch.controller';
import * as branchServiceConfigController from './branchServiceConfig.controller';
import { authenticate, optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// ================= BRANCH CRUD =================
router.get('/', optionalAuth, branchController.listBranches);
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN']),
  idempotency('branchesCreate'),
  branchController.createBranch
);

router.get('/:id', optionalAuth, branchController.getBranchById);
router.patch(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  branchController.updateBranch
);
router.post(
  '/:id/deactivate',
  authenticate,
  requireRole(['ADMIN']),
  idempotency('branchesDeactivate'),
  branchController.deactivateBranch
);
router.post(
  '/:id/activate',
  authenticate,
  requireRole(['ADMIN']),
  idempotency('branchesActivate'),
  branchController.activateBranch
);

// ================= BRANCH SERVICE CONFIG (BRANCH CONTEXT) =================
router.get(
  '/:branchId/service-configs',
  authenticate,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  branchServiceConfigController.listBranchServiceConfigs
);

router.put(
  '/:branchId/service-configs/:serviceId',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  branchServiceConfigController.upsertBranchServiceConfig
);

export default router;
