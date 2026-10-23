import express from 'express';
import * as branchController from './branch.controller';
import * as branchServiceConfigController from './branchServiceConfig.controller';
import * as inventoryController from '../inventory/inventory.controller';
import * as bookingController from '../booking/booking.controller';
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

// Blocked windows
router.get(
  '/:branchId/service-configs/:serviceId/blocks',
  authenticate,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  branchServiceConfigController.listBlockedWindows
);
router.post(
  '/:branchId/service-configs/:serviceId/blocks',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  branchServiceConfigController.createBlockedWindow
);
router.delete(
  '/:branchId/service-configs/:serviceId/blocks/:blockId',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  branchServiceConfigController.deleteBlockedWindow
);

// Branch Inventory Summary
router.get(
  '/:branchId/inventory-summary',
  authenticate,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  inventoryController.getBranchInventorySummary
);

// Branch Operation Slots & Service Occupancy (BE-01, BE-03)
router.get(
  '/:branchId/operation-slots',
  authenticate,
  requireRole(['ADMIN', 'MANAGER', 'STAFF']),
  bookingController.getBranchOperationSlots
);

router.get(
  '/:branchId/services/:serviceId/occupancy',
  optionalAuth,
  bookingController.getServiceOccupancy
);

export default router;
