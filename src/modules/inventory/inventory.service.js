import mongoose from 'mongoose';
import InventoryTransaction from './models/InventoryTransaction';
import InventoryStock from './models/InventoryStock';
import InventoryItem from './models/InventoryItem';
import Branch from '../branch/models/Branch';
import AuditLog from '../../models/AuditLog';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import {
  assertInventoryBranchScope,
  assertTransferScope,
  inventoryBranchIdsForActor,
  requireObjectId,
  resolveInventoryActor
} from './inventory.scope';

export const SYSTEM_ACTOR_ID = new mongoose.Types.ObjectId('000000000000000000000000');

const normalizeId = (value) => (value && value._id ? value._id : value).toString();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validateReason = (reason) => {
  if (typeof reason !== 'string' || reason.trim().length < 3) {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Reason is required and must have at least 3 characters');
  }
  return reason.trim();
};

const validatePositiveQuantity = (quantity) => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Quantity must be greater than 0');
  }
  return quantity;
};

const validateAdjustmentQuantity = (quantity) => {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Adjustment quantity must be 0 or greater');
  }
  return quantity;
};

const ensureReferences = async (branchIds, inventoryItemId, session) => {
  requireObjectId(inventoryItemId, 'inventoryItemId');
  const normalizedBranches = branchIds.map((branchId) => requireObjectId(branchId, 'branchId'));
  const [branches, item] = await Promise.all([
    Branch.find({ _id: { $in: normalizedBranches } }).select('_id').session(session).lean(),
    InventoryItem.findById(inventoryItemId).session(session).lean()
  ]);
  if (branches.length !== normalizedBranches.length) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Branch not found');
  }
  if (!item) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Inventory item not found');
  }
  return item;
};

