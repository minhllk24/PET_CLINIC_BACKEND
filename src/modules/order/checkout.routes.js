import express from 'express';
import * as orderController from './order.controller';
import { optionalAuth } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

router.post(
  '/checkout',
  optionalAuth,
  idempotency('checkoutCreateOrder', { required: true }),
  orderController.checkoutCreateOrder
);

export default router;
