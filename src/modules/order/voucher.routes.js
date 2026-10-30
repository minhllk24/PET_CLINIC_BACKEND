import express from 'express';
import * as voucherController from './voucher.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// Public / Customer / Guest: Validate voucher (No quota consumed)
router.post('/validate', optionalAuth, voucherController.validateVoucher);

// Backward compatibility alias for FE (/vouchers/apply -> /vouchers/validate)
router.post('/apply', optionalAuth, voucherController.validateVoucher);

// Manager / Admin: List vouchers
router.get('/', requireRole(['MANAGER', 'ADMIN']), voucherController.listVouchers);

// Admin only: Create voucher (Requires Idempotency-Key)
router.post('/', requireRole(['ADMIN']), idempotency('vouchersCreate', { required: true }), voucherController.createVoucher);

// Admin / Manager: Get voucher details
router.get('/:id', requireRole(['MANAGER', 'ADMIN']), voucherController.getVoucherById);

// Admin only: Update voucher
router.patch('/:id', requireRole(['ADMIN']), voucherController.updateVoucher);

export default router;
