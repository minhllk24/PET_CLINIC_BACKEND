import express from 'express';
import * as inventoryController from './inventory.controller';
import { requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();
const operatorOnly = requireRole(['MANAGER', 'ADMIN']);
const inventoryReaders = requireRole(['STAFF', 'MANAGER', 'ADMIN']);

router.get('/items', inventoryReaders, inventoryController.getItems);
router.get('/stocks', inventoryReaders, inventoryController.getStocks);
router.get('/summary/:branchId', inventoryReaders, inventoryController.getBranchInventorySummary);
router.get('/transactions', operatorOnly, inventoryController.getTransactions);

router.post('/receive', operatorOnly, idempotency('inventoryReceive', { required: true }), inventoryController.receiveStock);
router.post('/issue', operatorOnly, idempotency('inventoryIssue', { required: true }), inventoryController.issueStock);
router.post('/adjust', operatorOnly, idempotency('inventoryAdjust', { required: true }), inventoryController.adjustStock);
router.post('/transfer', operatorOnly, idempotency('inventoryTransfer', { required: true }), inventoryController.transferStock);
router.put(
  '/stocks/:branchId/:inventoryItemId/threshold',
  operatorOnly,
  idempotency('inventoryThresholdUpdate', { required: true }),
  inventoryController.updateThreshold
);

export default router;
