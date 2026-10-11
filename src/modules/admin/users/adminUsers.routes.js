import express from 'express';
import adminUsersController from './adminUsers.controller.js';
import { authenticate, requireRole } from '../../../shared/authMiddleware.js';

const router = express.Router();

// All admin user routes require valid authentication
router.use(authenticate);

// List users & details (ADMIN + MANAGER scoped)
router.get('/', requireRole(['ADMIN', 'MANAGER']), adminUsersController.listUsers);
router.get('/:id', requireRole(['ADMIN', 'MANAGER']), adminUsersController.getUserById);

// Admin-exclusive management endpoints
router.post('/', requireRole(['ADMIN']), adminUsersController.createInternalUser);
router.put('/:id/status', requireRole(['ADMIN']), adminUsersController.updateUserStatus);
router.put('/:id/role', requireRole(['ADMIN']), adminUsersController.updateUserRole);

export default router;
