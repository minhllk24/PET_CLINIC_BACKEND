import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import * as inventoryService from '../src/modules/inventory/inventory.service';

jest.mock('../src/modules/inventory/inventory.service', () => ({
  listInventoryItems: jest.fn(),
  listStocks: jest.fn(),
  listTransactions: jest.fn(),
  receiveStock: jest.fn(),
  issueStock: jest.fn(),
  adjustStock: jest.fn(),
  createTransfer: jest.fn(),
  updateThreshold: jest.fn()
}));

jest.mock('../src/modules/audit/models/IdempotencyKey', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue({ lastErrorObject: { updatedExisting: false } }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
  }
}));

const branchId = '507f1f77bcf86cd799439011';
const destinationBranchId = '507f1f77bcf86cd799439012';
const inventoryItemId = '507f1f77bcf86cd799439013';
const actorId = '507f1f77bcf86cd799439014';
const transferId = '507f1f77bcf86cd799439015';
const createdAt = '2026-10-19T00:00:00.000Z';

const managerToken = jwt.sign(
  { id: actorId, systemRole: 'MANAGER', assignedBranchIds: [branchId, destinationBranchId] },
  process.env.JWT_ACCESS_TOKEN_SECRET,
  { expiresIn: '15m' }
);

const transaction = (overrides = {}) => ({
  id: '507f1f77bcf86cd799439099',
  branchId,
  inventoryItemId,
  transactionType: 'RECEIPT',
  beforeQty: 0,
  changeQty: 10,
  afterQty: 10,
  actorId,
  reason: 'INITIAL_STOCK',
  createdAt,
  sourceType: 'MANUAL',
  sourceId: null,
  recordVersion: null,
  ...overrides
});

describe('Inventory API V7 FE contract', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns the branch stock page shape expected by FE', async () => {
    inventoryService.listStocks.mockResolvedValue({
      items: [{
        branchId,
        inventoryItemId,
        quantity: 3,
        lowStock: true,
        lowStockThreshold: 5,
        version: 4
      }],
      nextCursor: null
    });

    const response = await request(app)
      .get(`/api/v1/inventory/stocks?branchId=${branchId}&lowStock=true`)
      .set('Authorization', `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items[0]).toMatchObject({ quantity: 3, lowStock: true, version: 4 });
  });

  it('returns a contract-valid Receipt transaction', async () => {
    inventoryService.receiveStock.mockResolvedValue(transaction());

    const response = await request(app)
      .post('/api/v1/inventory/receive')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', 'inventory-receipt-fe-contract')
      .send({ branchId, inventoryItemId, quantity: 10, reason: 'INITIAL_STOCK' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ transactionType: 'RECEIPT', afterQty: 10 });
  });

  it('returns two contract-valid Transfer ledger legs', async () => {
    inventoryService.createTransfer.mockResolvedValue({
      transferId,
      out: transaction({
        branchId,
        transactionType: 'TRANSFER',
        beforeQty: 10,
        changeQty: -2,
        afterQty: 8,
        reason: 'Branch transfer',
        sourceType: 'TRANSFER',
        sourceId: transferId
      }),
      in: transaction({
        id: '507f1f77bcf86cd799439098',
        branchId: destinationBranchId,
        transactionType: 'TRANSFER',
        beforeQty: 1,
        changeQty: 2,
        afterQty: 3,
        reason: 'Branch transfer',
        sourceType: 'TRANSFER',
        sourceId: transferId
      })
    });

    const response = await request(app)
      .post('/api/v1/inventory/transfer')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', 'inventory-transfer-fe-contract')
      .send({ fromBranchId: branchId, toBranchId: destinationBranchId, inventoryItemId, quantity: 2, reason: 'Branch transfer' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ transferId, out: { changeQty: -2 }, in: { changeQty: 2 } });
  });

  it('returns the updated threshold stock projection', async () => {
    inventoryService.updateThreshold.mockResolvedValue({
      branchId,
      inventoryItemId,
      quantity: 3,
      lowStock: true,
      lowStockThreshold: 5,
      version: 5
    });

    const response = await request(app)
      .put(`/api/v1/inventory/stocks/${branchId}/${inventoryItemId}/threshold`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('Idempotency-Key', 'inventory-threshold-fe-contract')
      .send({ lowStockThreshold: 5, expectedVersion: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ lowStockThreshold: 5, version: 5 });
  });
});
