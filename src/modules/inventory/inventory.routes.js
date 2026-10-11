import express from 'express';
import * as inventoryController from './inventory.controller';
import { requireRole } from '../../shared/authMiddleware';

import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

router.post('/receive', requireRole(['MANAGER', 'ADMIN']), idempotency('inventoryReceive'), inventoryController.receiveStock);
router.post('/transactions', requireRole(['MANAGER', 'ADMIN']), inventoryController.createTransaction);
router.get('/stocks', inventoryController.getStocks);

export default router;
