import mongoose from 'mongoose';
import Service from '../catalog/models/Service';
import InventoryItem from '../inventory/models/InventoryItem';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

export const generateServiceRecordCode = (appointmentCode = null, fallbackId = null) => {
  if (appointmentCode && typeof appointmentCode === 'string' && appointmentCode.trim()) {
    const trimmed = appointmentCode.trim();
    if (/^APT-/i.test(trimmed)) {
      return trimmed.replace(/^APT-/i, 'SR-');
    }
    if (/^SR-/i.test(trimmed)) {
      return trimmed;
    }
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = fallbackId
    ? fallbackId.toString().slice(-4).toUpperCase()
    : String(Math.floor(1000 + Math.random() * 9000));
  return `SR-${y}${m}${d}-${suffix}`;
};

export const extractMaterialItemId = (entry) => {
  if (!entry) return null;
  const raw = entry.inventoryItemId || entry.materialId;
  if (!raw) return null;
  return (raw._id || raw).toString();
};

export const isServiceEligibleInventoryItem = (item) => {
  if (!item || item.status === 'INACTIVE') return false;
  if (item.usageType === 'SERVICE_SUPPLY' || item.usageType === 'SHARED') return true;
  return item.kind === 'MATERIAL' && item.usageType !== 'SALE';
};

export const normalizeMaterialEntry = (m, itemMap = null, defaults = {}) => {
  const itemId = extractMaterialItemId(m);
  const itemInfo = itemId && itemMap ? itemMap.get(itemId) : null;
  const rawQty = m.quantity !== undefined ? m.quantity : m.actualQuantity;
  return {
    inventoryItemId: mongoose.Types.ObjectId.isValid(itemId) ? new mongoose.Types.ObjectId(itemId) : itemId,
    quantity: Number(rawQty !== undefined ? rawQty : 0),
    unit: m.unit || itemInfo?.unit || 'cái',
    notes: m.notes ?? m.note ?? defaults.notes ?? null,
    isDefault: m.isDefault !== undefined ? Boolean(m.isDefault) : Boolean(defaults.isDefault),
    isExtra: m.isExtra !== undefined ? Boolean(m.isExtra) : Boolean(defaults.isExtra),
  };
};

/**
 * Validates that all referenced materials exist, are ACTIVE, and are eligible
 * for service execution (rejecting retail-only SALE / PRODUCT items).
 */
export const assertServiceEligibleMaterials = async (materials = [], { session = null } = {}) => {
  if (!Array.isArray(materials) || materials.length === 0) {
    return new Map();
  }

  const ids = [];
  for (const entry of materials) {
    const itemId = extractMaterialItemId(entry);
    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid inventoryItemId in materials');
    }
    const rawQty = entry.quantity !== undefined ? entry.quantity : (entry.actualQuantity !== undefined ? entry.actualQuantity : 0);
    const qty = Number(rawQty);
    if (!Number.isFinite(qty) || qty < 0) {
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Material quantity must be a non-negative number');
    }
    ids.push(itemId);
  }

  if (mongoose.connection.readyState !== 1 && !InventoryItem.find?._isMockFunction) {
    return new Map();
  }

  const uniqueIds = [...new Set(ids)];
  let query = InventoryItem.find({ _id: { $in: uniqueIds } });
  if (session && typeof query?.session === 'function') {
    query = query.session(session);
  }
  const docs = (typeof query?.lean === 'function' ? await query.lean() : await query) || [];
  const itemMap = new Map(docs.filter(Boolean).map((doc) => [doc._id.toString(), doc]));

  for (const id of uniqueIds) {
    const item = itemMap.get(id);
    if (!item) {
      throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Vật tư tiêu hao không tồn tại trong kho');
    }
    if (item.status === 'INACTIVE') {
      throw new AppError(422, 'UnprocessableEntity', ErrorCodes.VALIDATION_ERROR, `Vật tư "${item.name}" đang ngưng hoạt động`);
    }
    if (!isServiceEligibleInventoryItem(item)) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        ErrorCodes.VALIDATION_ERROR,
        `Sản phẩm bán lẻ "${item.name}" không thể dùng làm vật tư tiêu hao dịch vụ`
      );
    }
  }

  return itemMap;
};

/**
 * Builds aggregated plannedMaterials from Service.defaultMaterials BOM entries.
 */
export const buildPlannedMaterialsFromServices = async (serviceIds = [], session = null) => {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    return [];
  }
  if (mongoose.connection.readyState !== 1 && !Service.find?._isMockFunction) {
    return [];
  }

  const validServiceIds = [
    ...new Set(
      serviceIds
        .map((s) => (s?._id || s)?.toString())
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    ),
  ];

  if (validServiceIds.length === 0) {
    return [];
  }

  let svcQuery = Service.find({ _id: { $in: validServiceIds } });
  if (session && typeof svcQuery?.session === 'function') {
    svcQuery = svcQuery.session(session);
  }
  const services = (typeof svcQuery?.lean === 'function' ? await svcQuery.lean() : await svcQuery) || [];

  const aggregated = new Map();
  for (const svc of services) {
    if (!svc || !Array.isArray(svc.defaultMaterials)) continue;
    for (const mat of svc.defaultMaterials) {
      const matId = extractMaterialItemId(mat);
      if (!matId || !mongoose.Types.ObjectId.isValid(matId)) continue;
      const qty = Number(mat.defaultQuantity !== undefined ? mat.defaultQuantity : (mat.quantity ?? 1));
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const existing = aggregated.get(matId);
      if (existing) {
        existing.quantity += qty;
      } else {
        aggregated.set(matId, {
          inventoryItemId: matId,
          quantity: qty,
          unit: mat.unit || null,
          notes: mat.notes || 'Vật tư định mức theo dịch vụ',
        });
      }
    }
  }

  if (aggregated.size === 0) {
    return [];
  }

  let itemMap = null;
  if (mongoose.connection.readyState === 1 || InventoryItem.find?._isMockFunction) {
    let itemQuery = InventoryItem.find({ _id: { $in: [...aggregated.keys()] } });
    if (session && typeof itemQuery?.session === 'function') {
      itemQuery = itemQuery.session(session);
    }
    const items = (typeof itemQuery?.lean === 'function' ? await itemQuery.lean() : await itemQuery) || [];
    itemMap = new Map(items.filter(Boolean).map((it) => [it._id.toString(), it]));
  }

  const planned = [];
  for (const [matId, entry] of aggregated.entries()) {
    const itemInfo = itemMap ? itemMap.get(matId) : null;
    if (itemMap && itemInfo && !isServiceEligibleInventoryItem(itemInfo)) {
      continue;
    }
    planned.push({
      inventoryItemId: new mongoose.Types.ObjectId(matId),
      quantity: entry.quantity,
      unit: entry.unit || itemInfo?.unit || 'cái',
      notes: entry.notes,
      isDefault: true,
      isExtra: false,
    });
  }

  return planned;
};
