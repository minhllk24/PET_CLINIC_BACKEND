import mongoose from 'mongoose';
import InventoryStock from '../src/modules/inventory/models/InventoryStock';
import InventoryTransaction from '../src/modules/inventory/models/InventoryTransaction';
import {
  applyMovementInSession,
  formatInventoryStock,
  formatInventoryTransaction,
  getBranchInventorySummary,
  SYSTEM_ACTOR_ID
} from '../src/modules/inventory/inventory.service';
import { assertTransferScope } from '../src/modules/inventory/inventory.scope';
import { formatOrder } from '../src/modules/order/order.service';
import { ErrorCodes } from '../src/shared/errorCodes';

const branchA = new mongoose.Types.ObjectId();
const branchB = new mongoose.Types.ObjectId();
const branchC = new mongoose.Types.ObjectId();
const inventoryItemId = new mongoose.Types.ObjectId();
const fakeSession = {};
const sessionResult = (value) => ({ session: jest.fn().mockResolvedValue(value) });

describe('Inventory V7 invariants', () => {
  afterEach(() => jest.restoreAllMocks());

  it('keeps threshold only on branch stock and enforces one location per branch/item', () => {
    expect(InventoryStock.schema.paths.lowStockThreshold).toBeDefined();
    expect(InventoryStock.schema.paths.threshold).toBeUndefined();
    expect(InventoryStock.schema.paths.quantity.options.min).toBe(0);
    expect(InventoryStock.schema.indexes()).toEqual(expect.arrayContaining([
      [{ branchId: 1, inventoryItemId: 1 }, expect.objectContaining({ unique: true })]
    ]));
  });

  it('defines order, service revision, and transfer idempotency indexes', () => {
    const indexes = InventoryTransaction.schema.indexes();
    expect(indexes.some(([keys, options]) => keys.sourceType === 1 && keys.transactionType === 1 && options.unique)).toBe(true);
    expect(indexes.some(([keys, options]) => keys.recordVersion === 1 && options.unique)).toBe(true);
    expect(indexes.some(([keys, options]) => keys.transferId === 1 && keys.transferLeg === 1 && options.unique)).toBe(true);
  });

  it('rejects attempts to update or delete the append-only ledger', async () => {
    await expect(InventoryTransaction.updateOne({}, { $set: { reason: 'changed' } })).rejects.toThrow('append-only');
    await expect(InventoryTransaction.deleteOne({})).rejects.toThrow('append-only');
  });

  it('materializes a missing stock row as quantity/threshold/version zero', () => {
    expect(formatInventoryStock(null, { branchId: branchA, inventoryItemId })).toEqual({
      branchId: branchA.toString(),
      inventoryItemId: inventoryItemId.toString(),
      quantity: 0,
      lowStock: true,
      lowStockThreshold: 0,
      thresholdConfigured: false,
      version: 0
    });
  });

  it('creates a Receipt ledger row with exact before/change/after quantities', async () => {
    jest.spyOn(InventoryStock, 'findOne').mockReturnValue(sessionResult(null));
    jest.spyOn(InventoryStock, 'create').mockResolvedValue([{
      branchId: branchA,
      inventoryItemId,
      quantity: 7,
      lowStockThreshold: 0,
      version: 1
    }]);
    jest.spyOn(InventoryTransaction, 'create').mockImplementation(async ([value]) => [{
      _id: new mongoose.Types.ObjectId(),
      ...value,
      createdAt: new Date()
    }]);

    const result = await applyMovementInSession({
      session: fakeSession,
      branchId: branchA,
      inventoryItemId,
      transactionType: 'RECEIPT',
      quantity: 7,
      reason: 'INITIAL_STOCK',
      actorId: SYSTEM_ACTOR_ID
    });

    expect(result.transaction).toMatchObject({ beforeQty: 0, changeQty: 7, afterQty: 7 });
    expect(InventoryStock.create).toHaveBeenCalledWith([
      expect.objectContaining({ quantity: 7, lowStockThreshold: 0, version: 1 })
    ], { session: fakeSession });
  });

  it('rejects Issue before any write when stock would become negative', async () => {
    jest.spyOn(InventoryStock, 'findOne').mockReturnValue(sessionResult({
      _id: new mongoose.Types.ObjectId(),
      branchId: branchA,
      inventoryItemId,
      quantity: 2,
      version: 1
    }));
    const update = jest.spyOn(InventoryStock, 'findOneAndUpdate');
    const ledger = jest.spyOn(InventoryTransaction, 'create');

    await expect(applyMovementInSession({
      session: fakeSession,
      branchId: branchA,
      inventoryItemId,
      transactionType: 'ISSUE',
      quantity: 3,
      reason: 'Damaged goods issue',
      actorId: SYSTEM_ACTOR_ID
    })).rejects.toMatchObject({ status: 422, code: ErrorCodes.INSUFFICIENT_INVENTORY });
    expect(update).not.toHaveBeenCalled();
    expect(ledger).not.toHaveBeenCalled();
  });

  it('treats manual Adjustment quantity as the new absolute balance', async () => {
    const stockId = new mongoose.Types.ObjectId();
    jest.spyOn(InventoryStock, 'findOne').mockReturnValue(sessionResult({
      _id: stockId,
      branchId: branchA,
      inventoryItemId,
      quantity: 9,
      version: 3
    }));
    jest.spyOn(InventoryStock, 'findOneAndUpdate').mockResolvedValue({
      _id: stockId,
      branchId: branchA,
      inventoryItemId,
      quantity: 4,
      version: 4
    });
    jest.spyOn(InventoryTransaction, 'create').mockImplementation(async ([value]) => [{
      _id: new mongoose.Types.ObjectId(),
      ...value,
      createdAt: new Date()
    }]);

    const result = await applyMovementInSession({
      session: fakeSession,
      branchId: branchA,
      inventoryItemId,
      transactionType: 'ADJUSTMENT',
      quantity: 4,
      reason: 'Physical count correction',
      actorId: SYSTEM_ACTOR_ID
    });
    expect(result.transaction).toMatchObject({ beforeQty: 9, changeQty: -5, afterQty: 4 });
  });

  it('requires both transfer branches to be in Manager scope', () => {
    const manager = {
      systemRole: 'MANAGER',
      assignedBranchIds: [branchA.toString(), branchB.toString()]
    };
    expect(assertTransferScope(manager, branchA, branchB)).toEqual({
      fromBranchId: branchA.toString(),
      toBranchId: branchB.toString()
    });
    expect(() => assertTransferScope(manager, branchA, branchC)).toThrow(expect.objectContaining({
      status: 403,
      code: ErrorCodes.BRANCH_SCOPE_ERROR
    }));
  });

  it('replays an existing Order movement instead of decrementing twice', async () => {
    const existingTx = {
      _id: new mongoose.Types.ObjectId(),
      branchId: branchA,
      inventoryItemId,
      transactionType: 'ISSUE',
      beforeQty: 10,
      changeQty: -2,
      afterQty: 8
    };
    jest.spyOn(InventoryTransaction, 'findOne').mockReturnValue(sessionResult(existingTx));
    jest.spyOn(InventoryStock, 'findOne').mockReturnValue(sessionResult({ quantity: 8 }));
    const update = jest.spyOn(InventoryStock, 'findOneAndUpdate');

    const result = await applyMovementInSession({
      session: fakeSession,
      branchId: branchA,
      inventoryItemId,
      transactionType: 'ISSUE',
      quantity: 2,
      reason: 'Order checkout',
      sourceType: 'ORDER',
      sourceId: new mongoose.Types.ObjectId(),
      actorId: SYSTEM_ACTOR_ID
    });
    expect(result.replayed).toBe(true);
    expect(update).not.toHaveBeenCalled();
  });

  it('formats checkout output to the V7 Order contract without leaking persistence fields', () => {
    const orderId = new mongoose.Types.ObjectId();
    const paymentId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const variantId = new mongoose.Types.ObjectId();
    const result = formatOrder({
      _id: orderId,
      __v: 2,
      code: 'ORD-001',
      customerId: null,
      fulfillmentBranchId: branchA,
      status: 'PENDING',
      items: [{
        orderItemId: new mongoose.Types.ObjectId().toString(),
        productId,
        variantId,
        skuSnapshot: 'SKU-001',
        nameSnapshot: 'Product snapshot',
        unitPrice: 100,
        quantity: 2,
        lineSubtotal: 200,
        allocatedDiscount: 0,
        lineNet: 200
      }],
      pricing: { merchandiseSubtotal: 200, voucherDiscount: 0, shippingFee: 30, totalAmount: 230 },
      shippingAddress: { recipientName: 'A' },
      contactSnapshot: {},
      paymentMethod: 'COD',
      payment: { paymentId, status: 'PENDING' },
      createdAt: new Date('2026-10-19T00:00:00.000Z')
    });

    expect(result.id).toBe(orderId.toString());
    expect(result.items[0]).toMatchObject({ name: 'Product snapshot', skuSnapshot: 'SKU-001' });
    expect(result).not.toHaveProperty('_id');
    expect(result).not.toHaveProperty('__v');
  });

  it('updates lowStockThreshold and sets thresholdConfigured: true when threshold is provided on Receipt', async () => {
    jest.spyOn(InventoryStock, 'findOne').mockReturnValue(sessionResult(null));
    const createStockSpy = jest.spyOn(InventoryStock, 'create').mockResolvedValue([{
      branchId: branchA,
      inventoryItemId,
      quantity: 10,
      lowStockThreshold: 5,
      thresholdConfigured: true,
      version: 1
    }]);
    jest.spyOn(InventoryTransaction, 'create').mockImplementation(async ([value]) => [{
      _id: new mongoose.Types.ObjectId(),
      ...value,
      createdAt: new Date()
    }]);

    const result = await applyMovementInSession({
      session: fakeSession,
      branchId: branchA,
      inventoryItemId,
      transactionType: 'RECEIPT',
      quantity: 10,
      lowStockThreshold: 5,
      reason: 'RECEIPT_WITH_THRESHOLD',
      actorId: SYSTEM_ACTOR_ID
    });

    expect(createStockSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        quantity: 10,
        lowStockThreshold: 5,
        thresholdConfigured: true
      })
    ], { session: fakeSession });
  });

  it('formats inventory transaction with branch and actor information', () => {
    const txId = new mongoose.Types.ObjectId();
    const formatted = formatInventoryTransaction({
      _id: txId,
      branchId: branchA,
      branchName: 'Chi nhánh Quận 1',
      branchCode: 'Q1',
      inventoryItemId,
      transactionType: 'RECEIPT',
      beforeQty: 0,
      changeQty: 10,
      afterQty: 10,
      actorId: SYSTEM_ACTOR_ID,
      actorName: 'Hệ thống',
      actorRole: 'SYSTEM',
      isSystemActor: true,
      reason: 'Nhận hàng',
      createdAt: new Date('2026-10-23T00:00:00.000Z'),
      sourceType: 'MANUAL',
      sourceId: null
    });

    expect(formatted).toMatchObject({
      id: txId.toString(),
      branchName: 'Chi nhánh Quận 1',
      branchCode: 'Q1',
      actorName: 'Hệ thống',
      actorRole: 'SYSTEM',
      isSystemActor: true
    });
  });

  it('calculates branch inventory summary distinguishing low stock and out of stock', async () => {
    jest.spyOn(InventoryStock, 'find').mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { quantity: 0, lowStockThreshold: 5, thresholdConfigured: true },
        { quantity: 3, lowStockThreshold: 5, thresholdConfigured: true },
        { quantity: 20, lowStockThreshold: 5, thresholdConfigured: true },
        { quantity: 2, lowStockThreshold: 0, thresholdConfigured: false }
      ])
    });

    const summary = await getBranchInventorySummary(branchA.toString(), {
      id: SYSTEM_ACTOR_ID.toString(),
      systemRole: 'ADMIN'
    });

    expect(summary).toEqual({
      branchId: branchA.toString(),
      totalItems: 4,
      lowStockItems: 1, // only the item with quantity 3 (0 < 3 <= 5 and thresholdConfigured)
      outOfStockItems: 1 // only the item with quantity 0
    });
  });
});
