import mongoose from 'mongoose';
import InventoryTransaction from './models/InventoryTransaction';
import InventoryStock from './models/InventoryStock';
import AppError from '../../utils/AppError';

export const executeStockMovement = async ({
  branchId,
  inventoryItemId,
  transactionType,
  quantity,
  reason,
  sourceType = 'MANUAL',
  sourceId = null,
  actor
}) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let stock = await InventoryStock.findOne({ branchId, inventoryItemId }).session(session);
    const beforeQty = stock ? stock.quantity : 0;
    let changeQty = 0;
    let afterQty = beforeQty;

    if (transactionType === 'RECEIPT') {
      changeQty = Math.abs(quantity);
      afterQty = beforeQty + changeQty;
    } else if (transactionType === 'ISSUE') {
      changeQty = -Math.abs(quantity);
      afterQty = beforeQty + changeQty;
      if (afterQty < 0) {
        throw new AppError(422, 'UnprocessableEntity', 'INSUFFICIENT_INVENTORY', 'Cannot issue more than available stock');
      }
    } else if (transactionType === 'ADJUSTMENT') {
      afterQty = quantity;
      changeQty = afterQty - beforeQty;
    }

    if (!stock) {
      stock = new InventoryStock({
        branchId,
        inventoryItemId,
        quantity: afterQty,
        lowStockThreshold: 0,
        version: 1
      });
    } else {
      stock.quantity = afterQty;
      stock.version += 1;
    }
    await stock.save({ session });

    const tx = new InventoryTransaction({
      branchId,
      inventoryItemId,
      transactionType,
      beforeQty,
      changeQty,
      afterQty,
      actorId: actor ? (actor.id || actor._id) : new mongoose.Types.ObjectId(),
      reason: reason || 'Inventory movement',
      sourceType,
      sourceId,
      idempotencyKey: actor && actor.idempotencyKey ? actor.idempotencyKey : null
    });
    await tx.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { transaction: formatInventoryTransaction(tx), stock };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const formatInventoryTransaction = (tx) => {
  if (!tx) return null;
  const obj = typeof tx.toObject === 'function' ? tx.toObject() : { ...tx };
  return {
    id: (obj._id || obj.id).toString(),
    branchId: (obj.branchId._id || obj.branchId).toString(),
    inventoryItemId: (obj.inventoryItemId._id || obj.inventoryItemId).toString(),
    transactionType: obj.transactionType,
    beforeQty: obj.beforeQty,
    changeQty: obj.changeQty,
    afterQty: obj.afterQty,
    actorId: (obj.actorId._id || obj.actorId).toString(),
    reason: obj.reason,
    createdAt: obj.createdAt ? new Date(obj.createdAt).toISOString() : new Date().toISOString(),
    sourceType: obj.sourceType || 'MANUAL',
    sourceId: obj.sourceId ? obj.sourceId.toString() : null,
    recordVersion: obj.recordVersion !== undefined ? obj.recordVersion : null
  };
};

export const receiveStock = async (data, actor) => {
  const { branchId, inventoryItemId, quantity, reason } = data;
  if (!quantity || quantity <= 0) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Quantity must be positive');
  }
  if (!reason || reason.trim().length < 3) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Reason is required and must have at least 3 characters');
  }

  if (actor && actor.systemRole === 'MANAGER') {
    const isAuthorized = actor.assignedBranchIds && actor.assignedBranchIds.includes(branchId.toString());
    if (!isAuthorized) {
      throw new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', 'Manager cannot receive stock for unassigned branch');
    }
  }

  const { transaction } = await executeStockMovement({
    branchId,
    inventoryItemId,
    transactionType: 'RECEIPT',
    quantity,
    reason: reason.trim(),
    sourceType: 'MANUAL',
    actor
  });

  return transaction;
};

export const recordTransaction = async (data, actor) => {
  const { 
    branchId, 
    inventoryItemId, 
    transactionType, // RECEIPT, ISSUE, ADJUSTMENT, TRANSFER
    quantity, 
    sourceType, // MANUAL, ORDER, SERVICE_RECORD_REVISION
    sourceId,
    notes,
    reason 
  } = data;

  const res = await executeStockMovement({
    branchId,
    inventoryItemId,
    transactionType,
    quantity,
    reason: reason || notes || 'Transaction recorded',
    sourceType: sourceType || 'MANUAL',
    sourceId,
    actor
  });

  return { transaction: res.transaction, stock: res.stock };
};

export const getStocks = async (query) => {
  return await InventoryStock.find(query);
};

export const updateThreshold = async (branchId, inventoryItemId, threshold, expectedVersion, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let stock = await InventoryStock.findOne({ branchId, inventoryItemId }).session(session);
    if (!stock) {
      stock = new InventoryStock({
        branchId,
        inventoryItemId,
        quantity: 0,
        threshold: 0,
        version: 1
      });
      await stock.save({ session });
    }

    if (expectedVersion !== undefined && stock.version !== expectedVersion) {
      throw new AppError(409, 'Conflict', 'CONCURRENCY_CONFLICT', 'Stock threshold updated by another user');
    }

    stock.threshold = threshold;
    stock.version += 1;
    await stock.save({ session });

    await session.commitTransaction();
    session.endSession();
    return stock;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const createTransfer = async (data, actor) => {
  const { sourceBranchId, destinationBranchId, inventoryItemId, quantity, notes } = data;
  if (actor.systemRole === 'MANAGER') {
    const hasSource = actor.assignedBranchIds && actor.assignedBranchIds.includes(sourceBranchId.toString());
    const hasDest = actor.assignedBranchIds && actor.assignedBranchIds.includes(destinationBranchId.toString());
    if (!hasSource || !hasDest) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Manager must have access to both source and destination branches');
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let sourceStock = await InventoryStock.findOne({ branchId: sourceBranchId, inventoryItemId }).session(session);
    if (!sourceStock || sourceStock.quantity < quantity) {
      throw new AppError(422, 'UnprocessableEntity', 'INSUFFICIENT_INVENTORY', 'Insufficient stock at source branch');
    }
    sourceStock.quantity -= quantity;
    await sourceStock.save({ session });

    const sourceTx = new InventoryTransaction({
      branchId: sourceBranchId,
      inventoryItemId,
      transactionType: 'ISSUE',
      quantity: quantity,
      stockAfter: sourceStock.quantity,
      sourceType: 'MANUAL',
      actorId: actor.id,
      notes: `Transfer to ${destinationBranchId}: ${notes}`,
      postedAt: new Date()
    });
    await sourceTx.save({ session });

    let destStock = await InventoryStock.findOne({ branchId: destinationBranchId, inventoryItemId }).session(session);
    if (!destStock) {
      destStock = new InventoryStock({ branchId: destinationBranchId, inventoryItemId, quantity });
    } else {
      destStock.quantity += quantity;
    }
    await destStock.save({ session });

    const destTx = new InventoryTransaction({
      branchId: destinationBranchId,
      inventoryItemId,
      transactionType: 'RECEIPT',
      quantity: quantity,
      stockAfter: destStock.quantity,
      sourceType: 'MANUAL',
      actorId: actor.id,
      notes: `Transfer from ${sourceBranchId}: ${notes}`,
      postedAt: new Date()
    });
    await destTx.save({ session });

    await session.commitTransaction();
    session.endSession();
    return { sourceTx, destTx };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