const runInTransaction = async (work, existingSession = null) => {
  if (existingSession) return work(existingSession);

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const duplicateMovementFilter = ({ sourceType, sourceId, recordVersion, inventoryItemId, transactionType }) => {
  if (!sourceId || !['ORDER', 'SERVICE_RECORD_REVISION'].includes(sourceType)) return null;
  const filter = { sourceType, sourceId, inventoryItemId };
  if (sourceType === 'ORDER') filter.transactionType = transactionType;
  if (sourceType === 'SERVICE_RECORD_REVISION') filter.recordVersion = recordVersion;
  return filter;
};

export const formatInventoryTransaction = (tx) => {
  if (!tx) return null;
  const obj = typeof tx.toObject === 'function' ? tx.toObject() : { ...tx };
  return {
    id: normalizeId(obj._id || obj.id),
    branchId: normalizeId(obj.branchId),
    inventoryItemId: normalizeId(obj.inventoryItemId),
    transactionType: obj.transactionType,
    beforeQty: obj.beforeQty,
    changeQty: obj.changeQty,
    afterQty: obj.afterQty,
    actorId: normalizeId(obj.actorId),
    reason: obj.reason,
    createdAt: new Date(obj.createdAt).toISOString(),
    sourceType: obj.sourceType,
    sourceId: obj.sourceId ? normalizeId(obj.sourceId) : null,
    recordVersion: obj.recordVersion === undefined ? null : obj.recordVersion
  };
};

export const formatInventoryStock = (stock, fallback = {}) => {
  const obj = stock && typeof stock.toObject === 'function' ? stock.toObject() : (stock || {});
  const quantity = obj.quantity === undefined ? 0 : obj.quantity;
  const lowStockThreshold = obj.lowStockThreshold === undefined ? 0 : obj.lowStockThreshold;
  return {
    branchId: normalizeId(obj.branchId || fallback.branchId),
    inventoryItemId: normalizeId(obj.inventoryItemId || fallback.inventoryItemId),
    quantity,
    lowStock: quantity <= lowStockThreshold,
    lowStockThreshold,
    version: obj.version === undefined ? 0 : obj.version
  };
};

export const applyMovementInSession = async ({
  session,
  branchId,
  inventoryItemId,
  transactionType,
  quantity,
  delta,
  reason,
  sourceType = 'MANUAL',
  sourceId = null,
  recordVersion = null,
  transferId = null,
  transferLeg = null,
  actorId = SYSTEM_ACTOR_ID,
  idempotencyKey = null
}) => {
  const dedupeFilter = duplicateMovementFilter({ sourceType, sourceId, recordVersion, inventoryItemId, transactionType });
  if (dedupeFilter) {
    const existingTx = await InventoryTransaction.findOne(dedupeFilter).session(session);
    if (existingTx) {
      const currentStock = await InventoryStock.findOne({ branchId, inventoryItemId }).session(session);
      return { transaction: existingTx, stock: currentStock, replayed: true };
    }
  }

  const stock = await InventoryStock.findOne({ branchId, inventoryItemId }).session(session);
  const beforeQty = stock ? stock.quantity : 0;
  let changeQty;
  let afterQty;

  if (delta !== undefined) {
    if (!Number.isFinite(delta)) {
      throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Inventory delta must be numeric');
    }
    changeQty = delta;
    afterQty = beforeQty + changeQty;
  } else if (transactionType === 'RECEIPT') {
    changeQty = validatePositiveQuantity(quantity);
    afterQty = beforeQty + changeQty;
  } else if (transactionType === 'ISSUE') {
    changeQty = -validatePositiveQuantity(quantity);
    afterQty = beforeQty + changeQty;
  } else if (transactionType === 'ADJUSTMENT') {
    afterQty = validateAdjustmentQuantity(quantity);
    changeQty = afterQty - beforeQty;
  } else {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Unsupported inventory movement');
  }

  if (afterQty < 0) {
    throw new AppError(422, 'Unprocessable Entity', ErrorCodes.INSUFFICIENT_INVENTORY, 'Inventory cannot become negative');
  }

  let updatedStock;
  if (!stock) {
    [updatedStock] = await InventoryStock.create([{
      branchId,
      inventoryItemId,
      quantity: afterQty,
      lowStockThreshold: 0,
      version: 1
    }], { session });
  } else {
    updatedStock = await InventoryStock.findOneAndUpdate(
      { _id: stock._id, version: stock.version },
      { $set: { quantity: afterQty }, $inc: { version: 1 } },
      { new: true, session, runValidators: true }
    );
    if (!updatedStock) {
      throw new AppError(409, 'Conflict', ErrorCodes.CONCURRENCY_CONFLICT, 'Inventory was changed by another operation');
    }
  }

  const [transaction] = await InventoryTransaction.create([{
    branchId,
    inventoryItemId,
    transactionType,
    beforeQty,
    changeQty,
    afterQty,
    actorId,
    reason: validateReason(reason),
    sourceType,
    sourceId,
    recordVersion,
    transferId,
    transferLeg,
    idempotencyKey
  }], { session });

  return { transaction, stock: updatedStock, replayed: false };
};

const manualMovement = async (data, actor, transactionType) => {
  const resolvedActor = await resolveInventoryActor(actor, ['ADMIN', 'MANAGER']);
  const branchId = assertInventoryBranchScope(resolvedActor, data.branchId, { hideExistence: false });
  const inventoryItemId = requireObjectId(data.inventoryItemId, 'inventoryItemId');
  const reason = validateReason(data.reason);

  return runInTransaction(async (session) => {
    await ensureReferences([branchId], inventoryItemId, session);
    const result = await applyMovementInSession({
      session,
      branchId,
      inventoryItemId,
      transactionType,
      quantity: data.quantity,
      reason,
      sourceType: 'MANUAL',
      actorId: resolvedActor.id,
      idempotencyKey: actor.idempotencyKey || null
    });
    return formatInventoryTransaction(result.transaction);
  });
};

export const receiveStock = (data, actor) => manualMovement(data, actor, 'RECEIPT');
export const issueStock = (data, actor) => manualMovement(data, actor, 'ISSUE');
export const adjustStock = (data, actor) => manualMovement(data, actor, 'ADJUSTMENT');

export const createTransfer = async (data, actor) => {
  const resolvedActor = await resolveInventoryActor(actor, ['ADMIN', 'MANAGER']);
  const { fromBranchId, toBranchId } = assertTransferScope(resolvedActor, data.fromBranchId, data.toBranchId);
  const inventoryItemId = requireObjectId(data.inventoryItemId, 'inventoryItemId');
  const quantity = validatePositiveQuantity(data.quantity);
  const reason = validateReason(data.reason);
  const transferId = new mongoose.Types.ObjectId();

  return runInTransaction(async (session) => {
    await ensureReferences([fromBranchId, toBranchId], inventoryItemId, session);
    const out = await applyMovementInSession({
      session,
      branchId: fromBranchId,
      inventoryItemId,
      transactionType: 'TRANSFER',
      delta: -quantity,
      reason,
      sourceType: 'TRANSFER',
      sourceId: transferId,
      transferId,
      transferLeg: 'OUT',
      actorId: resolvedActor.id,
      idempotencyKey: actor.idempotencyKey || null
    });
    const incoming = await applyMovementInSession({
      session,
      branchId: toBranchId,
      inventoryItemId,
      transactionType: 'TRANSFER',
      delta: quantity,
      reason,
      sourceType: 'TRANSFER',
      sourceId: transferId,
      transferId,
      transferLeg: 'IN',
      actorId: resolvedActor.id,
      idempotencyKey: actor.idempotencyKey || null
    });
    return {
      transferId: transferId.toString(),
      out: formatInventoryTransaction(out.transaction),
      in: formatInventoryTransaction(incoming.transaction)
    };
  });
};

export const updateThreshold = async (branchIdValue, inventoryItemIdValue, data, actor) => {
  const resolvedActor = await resolveInventoryActor(actor, ['ADMIN', 'MANAGER']);
  const branchId = assertInventoryBranchScope(resolvedActor, branchIdValue, { hideExistence: false });
  const inventoryItemId = requireObjectId(inventoryItemIdValue, 'inventoryItemId');
  const { lowStockThreshold, expectedVersion } = data;
  if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0 || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'lowStockThreshold and expectedVersion must be non-negative numbers');
  }

  return runInTransaction(async (session) => {
    await ensureReferences([branchId], inventoryItemId, session);
    const current = await InventoryStock.findOne({ branchId, inventoryItemId }).session(session);
    const currentVersion = current ? current.version : 0;
    const oldThreshold = current ? current.lowStockThreshold : 0;
    if (currentVersion !== expectedVersion) {
      throw new AppError(409, 'Conflict', ErrorCodes.CONCURRENCY_CONFLICT, 'Stock threshold was changed by another operation');
    }

    let stock;
    if (!current) {
      [stock] = await InventoryStock.create([{
        branchId,
        inventoryItemId,
        quantity: 0,
        lowStockThreshold,
        version: 1
      }], { session });
    } else {
      stock = await InventoryStock.findOneAndUpdate(
        { _id: current._id, version: expectedVersion },
        { $set: { lowStockThreshold }, $inc: { version: 1 } },
        { new: true, session, runValidators: true }
      );
      if (!stock) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONCURRENCY_CONFLICT, 'Stock threshold was changed by another operation');
      }
    }

    await AuditLog.create([{
      actor: { userId: resolvedActor.id, systemRole: resolvedActor.systemRole },
      action: 'INVENTORY_THRESHOLD_UPDATED',
      target: { type: 'InventoryStock', id: stock._id },
      metadata: {
        branchId,
        inventoryItemId,
        before: { lowStockThreshold: oldThreshold, version: currentVersion },
        after: { lowStockThreshold, version: stock.version }
      }
    }], { session });

    return formatInventoryStock(stock);
  });
};

