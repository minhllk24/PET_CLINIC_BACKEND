import mongoose from 'mongoose';
import InventoryTransaction from './models/InventoryTransaction';
import InventoryStock from './models/InventoryStock';
import AppError from '../../utils/AppError';

export const recordTransaction = async (data, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { 
      branchId, 
      inventoryItemId, 
      transactionType, // RECEIPT, ISSUE, ADJUSTMENT, TRANSFER
      quantity, 
      sourceType, // MANUAL, ORDER, SERVICE_RECORD_REVISION
      sourceId,
      notes 
    } = data;

    if (quantity <= 0 && transactionType !== 'ADJUSTMENT') {
      throw new AppError(400, 'ValidationError', 'INVALID_QUANTITY', 'Quantity must be positive');
    }

    // Determine quantity delta based on transaction type
    let delta = quantity;
    if (transactionType === 'ISSUE') {
      delta = -Math.abs(quantity);
    } else if (transactionType === 'RECEIPT') {
      delta = Math.abs(quantity);
    } // ADJUSTMENT can be positive or negative

    // Update or create stock
    let stock = await InventoryStock.findOne({ branchId, inventoryItemId }).session(session);
    
    if (!stock) {
      if (delta < 0) {
        throw new AppError(422, 'UnprocessableEntity', 'INSUFFICIENT_INVENTORY', 'Cannot issue from empty stock');
      }
      stock = new InventoryStock({
        branchId,
        inventoryItemId,
        quantity: delta,
        lastTransactionAt: new Date()
      });
    } else {
      if (stock.quantity + delta < 0) {
        throw new AppError(422, 'UnprocessableEntity', 'INSUFFICIENT_INVENTORY', 'Insufficient stock');
      }
      stock.quantity += delta;
      stock.lastTransactionAt = new Date();
    }
    await stock.save({ session });

    // Create append-only ledger record
    const transaction = new InventoryTransaction({
      branchId,
      inventoryItemId,
      transactionType,
      quantity,
      stockAfter: stock.quantity,
      sourceType,
      sourceId,
      actorId: actor.id,
      notes,
      postedAt: new Date()
    });
    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { transaction, stock };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
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
