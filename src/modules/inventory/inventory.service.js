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
