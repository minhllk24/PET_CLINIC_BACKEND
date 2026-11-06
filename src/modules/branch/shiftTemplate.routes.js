import express from 'express';
import * as branchController from './branch.controller';
import { authenticate, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

router.use(authenticate);

router.get('/', requireRole(['ADMIN', 'MANAGER', 'STAFF']), branchController.listShiftTemplates);
router.post('/', requireRole(['ADMIN', 'MANAGER']), idempotency('shiftTemplatesDirectCreate', { required: false }), branchController.createShiftTemplate);
router.get('/:id', requireRole(['ADMIN', 'MANAGER', 'STAFF']), branchController.getShiftTemplateById);
router.patch('/:id', requireRole(['ADMIN', 'MANAGER']), idempotency('shiftTemplatesDirectUpdate', { required: false }), branchController.updateShiftTemplate);
router.put('/:id', requireRole(['ADMIN', 'MANAGER']), idempotency('shiftTemplatesDirectUpdate', { required: false }), branchController.updateShiftTemplate);
router.delete('/:id', requireRole(['ADMIN', 'MANAGER']), branchController.deleteShiftTemplate);

export default router;

