import express from 'express';
import * as adminUsersController from './adminUsers.controller';
import { authenticate, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// All routes require ADMIN role
router.use(authenticate, requireRole(['ADMIN']));

router.get('/', adminUsersController.listUsers);
router.post('/', idempotency('adminCreateUser', { required: false }), adminUsersController.createUser);
router.get('/:id', adminUsersController.getUserById);
router.put('/:id', adminUsersController.updateUser);
router.patch('/:id', adminUsersController.updateUser);
router.patch('/:id/status', idempotency('adminUpdateUserStatus', { required: false }), adminUsersController.updateUserStatus);
router.patch('/:id/role', idempotency('adminUpdateUserRole', { required: false }), adminUsersController.updateUserRole);

export default router;

