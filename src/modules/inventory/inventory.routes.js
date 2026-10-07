import express from 'express';
import * as inventoryController from './inventory.controller';
import { requireRole } from '../../shared/authMiddleware';

const router = express.Router();

router.post('/transactions', requireRole(['MANAGER', 'ADMIN']), inventoryController.createTransaction);
router.get('/stocks', inventoryController.getStocks);

export default router;