export const listInventoryItems = async (query, actor) => {
  await resolveInventoryActor(actor, ['ADMIN', 'MANAGER', 'STAFF']);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const filter = {};
  if (query.cursor) filter._id = { $gt: requireObjectId(query.cursor, 'cursor') };
  const rows = await InventoryItem.find(filter).sort({ _id: 1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((item) => ({
    id: item._id.toString(),
    sku: item.sku,
    name: item.name,
    kind: item.kind,
    unit: item.unit,
    status: item.status
  }));
  return { items, nextCursor: hasMore ? rows[limit - 1]._id.toString() : null };
};

export const listStocks = async (query, actor) => {
  const resolvedActor = await resolveInventoryActor(actor, ['ADMIN', 'MANAGER', 'STAFF']);
  let branchIds;
  if (query.branchId) {
    branchIds = [assertInventoryBranchScope(resolvedActor, query.branchId)];
  } else {
    const scoped = inventoryBranchIdsForActor(resolvedActor);
    if (scoped === null) {
      branchIds = (await Branch.find({}).select('_id').sort({ _id: 1 }).lean()).map((branch) => branch._id.toString());
    } else {
      branchIds = scoped;
    }
  }
  if (branchIds.length === 0) return { items: [], nextCursor: null };

  const itemFilter = {};
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search.trim()), 'i');
    itemFilter.$or = [{ sku: pattern }, { name: pattern }];
  }
  const inventoryItems = await InventoryItem.find(itemFilter).select('_id').sort({ _id: 1 }).lean();
  const itemIds = inventoryItems.map((item) => item._id.toString());
  const rows = await InventoryStock.find({
    branchId: { $in: branchIds },
    inventoryItemId: { $in: itemIds }
  }).lean();
  const stockMap = new Map(rows.map((stock) => [`${stock.branchId}:${stock.inventoryItemId}`, stock]));
  let materialized = [];
  for (const branchId of branchIds.sort()) {
    for (const inventoryItemId of itemIds) {
      materialized.push(formatInventoryStock(stockMap.get(`${branchId}:${inventoryItemId}`), { branchId, inventoryItemId }));
    }
  }
  if (query.lowStock === true || query.lowStock === 'true') materialized = materialized.filter((stock) => stock.lowStock);

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const offset = query.cursor && /^\d+$/.test(query.cursor) ? Number(query.cursor) : 0;
  return {
    items: materialized.slice(offset, offset + limit),
    nextCursor: offset + limit < materialized.length ? String(offset + limit) : null
  };
};

