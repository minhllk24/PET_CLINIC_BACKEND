import express from 'express';
import * as managerController from './manager.controller.js';
import { authenticate, requireRole } from '../../shared/authMiddleware.js';

const router = express.Router();

router.get(
  '/',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  managerController.listManagers
);

router.post(
  '/',
  authenticate,
  requireRole(['ADMIN']),
  managerController.createManager
);

router.get(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  managerController.getManagerById
);

router.patch(
  '/:id',
  authenticate,
  requireRole(['ADMIN']),
  managerController.updateManager
);

router.put(
  '/:id',
  authenticate,
  requireRole(['ADMIN']),
  managerController.updateManager
);

// OpenAPI v7: /managers/{id}/assigned-branches
router.put(
  '/:id/assigned-branches',
  authenticate,
  requireRole(['ADMIN']),
  managerController.updateManagerBranches
);

// Alias: /managers/{id}/branches
router.put(
  '/:id/branches',
  authenticate,
  requireRole(['ADMIN']),
  managerController.updateManagerBranches
);

router.post(
  '/:id/reset-password',
  authenticate,
  requireRole(['ADMIN']),
  managerController.resetManagerPassword
);

export default router;