export const listTransactions = async (query, actor) => {
  const resolvedActor = await resolveInventoryActor(actor, ['ADMIN', 'MANAGER']);
  const filter = {};
  if (query.branchId) {
    filter.branchId = assertInventoryBranchScope(resolvedActor, query.branchId);
  } else {
    const scoped = inventoryBranchIdsForActor(resolvedActor);
    if (scoped !== null) filter.branchId = { $in: scoped };
  }
  if (query.inventoryItemId) filter.inventoryItemId = requireObjectId(query.inventoryItemId, 'inventoryItemId');
  if (query.transactionType) filter.transactionType = query.transactionType;
  if (query.cursor) filter._id = { $lt: requireObjectId(query.cursor, 'cursor') };

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const rows = await InventoryTransaction.find(filter).sort({ _id: -1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map(formatInventoryTransaction),
    nextCursor: hasMore ? rows[limit - 1]._id.toString() : null
  };
};

export const issueForOrder = async ({ session, orderId, branchId, movements, actorId, reason = 'Order checkout' }) => {
  const results = [];
  for (const movement of movements) {
    results.push(await applyMovementInSession({
      session,
      branchId,
      inventoryItemId: movement.inventoryItemId,
      transactionType: 'ISSUE',
      quantity: movement.quantity,
      reason,
      sourceType: 'ORDER',
      sourceId: orderId,
      actorId: actorId || SYSTEM_ACTOR_ID
    }));
  }
  return results;
};

export const receiveForOrder = async ({ session, orderId, branchId, movements, actorId, reason = 'Order cancellation compensation' }) => {
  const results = [];
  for (const movement of movements) {
    results.push(await applyMovementInSession({
      session,
      branchId,
      inventoryItemId: movement.inventoryItemId,
      transactionType: 'RECEIPT',
      quantity: movement.quantity,
      reason,
      sourceType: 'ORDER',
      sourceId: orderId,
      actorId: actorId || SYSTEM_ACTOR_ID
    }));
  }
  return results;
};

export const applyServiceRecordDelta = async ({ session, revisionId, recordVersion, branchId, deltas, actorId }) => {
  const results = [];
  for (const item of deltas) {
    if (item.delta === 0) continue;
    results.push(await applyMovementInSession({
      session,
      branchId,
      inventoryItemId: item.inventoryItemId,
      transactionType: item.delta > 0 ? 'ISSUE' : 'ADJUSTMENT',
      delta: item.delta > 0 ? -item.delta : Math.abs(item.delta),
      reason: 'Service record material finalization',
      sourceType: 'SERVICE_RECORD_REVISION',
      sourceId: revisionId,
      recordVersion,
      actorId: actorId || SYSTEM_ACTOR_ID
    }));
  }
  return results;
};
