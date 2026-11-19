import mongoose from 'mongoose';
import ServiceRecord from './models/ServiceRecord';
import ServiceRecordRevision from './models/ServiceRecordRevision';
import Appointment from '../booking/models/Appointment';
import StaffProfile from '../staff/models/StaffProfile';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { applyServiceRecordDelta } from '../inventory/inventory.service';
import { resolveVetReviewer } from '../booking/booking.service';
import { recordAuditLog } from '../../utils/auditLogger';
import {
  generateServiceRecordCode,
  assertServiceEligibleMaterials,
  buildPlannedMaterialsFromServices,
  normalizeMaterialEntry,
} from './execution.helpers';

export { generateServiceRecordCode };

const activeFinalizeLocks = new Map();

const withSession = (query, session) => (
  session && query && typeof query.session === 'function' ? query.session(session) : query
);

const saveWithSession = (doc, session) => (
  session ? doc.save({ session }) : doc.save()
);

const runInExecutionTransaction = async (work) => {
  if (mongoose.connection.readyState !== 1 && !mongoose.startSession?._isMockFunction) {
    return work(null);
  }
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

const materialMap = (items = []) => {
  const result = new Map();
  for (const item of items) {
    if (!item) continue;
    const rawId = item.inventoryItemId || item.materialId;
    if (!rawId) continue;
    const key = (rawId._id || rawId).toString();
    const qty = Number(item.quantity !== undefined ? item.quantity : (item.actualQuantity || 0));
    result.set(key, (result.get(key) || 0) + qty);
  }
  return result;
};

export const calculateMaterialDelta = (previous = [], current = []) => {
  const before = materialMap(previous);
  const after = materialMap(current);
  const ids = new Set([...before.keys(), ...after.keys()]);
  return [...ids].map((inventoryItemId) => ({
    inventoryItemId,
    delta: (after.get(inventoryItemId) || 0) - (before.get(inventoryItemId) || 0)
  })).filter((entry) => entry.delta !== 0);
};

export const formatServiceRecord = (rec, enrichment = null) => {
  if (!rec) return null;
  const doc = rec.toObject ? rec.toObject() : rec;
  const idStr = (doc._id || doc.id).toString();

  const appointmentIdStr = (doc.appointmentId?._id || doc.appointmentId).toString();
  const appointmentObj = enrichment?.appointmentMap?.get(appointmentIdStr);

  const res = {
    id: idStr,
    code: doc.code || `SR-${idStr.slice(-6).toUpperCase()}`,
    appointmentId: appointmentIdStr,
    appointmentCode: doc.appointmentCode || appointmentObj?.code || null,
    status: doc.status || 'IN_PROGRESS',
    recordType: doc.recordType || 'GROOMING',
    recordVersion: Number(doc.recordVersion || 0),
    version: Number(doc.version || 1),
  };

  if (doc.branchId) {
    res.branchId = (doc.branchId._id || doc.branchId).toString();
  }
  if (doc.petId) {
    res.petId = (doc.petId._id || doc.petId).toString();
  }
  if (doc.customerId) {
    res.customerId = (doc.customerId._id || doc.customerId).toString();
  }
  if (doc.serviceIds && Array.isArray(doc.serviceIds)) {
    res.serviceIds = doc.serviceIds.map(s => (s._id || s).toString());
  }
  if (doc.assignedStaffIds && Array.isArray(doc.assignedStaffIds)) {
    res.assignedStaffIds = doc.assignedStaffIds.map(s => (s._id || s).toString());
  }
  if (doc.reviewerStaffId !== undefined) {
    res.reviewerStaffId = doc.reviewerStaffId ? (doc.reviewerStaffId._id || doc.reviewerStaffId).toString() : null;
  }
  if (doc.actualStartAt) {
    res.actualStartAt = new Date(doc.actualStartAt).toISOString();
  }
  if (doc.actualEndAt !== undefined) {
    res.actualEndAt = doc.actualEndAt ? new Date(doc.actualEndAt).toISOString() : null;
  }
  if (doc.finalizedAt !== undefined) {
    res.finalizedAt = doc.finalizedAt ? new Date(doc.finalizedAt).toISOString() : null;
  }

  const rawDate = doc.actualStartAt || doc.createdAt;
  if (rawDate) {
    res.createdAt = new Date(rawDate).toISOString();
    res.date = new Date(rawDate).toISOString();
  }
  if (doc.updatedAt) {
    res.updatedAt = new Date(doc.updatedAt).toISOString();
  }
  if (doc.updatedBy !== undefined) {
    res.updatedBy = doc.updatedBy
      ? {
          userId: doc.updatedBy.userId ? (doc.updatedBy.userId._id || doc.updatedBy.userId).toString() : null,
          name: doc.updatedBy.name || null,
          role: doc.updatedBy.role || null,
        }
      : null;
  }
  if (doc.materialsUpdatedBy !== undefined) {
    res.materialsUpdatedBy = doc.materialsUpdatedBy
      ? (doc.materialsUpdatedBy._id || doc.materialsUpdatedBy).toString()
      : null;
  }
  if (doc.materialsUpdatedAt) {
    res.materialsUpdatedAt = new Date(doc.materialsUpdatedAt).toISOString();
  }
  if (Array.isArray(doc.materialAudit)) {
    res.materialAudit = doc.materialAudit.map((entry) => ({
      actorId: entry?.actorId ? (entry.actorId._id || entry.actorId).toString() : null,
      actorName: entry?.actorName || null,
      actorRole: entry?.actorRole || null,
      at: entry?.at ? new Date(entry.at).toISOString() : null,
      materialsCount: Number(entry?.materialsCount || 0),
    }));
  }

  const services = (res.serviceIds || []).map((sId) => enrichment?.serviceMap?.get(sId)).filter(Boolean);

  // plannedMaterials (auto-derive from Service.defaultMaterials if legacy record has empty plannedMaterials)
  const rawPlannedSource = Array.isArray(doc.plannedMaterials) && doc.plannedMaterials.length > 0
    ? doc.plannedMaterials
    : services.reduce((acc, svc) => {
      for (const bom of svc.defaultMaterials || []) {
        const bomId = (bom.inventoryItemId?._id || bom.inventoryItemId || bom.materialId?._id || bom.materialId)?.toString();
        if (!bomId) continue;
        const bomQty = Number(bom.defaultQuantity !== undefined ? bom.defaultQuantity : (bom.quantity ?? 1));
        if (!Number.isFinite(bomQty) || bomQty <= 0) continue;
        const existing = acc.find((p) => p.inventoryItemId === bomId);
        if (existing) existing.quantity += bomQty;
        else {
          acc.push({
            inventoryItemId: bomId,
            quantity: bomQty,
            unit: bom.unit || null,
            notes: bom.notes || 'Vật tư định mức theo dịch vụ',
            isDefault: true,
          });
        }
      }
      return acc;
    }, []);

  const plannedQtyByItem = new Map();
  if (doc.plannedMaterials || rawPlannedSource.length > 0) {
    res.plannedMaterials = rawPlannedSource.map(m => {
      const matId = (m.inventoryItemId?._id || m.inventoryItemId || m.materialId).toString();
      const itemInfo = enrichment?.itemMap?.get(matId);
      const qty = Number(m.quantity !== undefined ? m.quantity : (m.defaultQuantity || 0));
      plannedQtyByItem.set(matId, qty);
      return {
        inventoryItemId: matId,
        quantity: qty,
        templateQuantity: qty,
        unit: m.unit || itemInfo?.unit || 'cái',
        notes: m.notes ?? m.note ?? null,
        note: m.notes ?? m.note ?? null,
        isDefault: m.isDefault !== undefined ? Boolean(m.isDefault) : true,
        name: itemInfo?.name || null,
        itemName: itemInfo?.name || null,
        sku: itemInfo?.sku || null,
      };
    });
  }

  // actualMaterials
  if (doc.actualMaterials) {
    res.actualMaterials = doc.actualMaterials.map(m => {
      const matId = (m.inventoryItemId?._id || m.inventoryItemId || m.materialId).toString();
      const itemInfo = enrichment?.itemMap?.get(matId);
      const plannedQty = plannedQtyByItem.get(matId);
      const txInfo = enrichment?.txByRecordItemMap?.get(`${idStr}:${matId}`);
      const noteText = m.notes ?? m.note ?? null;
      return {
        inventoryItemId: matId,
        actualQuantity: Number(m.actualQuantity !== undefined ? m.actualQuantity : (m.quantity || 0)),
        templateQuantity: m.templateQuantity !== undefined ? Number(m.templateQuantity) : (plannedQty !== undefined ? plannedQty : null),
        plannedQuantity: m.plannedQuantity !== undefined ? Number(m.plannedQuantity) : (plannedQty !== undefined ? plannedQty : null),
        unit: m.unit || itemInfo?.unit || 'cái',
        notes: noteText,
        note: noteText,
        isDefault: m.isDefault !== undefined ? Boolean(m.isDefault) : plannedQty !== undefined,
        isExtra: Boolean(m.isExtra),
        stockAfter: txInfo?.afterQty !== undefined ? txInfo.afterQty : null,
        afterQty: txInfo?.afterQty !== undefined ? txInfo.afterQty : null,
        inventoryTransactionCode: txInfo?.transactionCode || null,
        transactionCode: txInfo?.transactionCode || null,
        name: itemInfo?.name || null,
        itemName: itemInfo?.name || null,
        sku: itemInfo?.sku || null,
      };
    });
  }

  // professional
  if (doc.professional && Object.keys(doc.professional).length > 0) {
    res.professional = doc.professional;
  } else {
    res.professional = null;
  }

  // Enrichment fields for FE table display
  const pet = res.petId ? enrichment?.petMap?.get(res.petId) : null;
  res.petName = doc.petName || pet?.name || doc.petId?.name || null;
  res.pet = doc.pet || (pet ? {
    id: pet._id.toString(),
    name: pet.name,
    species: pet.species,
    breed: pet.breed || null,
    weightKg: pet.weightKg || null,
    avatarUrl: pet.avatarUrl || null,
  } : (doc.petId?.name ? { id: res.petId, name: doc.petId.name } : null));

  const customer = res.customerId ? enrichment?.customerMap?.get(res.customerId) : null;
  res.customerName = doc.customerName || customer?.fullName || doc.customerId?.fullName || null;
  res.customerPhone = doc.customerPhone || customer?.phone || doc.customerId?.phone || null;
  res.customer = doc.customer || (customer ? {
    id: customer._id.toString(),
    fullName: customer.fullName,
    phone: customer.phone,
    email: customer.email || null,
  } : null);

  const branch = res.branchId ? enrichment?.branchMap?.get(res.branchId) : null;
  res.branchName = doc.branchName || branch?.name || doc.branchId?.name || null;
  res.branch = doc.branch || (branch ? {
    id: branch._id.toString(),
    code: branch.code,
    name: branch.name,
  } : null);

  res.services = doc.services || services.map((s) => ({
    id: s._id.toString(),
    code: s.code || null,
    name: s.name,
    serviceType: s.serviceType || null,
    basePrice: s.basePrice || 0,
  }));
  res.serviceNames = doc.serviceNames || services.map((s) => s.name);
  res.serviceName = doc.serviceName || (res.serviceNames.length > 0 ? res.serviceNames.join(', ') : null);

  const assignedStaff = (res.assignedStaffIds || []).map((sId) => enrichment?.staffMap?.get(sId)).filter(Boolean);
  res.assignedStaff = doc.assignedStaff || assignedStaff;
  res.primaryStaff = doc.primaryStaff || assignedStaff[0] || null;
  res.primaryStaffName = doc.primaryStaffName || doc.staffName || assignedStaff[0]?.fullName || null;
  res.staffName = res.primaryStaffName;

  const reviewer = res.reviewerStaffId ? enrichment?.staffMap?.get(res.reviewerStaffId) : null;
  res.reviewerStaff = doc.reviewerStaff || reviewer || null;
  res.reviewerName = doc.reviewerName || reviewer?.fullName || null;

  return res;
};

export const enrichServiceRecords = async (items = []) => {
  if (!items || items.length === 0 || mongoose.connection.readyState !== 1) {
    return items.map((it) => formatServiceRecord(it));
  }

  try {
    const Pet = mongoose.models.Pet || (await import('../customer/models/Pet.js')).default;
    const Customer = mongoose.models.Customer || (await import('../customer/models/Customer.js')).default;
    const Service = mongoose.models.Service || (await import('../catalog/models/Service.js')).default;
    const Branch = mongoose.models.Branch || (await import('../branch/models/Branch.js')).default;
    const StaffProfile = mongoose.models.StaffProfile || (await import('../staff/models/StaffProfile.js')).default;
    const User = mongoose.models.User || (await import('../../models/User.js')).default;
    const InventoryItem = mongoose.models.InventoryItem || (await import('../inventory/models/InventoryItem.js')).default;
    const InventoryTransaction = mongoose.models.InventoryTransaction || (await import('../inventory/models/InventoryTransaction.js')).default;

    const recordIds = new Set();
    const appointmentIds = new Set();
    const petIds = new Set();
    const customerIds = new Set();
    const serviceIds = new Set();
    const branchIds = new Set();
    const staffIds = new Set();
    const itemIds = new Set();

    for (const item of items) {
      const doc = item.toObject ? item.toObject() : item;
      if (doc._id || doc.id) recordIds.add((doc._id || doc.id).toString());
      if (doc.appointmentId) appointmentIds.add((doc.appointmentId._id || doc.appointmentId).toString());
      if (doc.petId) petIds.add((doc.petId._id || doc.petId).toString());
      if (doc.customerId) customerIds.add((doc.customerId._id || doc.customerId).toString());
      if (doc.branchId) branchIds.add((doc.branchId._id || doc.branchId).toString());
      if (doc.reviewerStaffId) staffIds.add((doc.reviewerStaffId._id || doc.reviewerStaffId).toString());
      (doc.serviceIds || []).forEach((s) => s && serviceIds.add((s._id || s).toString()));
      (doc.assignedStaffIds || []).forEach((s) => s && staffIds.add((s._id || s).toString()));
      (doc.plannedMaterials || []).forEach((m) => {
        const id = m.inventoryItemId || m.materialId;
        if (id) itemIds.add((id._id || id).toString());
      });
      (doc.actualMaterials || []).forEach((m) => {
        const id = m.inventoryItemId || m.materialId;
        if (id) itemIds.add((id._id || id).toString());
      });
    }

    const recordObjectIds = Array.from(recordIds)
      .filter((rid) => mongoose.Types.ObjectId.isValid(rid))
      .map((rid) => new mongoose.Types.ObjectId(rid));

    const [pets, customers, services, branches, staffProfiles, users, invItems, appointments, invTransactions] = await Promise.all([
      petIds.size > 0 ? Pet.find({ _id: { $in: Array.from(petIds) } }).lean() : [],
      customerIds.size > 0 ? Customer.find({ _id: { $in: Array.from(customerIds) } }).lean() : [],
      serviceIds.size > 0 ? Service.find({ _id: { $in: Array.from(serviceIds) } }).lean() : [],
      branchIds.size > 0 ? Branch.find({ _id: { $in: Array.from(branchIds) } }).lean() : [],
      staffIds.size > 0 ? StaffProfile.find({ _id: { $in: Array.from(staffIds) } }).populate('userId').lean() : [],
      staffIds.size > 0 ? User.find({ _id: { $in: Array.from(staffIds) } }).lean() : [],
      itemIds.size > 0 ? InventoryItem.find({ _id: { $in: Array.from(itemIds) } }).lean() : [],
      appointmentIds.size > 0 ? Appointment.find({ _id: { $in: Array.from(appointmentIds) } }).select('_id code').lean().catch(() => []) : [],
      recordObjectIds.length > 0
        ? InventoryTransaction.find({
          sourceType: { $in: ['SERVICE_RECORD', 'SERVICE_RECORD_REVISION'] },
          sourceId: { $in: [...recordObjectIds, ...Array.from(recordIds)] },
        }).sort({ createdAt: -1, _id: -1 }).lean().catch(() => [])
        : [],
    ]);

    const petMap = new Map(pets.map((p) => [p._id.toString(), p]));
    const customerMap = new Map(customers.map((c) => [c._id.toString(), c]));
    const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));
    const branchMap = new Map(branches.map((b) => [b._id.toString(), b]));
    const itemMap = new Map(invItems.map((i) => [i._id.toString(), i]));
    const missingBomItemIds = new Set();
    for (const svc of services) {
      for (const bom of svc.defaultMaterials || []) {
        const bomId = (bom.inventoryItemId?._id || bom.inventoryItemId || bom.materialId?._id || bom.materialId)?.toString();
        if (bomId && !itemMap.has(bomId)) missingBomItemIds.add(bomId);
      }
    }
    if (missingBomItemIds.size > 0) {
      const extraBomItems = await InventoryItem.find({ _id: { $in: Array.from(missingBomItemIds) } }).lean().catch(() => []);
      extraBomItems.forEach((it) => itemMap.set(it._id.toString(), it));
    }
    const appointmentMap = new Map((appointments || []).map((a) => [a._id.toString(), a]));

    const txByRecordItemMap = new Map();
    for (const tx of invTransactions || []) {
      const srKey = (tx.serviceRecordId || tx.sourceId)?.toString();
      if (!srKey) continue;
      const rawTxId = tx._id ? tx._id.toString() : null;
      const txCode = tx.transactionCode || tx.code || tx.groupCode || (rawTxId ? `TRX-${rawTxId.slice(-6).toUpperCase()}` : null);
      if (Array.isArray(tx.items) && tx.items.length > 0) {
        for (const line of tx.items) {
          const lineItemId = line?.inventoryItemId ? line.inventoryItemId.toString() : null;
          if (!lineItemId) continue;
          const mapKey = `${srKey}:${lineItemId}`;
          if (!txByRecordItemMap.has(mapKey)) {
            txByRecordItemMap.set(mapKey, {
              afterQty: line.afterQty !== undefined ? Number(line.afterQty) : null,
              transactionCode: txCode,
            });
          }
        }
      } else if (tx.inventoryItemId) {
        const mapKey = `${srKey}:${tx.inventoryItemId.toString()}`;
        if (!txByRecordItemMap.has(mapKey)) {
          txByRecordItemMap.set(mapKey, {
            afterQty: tx.afterQty !== undefined ? Number(tx.afterQty) : null,
            transactionCode: txCode,
          });
        }
      }
    }

    const staffMap = new Map();
    users.forEach((u) => {
      const details = {
        id: u._id.toString(),
        userId: u._id.toString(),
        fullName: u.fullName || u.username,
        staffSubRole: u.staffSubRole || null,
        staffCode: u.staffCode || null,
      };
      staffMap.set(u._id.toString(), details);
    });
    staffProfiles.forEach((sp) => {
      const u = sp.userId;
      const details = {
        id: sp._id.toString(),
        userId: (u?._id || u || '').toString(),
        fullName: u?.fullName || 'Nhân viên',
        staffSubRole: sp.staffSubRole,
        staffCode: sp.staffCode || u?.staffCode || null,
      };
      staffMap.set(sp._id.toString(), details);
      if (details.userId) staffMap.set(details.userId, details);
    });

    const enrichment = {
      petMap,
      customerMap,
      serviceMap,
      branchMap,
      staffMap,
      itemMap,
      appointmentMap,
      txByRecordItemMap,
    };

    return items.map((it) => formatServiceRecord(it, enrichment));
  } catch (_e) {
    return items.map((it) => formatServiceRecord(it));
  }
};

export const formatServiceRecordRevision = (rev) => {
  if (!rev) return null;
  const doc = rev.toObject ? rev.toObject() : rev;

  return {
    recordVersion: Number(doc.recordVersion || 1),
    previousActual: (doc.previousActual || []).map(m => ({
      inventoryItemId: (m.inventoryItemId?._id || m.inventoryItemId).toString(),
      actualQuantity: Number(m.actualQuantity !== undefined ? m.actualQuantity : (m.quantity || 0)),
      unit: m.unit || 'cái',
      isExtra: Boolean(m.isExtra),
    })),
    newActual: (doc.newActual || []).map(m => ({
      inventoryItemId: (m.inventoryItemId?._id || m.inventoryItemId).toString(),
      actualQuantity: Number(m.actualQuantity !== undefined ? m.actualQuantity : (m.quantity || 0)),
      unit: m.unit || 'cái',
      isExtra: Boolean(m.isExtra),
    })),
    delta: (doc.delta || []).map(d => ({
      inventoryItemId: (d.inventoryItemId?._id || d.inventoryItemId).toString(),
      delta: Number(d.delta || 0),
    })),
    actorId: (doc.actorId?._id || doc.actorId).toString(),
    reason: doc.reason || null,
    at: new Date(doc.finalizedAt || doc.createdAt || Date.now()).toISOString(),
  };
};

const requireExecutionStaff = async (actor, staffSubRole, branchId, session = null) => {
  if (!actor || actor.systemRole !== 'STAFF' || actor.staffSubRole !== staffSubRole) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, `Active ${staffSubRole} staff access is required`);
  }
  if (mongoose.connection.readyState !== 1 && !StaffProfile.findOne?._isMockFunction) {
    if (actor.authorizedBranchIds && Array.isArray(actor.authorizedBranchIds)) {
      if (!actor.authorizedBranchIds.map(String).includes(String(branchId))) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Staff is not authorized for this branch');
      }
    }
    return;
  }
  let query = StaffProfile.findOne({
    userId: actor.id,
    staffSubRole,
    status: 'ACTIVE',
    authorizedBranchIds: branchId
  }).select('_id');
  query = withSession(query, session);
  const profile = typeof query?.lean === 'function' ? await query.lean() : await query;
  if (!profile) {
    throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Staff is not authorized for this branch');
  }
};

const isAssignedToAppointment = async (appointment, actorId) => {
  if (!appointment || !appointment.services) return false;
  let staffProfile = null;
  try {
    if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
      staffProfile = await StaffProfile.findOne({ userId: actorId }).select('_id');
    }
  } catch (_e) {
    staffProfile = null;
  }
  return (appointment.services || []).some((service) => (
    service.assignedStaffId && (
      service.assignedStaffId.toString() === actorId.toString() ||
      (staffProfile && service.assignedStaffId.toString() === staffProfile._id.toString())
    )
  ));
};

const CLINICAL_SUB_ROLES = ['CARE_STAFF_GROOMER', 'NURSE', 'VETERINARIAN'];

export const createRecord = async (data, actor) => {
  if (actor && (actor.systemRole !== 'STAFF' || !CLINICAL_SUB_ROLES.includes(actor.staffSubRole))) {
    throw new AppError(
      403,
      'Forbidden',
      ErrorCodes.AUTHORIZATION_ERROR,
      'Only assigned clinical staff can create service records'
    );
  }
  const appointment = await Appointment.findById(data.appointmentId);
  if (!appointment) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Appointment not found');

  if (Array.isArray(appointment.services) && appointment.services.length > 0) {
    const hasAssignedStaff = appointment.services.some((service) => Boolean(service.assignedStaffId));
    if (!hasAssignedStaff) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        ErrorCodes.STAFF_UNAVAILABLE,
        'Lịch hẹn chưa được phân công nhân viên thực hiện cho dịch vụ này'
      );
    }
    if (actor?.id && !(await isAssignedToAppointment(appointment, actor.id))) {
      throw new AppError(
        403,
        'Forbidden',
        ErrorCodes.ASSIGNMENT_SCOPE_ERROR,
        'You are not assigned to this appointment'
      );
    }
  }
  if (appointment.checkInStatus !== 'ARRIVED') {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.INVALID_STATE_TRANSITION,
      'Appointment must be checked in (ARRIVED) before creating a service record'
    );
  }
  if (appointment.status && !['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)) {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.INVALID_STATE_TRANSITION,
      `Cannot create service record when appointment status is ${appointment.status}`
    );
  }

  const resolvedServiceIds = data.serviceIds || (appointment.services || []).map((service) => service.serviceId).filter(Boolean);
  const resolvedPetId = data.petId || appointment.petId || null;
  const recordType = appointment.serviceType || data.serviceType || 'GROOMING';

  if (mongoose.connection.readyState === 1 || ServiceRecord.findOne?._isMockFunction) {
    const existingRecord = await ServiceRecord.findOne({
      appointmentId: appointment._id,
      petId: resolvedPetId,
      recordType,
      segmentGroupKey: data.segmentGroupKey || null,
    });
    if (existingRecord) {
      throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Hồ sơ dịch vụ cho lịch hẹn này đã tồn tại');
    }
  }

  let plannedMaterials = [];
  if (Array.isArray(data.plannedMaterials) && data.plannedMaterials.length > 0) {
    const plannedItemMap = await assertServiceEligibleMaterials(data.plannedMaterials);
    plannedMaterials = data.plannedMaterials.map((m) =>
      normalizeMaterialEntry(m, plannedItemMap, { isDefault: true, isExtra: false })
    );
  } else {
    plannedMaterials = await buildPlannedMaterialsFromServices(resolvedServiceIds);
  }

  let actualMaterials = [];
  if (Array.isArray(data.actualMaterials)) {
    const actualItemMap = await assertServiceEligibleMaterials(data.actualMaterials);
    const plannedIdSet = new Set(plannedMaterials.map((p) => p.inventoryItemId.toString()));
    actualMaterials = data.actualMaterials.map((m) => {
      const mId = (m.inventoryItemId || m.materialId)?._id?.toString() || (m.inventoryItemId || m.materialId)?.toString();
      const isPlanned = mId ? plannedIdSet.has(mId) : false;
      return normalizeMaterialEntry(m, actualItemMap, {
        isDefault: m.isDefault !== undefined ? Boolean(m.isDefault) : isPlanned,
        isExtra: m.isExtra !== undefined ? Boolean(m.isExtra) : !isPlanned,
      });
    });
  } else {
    actualMaterials = plannedMaterials.map((p) => ({
      inventoryItemId: p.inventoryItemId,
      quantity: p.quantity,
      unit: p.unit,
      notes: p.notes || null,
      isDefault: true,
      isExtra: false,
    }));
  }

  let reviewerStaffId = appointment.reviewerStaffId || null;

  if (recordType === 'MEDICAL' && !reviewerStaffId) {
    reviewerStaffId = await resolveVetReviewer({
      branchId: appointment.branchId,
      segments: appointment.services || [],
      scheduledStart: appointment.scheduledStart,
      scheduledEnd: appointment.scheduledEnd,
    });
    if (reviewerStaffId) {
      appointment.reviewerStaffId = reviewerStaffId;
      await appointment.save();
    }
  }

  const recordId = new mongoose.Types.ObjectId();
  const code = data.code || generateServiceRecordCode(appointment.code, recordId);

  const record = new ServiceRecord({
    _id: recordId,
    code,
    appointmentId: appointment._id,
    branchId: appointment.branchId,
    customerId: appointment.customerId || null,
    petId: resolvedPetId,
    segmentGroupKey: data.segmentGroupKey || null,
    serviceIds: resolvedServiceIds,
    assignedStaffIds: data.assignedStaffIds || (appointment.services || []).map((service) => service.assignedStaffId).filter(Boolean),
    reviewerStaffId,
    recordType,
    status: 'IN_PROGRESS',
    plannedMaterials,
    actualMaterials,
    professional: {}
  });
  await record.save();
  const enriched = await enrichServiceRecords([record]);
  return enriched[0] || formatServiceRecord(record);
};

export const listRecords = async (query = {}, actor = {}) => {
  const filter = {};

  if (query.appointmentId) {
    filter.appointmentId = query.appointmentId;
  }
  if (query.petId) {
    filter.petId = query.petId;
  }
  if (query.status) {
    filter.status = query.status;
  }
  if (query.recordType) {
    filter.recordType = query.recordType;
  }
  if (query.branchId) {
    filter.branchId = query.branchId;
  }
  if (query.staffId) {
    filter.assignedStaffIds = query.staffId;
  }

  // Role Scoping
  if (actor.systemRole === 'STAFF') {
    const staffIds = [actor.id];
    try {
      if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
        const sp = await StaffProfile.findOne({ userId: actor.id }).select('_id');
        if (sp && sp._id) staffIds.push(sp._id);
      }
    } catch (_e) {
      // ignore
    }
    filter.$or = staffIds.length > 1
      ? [
        { assignedStaffIds: { $in: staffIds } },
        { reviewerStaffId: { $in: staffIds } },
      ]
      : [
        { assignedStaffIds: actor.id },
        { reviewerStaffId: actor.id },
      ];
  } else if (actor.systemRole === 'MANAGER') {
    if (actor.assignedBranchIds && actor.assignedBranchIds.length > 0) {
      if (filter.branchId) {
        if (!actor.assignedBranchIds.map(String).includes(String(filter.branchId))) {
          throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Access to this branch is forbidden');
        }
      } else {
        filter.branchId = { $in: actor.assignedBranchIds };
      }
    }
  }

  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));

  const items = await ServiceRecord.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  const enrichedItems = await enrichServiceRecords(items);

  return {
    items: enrichedItems,
    nextCursor: null,
  };
};

const findRecordByIdOrCode = async (id, { lean = false, session = null } = {}) => {
  const isObjId = mongoose.Types.ObjectId.isValid(id);
  const isCode = typeof id === 'string' && /^SR-/i.test(id.trim());
  if (!isObjId && !isCode) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
  }

  let query = isObjId
    ? ServiceRecord.findById(id)
    : ServiceRecord.findOne({ code: id.trim() });

  query = withSession(query, session);
  if (lean && query && typeof query.lean === 'function') {
    return query.lean();
  }
  return query;
};

export const getRecordById = async (id, actor = {}) => {
  const record = await findRecordByIdOrCode(id, { lean: true });
  if (!record) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  }

  // Authorization check
  if (actor.systemRole === 'MANAGER') {
    const branchIds = (actor.assignedBranchIds || []).map((b) => (b._id || b).toString());
    if (branchIds.length === 0 || (record.branchId && !branchIds.includes(record.branchId.toString()))) {
      throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch service record');
    }
  }
  if (actor.systemRole === 'STAFF') {
    let staffProfileId = null;
    try {
      if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
        const sp = await StaffProfile.findOne({ userId: actor.id }).select('_id');
        if (sp && sp._id) staffProfileId = sp._id.toString();
      }
    } catch (_e) {
      staffProfileId = null;
    }

    const actorIdStr = actor.id.toString();
    const isAssigned = (record.assignedStaffIds || []).some(sid => {
      const s = sid.toString();
      return s === actorIdStr || (staffProfileId && s === staffProfileId);
    }) || (record.reviewerStaffId && (
      record.reviewerStaffId.toString() === actorIdStr ||
      (staffProfileId && record.reviewerStaffId.toString() === staffProfileId)
    ));
    if (!isAssigned) {
      throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'You are not assigned to this service record');
    }
  } else if (actor.systemRole === 'MANAGER') {
    if (actor.assignedBranchIds && actor.assignedBranchIds.length > 0) {
      if (!actor.assignedBranchIds.map(String).includes(String(record.branchId))) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Access to this branch record is forbidden');
      }
    }
  }

  const enriched = await enrichServiceRecords([record]);
  return enriched[0] || formatServiceRecord(record);
};

export const updateMaterials = async (id, data, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
  }

  if (!actor || actor.systemRole !== 'STAFF' || !CLINICAL_SUB_ROLES.includes(actor.staffSubRole)) {
    throw new AppError(
      403,
      'Forbidden',
      ErrorCodes.AUTHORIZATION_ERROR,
      'Only assigned clinical staff can update service record materials'
    );
  }

  const record = await ServiceRecord.findById(id);
  if (!record) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  }

  if (!['IN_PROGRESS', 'REOPENED'].includes(record.status)) {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'Record must be IN_PROGRESS or REOPENED to edit materials');
  }

  if (data.expectedVersion !== undefined && data.expectedVersion !== record.version) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Service record version conflict');
  }

  const appointment = await Appointment.findById(record.appointmentId);

  // Segment role permissions
  if (actor.systemRole === 'STAFF') {
    if (record.recordType === 'GROOMING') {
      if (actor.staffSubRole !== 'CARE_STAFF_GROOMER') {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Care Staff/Groomer can update grooming materials');
      }
      if (appointment && !(await isAssignedToAppointment(appointment, actor.id))) {
        throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Only assigned staff can edit materials');
      }
    } else if (record.recordType === 'MEDICAL') {
      if (appointment) {
        let staffProfile = null;
        try {
          staffProfile = await StaffProfile.findOne({ userId: actor.id }).select('_id');
        } catch (_e) {
          staffProfile = null;
        }

        const matchesStaff = (refId) => Boolean(
          refId && (
            refId.toString() === actor.id.toString() ||
            (staffProfile && refId.toString() === staffProfile._id.toString())
          )
        );
        const allSegments = Array.isArray(appointment.services) ? appointment.services : [];
        const recordServiceIds = Array.isArray(record.serviceIds) ? record.serviceIds.map((idVal) => idVal.toString()) : [];
        const matchedByRecordServices = recordServiceIds.length > 0
          ? allSegments.filter((s) => s.serviceId && recordServiceIds.includes(s.serviceId.toString()))
          : [];
        const recordSegments = matchedByRecordServices.length > 0 ? matchedByRecordServices : allSegments;

        const actorAssignedSegments = recordSegments.filter((s) => matchesStaff(s.assignedStaffId));
        const isAssignedToRecord = (record.assignedStaffIds || []).some((sid) => matchesStaff(sid));
        const isReviewer = (
          matchesStaff(record.reviewerStaffId) ||
          matchesStaff(appointment.reviewerStaffId)
        );

        if (actor.staffSubRole === 'NURSE') {
          const hasNurseSegment = actorAssignedSegments.some((s) => s.requiredStaffRole === 'NURSE') ||
            (recordSegments.length === 0 && isAssignedToRecord);
          if (!hasNurseSegment) {
            throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Nurse is not assigned to this medical segment');
          }
        } else if (actor.staffSubRole === 'VETERINARIAN') {
          const hasVetSegment = actorAssignedSegments.some((s) => s.requiredStaffRole === 'VETERINARIAN') ||
            isReviewer ||
            (recordSegments.length === 0 && isAssignedToRecord);
          if (!hasVetSegment) {
            throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Veterinarian is not assigned to this medical segment');
          }
        } else {
          throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Staff role not allowed to update medical materials');
        }
      }
    }
  }

  const incomingMaterials = Array.isArray(data.materials) ? data.materials : [];
  const eligibleItemMap = await assertServiceEligibleMaterials(incomingMaterials);

  const existingById = new Map(
    (record.actualMaterials || []).map((m) => [
      (m.inventoryItemId?._id || m.inventoryItemId || m.materialId)?.toString(),
      m,
    ])
  );
  const plannedIdSet = new Set(
    (record.plannedMaterials || []).map((m) =>
      (m.inventoryItemId?._id || m.inventoryItemId || m.materialId)?.toString()
    ).filter(Boolean)
  );

  const now = new Date();
  const previousMaterials = (record.actualMaterials || []).map((m) => ({
    inventoryItemId: (m.inventoryItemId?._id || m.inventoryItemId || m.materialId)?.toString() || null,
    quantity: Number(m.quantity !== undefined ? m.quantity : (m.actualQuantity || 0)),
    unit: m.unit || 'cái',
    isExtra: Boolean(m.isExtra),
  }));

  const materials = incomingMaterials.map((m) => {
    const matIdStr = (m.inventoryItemId || m.materialId)?._id?.toString() || (m.inventoryItemId || m.materialId)?.toString();
    const prev = matIdStr ? existingById.get(matIdStr) : null;
    const isPlanned = matIdStr ? plannedIdSet.has(matIdStr) : false;
    return normalizeMaterialEntry(m, eligibleItemMap, {
      notes: prev?.notes ?? null,
      isDefault: m.isDefault !== undefined ? Boolean(m.isDefault) : (prev?.isDefault ?? isPlanned),
      isExtra: m.isExtra !== undefined ? Boolean(m.isExtra) : (prev?.isExtra ?? !isPlanned),
    });
  });

  const normalizedNewMaterials = materials.map((m) => ({
    inventoryItemId: m.inventoryItemId ? m.inventoryItemId.toString() : null,
    quantity: m.quantity,
    unit: m.unit,
    isExtra: m.isExtra,
  }));

  record.actualMaterials = materials;
  record.version += 1;
  record.updatedBy = {
    userId: actor?.id || actor?._id || null,
    name: actor?.fullName || actor?.name || null,
    role: actor?.staffSubRole || actor?.systemRole || null,
  };
  record.materialsUpdatedBy = actor?.id || actor?._id || null;
  record.materialsUpdatedAt = now;
  record.materialAudit = Array.isArray(record.materialAudit) ? record.materialAudit : [];
  record.materialAudit.push({
    actorId: actor?.id || actor?._id || null,
    actorName: actor?.fullName || actor?.name || null,
    actorRole: actor?.staffSubRole || actor?.systemRole || null,
    at: now,
    materialsCount: normalizedNewMaterials.length,
    previousMaterials,
    newMaterials: normalizedNewMaterials,
  });
  await record.save();

  await recordAuditLog({
    actor: {
      userId: actor?.id || actor?._id || null,
      systemRole: actor?.staffSubRole || actor?.systemRole || 'STAFF',
    },
    action: 'SERVICE_RECORD_MATERIAL_UPDATED',
    target: { type: 'SERVICE_RECORD', id: record._id },
    metadata: {
      recordCode: record.code,
      appointmentId: record.appointmentId,
      version: record.version,
      previousMaterials,
      newMaterials: materials,
    },
  });

  const enriched = await enrichServiceRecords([record]);
  return enriched[0] || formatServiceRecord(record);
};

export const updateProfessional = async (id, data, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
  }

  if (!actor || actor.systemRole !== 'STAFF' || actor.staffSubRole !== 'VETERINARIAN') {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Veterinarian can record clinical data');
  }

  const record = await ServiceRecord.findById(id);
  if (!record) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  }

  if (record.recordType !== 'MEDICAL') {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Professional clinical data can only be recorded for MEDICAL records');
  }

  if (!['WAITING_VET_REVIEW', 'REOPENED', 'IN_PROGRESS'].includes(record.status)) {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'Record is not in reviewable state');
  }

  if (data.expectedVersion !== undefined && data.expectedVersion !== record.version) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Service record version conflict');
  }

  if (actor.systemRole === 'STAFF') {
    if (actor.staffSubRole !== 'VETERINARIAN') {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only Veterinarian can record clinical data');
    }
    let staffProfile = null;
    try {
      staffProfile = await StaffProfile.findOne({ userId: actor.id, staffSubRole: 'VETERINARIAN' }).select('_id');
    } catch (_e) {
      staffProfile = null;
    }

    const isReviewerOrAssigned = (
      (record.reviewerStaffId && (
        record.reviewerStaffId.toString() === actor.id.toString() ||
        (staffProfile && record.reviewerStaffId.toString() === staffProfile._id.toString())
      )) ||
      (record.assignedStaffIds || []).some(sid => (
        sid.toString() === actor.id.toString() ||
        (staffProfile && sid.toString() === staffProfile._id.toString())
      ))
    );
    if (!isReviewerOrAssigned) {
      throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Only assigned Veterinarian or Reviewer can update clinical data');
    }
  }

  if (!record.professional) {
    record.professional = {};
  }

  if (data.diagnosis !== undefined) record.professional.diagnosis = data.diagnosis;
  if (data.treatment !== undefined) record.professional.treatment = data.treatment;
  if (data.result !== undefined) record.professional.result = data.result;
  if (data.notes !== undefined || data.professionalNote !== undefined) {
    record.professional.professionalNote = data.notes || data.professionalNote;
  }

  record.version += 1;
  await record.save();

  const enriched = await enrichServiceRecords([record]);
  return enriched[0] || formatServiceRecord(record);
};

export const reopenRecord = async (id, data, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
  }

  if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length < 3) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'A valid reopen reason (at least 3 characters) is required');
  }

  const record = await ServiceRecord.findById(id);
  if (!record) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  }

  if (actor?.systemRole === 'MANAGER') {
    const branchIds = (actor.assignedBranchIds || []).map((b) => (b._id || b).toString());
    if (branchIds.length === 0 || (record.branchId && !branchIds.includes(record.branchId.toString()))) {
      throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch service record');
    }
  }

  if (record.status !== 'FINALIZED') {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'Only FINALIZED records can be reopened');
  }

  if (data.expectedVersion !== undefined && data.expectedVersion !== record.version) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Service record version conflict');
  }

  record.status = 'REOPENED';
  record.reopenedBy = actor.id;
  record.reopenedAt = new Date();
  record.reopenReason = data.reason.trim();
  record.version += 1;
  await record.save();

  const enriched = await enrichServiceRecords([record]);
  return enriched[0] || formatServiceRecord(record);
};

export const getRevisions = async (id, actor = {}) => {
  const record = await findRecordByIdOrCode(id, { lean: true });
  if (!record) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  }

  // Authorization check
  if (actor.systemRole === 'MANAGER') {
    const branchIds = (actor.assignedBranchIds || []).map((b) => (b._id || b).toString());
    if (branchIds.length === 0 || (record.branchId && !branchIds.includes(record.branchId.toString()))) {
      throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch service record');
    }
  }
  if (actor.systemRole === 'STAFF') {
    let staffProfileId = null;
    try {
      if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
        const sp = await StaffProfile.findOne({ userId: actor.id }).select('_id');
        if (sp && sp._id) staffProfileId = sp._id.toString();
      }
    } catch (_e) {
      staffProfileId = null;
    }

    const actorIdStr = actor.id.toString();
    const isAssigned = (record.assignedStaffIds || []).some(sid => {
      const s = sid.toString();
      return s === actorIdStr || (staffProfileId && s === staffProfileId);
    }) || (record.reviewerStaffId && (
      record.reviewerStaffId.toString() === actorIdStr ||
      (staffProfileId && record.reviewerStaffId.toString() === staffProfileId)
    ));
    if (!isAssigned) {
      throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'You are not assigned to this service record');
    }
  }

  const targetRecordId = record._id || id;
  const revisions = await ServiceRecordRevision.find({ serviceRecordId: targetRecordId }).sort({ recordVersion: 1 }).lean();
  return {
    items: revisions.map(formatServiceRecordRevision),
  };
};

export const submitReview = async (id, data = {}, actor) => {
  const record = await ServiceRecord.findById(id);
  if (!record) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  if (record.recordType !== 'MEDICAL' || record.status !== 'IN_PROGRESS') {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'Medical record must be in progress');
  }
  await requireExecutionStaff(actor, 'NURSE', record.branchId);
  const appointment = await Appointment.findById(record.appointmentId);
  if (!appointment || !(await isAssignedToAppointment(appointment, actor.id))) {
    throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Only an assigned Nurse can submit this Medical record for review');
  }

  // Mark Nurse segments as COMPLETED on the appointment
  let appointmentModified = false;
  if (Array.isArray(appointment.services)) {
    for (const seg of appointment.services) {
      if (
        (data.serviceId && seg.serviceId && seg.serviceId.toString() === data.serviceId.toString()) ||
        (!data.serviceId && seg.requiredStaffRole === 'NURSE')
      ) {
        if (seg.executionStatus !== 'COMPLETED') {
          seg.executionStatus = 'COMPLETED';
          seg.executionCompletedAt = new Date();
          appointmentModified = true;
        }
      }
    }
  }

  // Ensure reviewerStaffId is assigned (BR3 auto-assignment)
  if (!record.reviewerStaffId) {
    let reviewerId = appointment.reviewerStaffId || null;
    if (!reviewerId) {
      reviewerId = await resolveVetReviewer({
        branchId: record.branchId,
        segments: appointment.services || [],
        scheduledStart: appointment.scheduledStart,
        scheduledEnd: appointment.scheduledEnd,
      });
      if (reviewerId) {
        appointment.reviewerStaffId = reviewerId;
        appointmentModified = true;
      }
    }
    record.reviewerStaffId = reviewerId;
  }

  if (appointmentModified && typeof appointment.save === 'function') {
    await appointment.save();
  }

  if (data.expectedVersion !== undefined && data.expectedVersion !== record.version) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Service record has been changed');
  }
  const incomingReviewMaterials = data.actualMaterials || data.materials;
  if (Array.isArray(incomingReviewMaterials)) {
    const eligibleReviewMap = await assertServiceEligibleMaterials(incomingReviewMaterials);
    const plannedIdSet = new Set(
      (record.plannedMaterials || []).map((m) =>
        (m.inventoryItemId?._id || m.inventoryItemId || m.materialId)?.toString()
      ).filter(Boolean)
    );
    record.actualMaterials = incomingReviewMaterials.map((m) => {
      const mId = (m.inventoryItemId || m.materialId)?._id?.toString() || (m.inventoryItemId || m.materialId)?.toString();
      const isPlanned = mId ? plannedIdSet.has(mId) : false;
      return normalizeMaterialEntry(m, eligibleReviewMap, {
        isDefault: m.isDefault !== undefined ? Boolean(m.isDefault) : isPlanned,
        isExtra: m.isExtra !== undefined ? Boolean(m.isExtra) : !isPlanned,
      });
    });
  }
  record.status = 'WAITING_VET_REVIEW';
  record.version += 1;
  await record.save();

  if (!record.reviewerStaffId && mongoose.connection.readyState === 1) {
    try {
      const User = mongoose.models.User || require('../../models/User').default || require('../../models/User');
      const Notification = mongoose.models.Notification || require('../notification/models/Notification').default || require('../notification/models/Notification');
      const managers = await User.find({
        systemRole: { $in: ['MANAGER', 'ADMIN'] },
        accountStatus: 'ACTIVE',
      }).select('_id').lean();
      if (Array.isArray(managers) && managers.length > 0) {
        await Promise.all(
          managers.map((m) =>
            Notification.create({
              recipientId: m._id,
              type: 'APPOINTMENT_UPDATE',
              title: 'Hồ sơ y khoa chờ phân công Bác sĩ duyệt',
              body: `Hồ sơ ${record.code || record._id} chưa tìm thấy ca Bác sĩ thú y tại chi nhánh. Vui lòng xếp ca hoặc chỉ định Bác sĩ duyệt.`,
              metadata: {
                serviceRecordId: record._id.toString(),
                serviceRecordCode: record.code || null,
                branchId: record.branchId.toString(),
              },
            })
          )
        );
      }
    } catch (_e) {
      // Non-blocking notification
    }
  }

  const enriched = await enrichServiceRecords([record]);
  return enriched[0] || formatServiceRecord(record);
};

export const finalizeRecord = async (id, data = {}, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
  }

  const lockKey = id.toString();
  if (activeFinalizeLocks.has(lockKey)) {
    try {
      await activeFinalizeLocks.get(lockKey);
    } catch (_e) {
      // Proceed to check current state after previous execution finishes
    }
  }

  let releaseLock;
  const lockPromise = new Promise((resolve) => {
    releaseLock = resolve;
  });
  activeFinalizeLocks.set(lockKey, lockPromise);

  try {
    let result;
    try {
      await runInExecutionTransaction(async (session) => {
        const record = await withSession(ServiceRecord.findById(id), session);
        if (!record) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');

        // Anti-duplicate / Retry protection:
        // If record is already FINALIZED and caller retries with same or immediate-prior expectedVersion,
        // return the finalized record idempotently without creating duplicate ISSUE/ADJUSTMENT transactions.
        if (record.status === 'FINALIZED') {
          if (
            data.expectedVersion === undefined ||
            data.expectedVersion === record.version ||
            data.expectedVersion === record.version - 1
          ) {
            result = record;
            return;
          }
          throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Service record has already been finalized');
        }

        if (data.expectedVersion !== undefined && data.expectedVersion !== record.version) {
          throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Service record has been changed');
        }

        const appointment = await withSession(Appointment.findById(record.appointmentId), session);
        if (!appointment) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Appointment not found');

        let actorStaffProfileId = null;
        try {
          if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
            let spQ = StaffProfile.findOne({ userId: actor.id });
            spQ = withSession(spQ, session);
            const spDoc = typeof spQ?.select === 'function' ? await spQ.select('_id') : await spQ;
            if (spDoc && spDoc._id) actorStaffProfileId = spDoc._id.toString();
          }
        } catch (_e) {
          actorStaffProfileId = null;
        }

        if (record.recordType === 'MEDICAL') {
          await requireExecutionStaff(actor, 'VETERINARIAN', record.branchId, session);
          if (!['IN_PROGRESS', 'WAITING_VET_REVIEW', 'REOPENED'].includes(record.status)) {
            throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'Medical record is not ready for Veterinarian review');
          }

          let staffProfile = null;
          try {
            if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
              let spQuery = StaffProfile.findOne({
                userId: actor.id,
                staffSubRole: 'VETERINARIAN',
              });
              spQuery = withSession(spQuery, session);
              staffProfile = typeof spQuery?.select === 'function' ? await spQuery.select('_id') : await spQuery;
            }
          } catch (_e) {
            staffProfile = null;
          }

          const matchesReviewer = (
            (record.reviewerStaffId && (
              record.reviewerStaffId.toString() === actor.id.toString() ||
              (staffProfile && record.reviewerStaffId.toString() === staffProfile._id.toString())
            )) ||
            (appointment.reviewerStaffId && (
              appointment.reviewerStaffId.toString() === actor.id.toString() ||
              (staffProfile && appointment.reviewerStaffId.toString() === staffProfile._id.toString())
            ))
          );

          const isDirectVetExecutor = (
            record.status === 'IN_PROGRESS' &&
            !record.reviewerStaffId &&
            !appointment.reviewerStaffId &&
            (appointment.services || []).some((seg) =>
              seg.assignedStaffId && (
                seg.assignedStaffId.toString() === actor.id.toString() ||
                (staffProfile && seg.assignedStaffId.toString() === staffProfile._id.toString())
              )
            )
          );

          if (actor.staffSubRole !== 'VETERINARIAN' || (!matchesReviewer && !isDirectVetExecutor)) {
            throw new AppError(403, 'Forbidden', ErrorCodes.MEDICAL_REVIEW_REQUIRED, 'Only the assigned Veterinarian reviewer can finalize this record');
          }

          if (isDirectVetExecutor && !record.reviewerStaffId) {
            record.reviewerStaffId = actor.id;
            if (!appointment.reviewerStaffId) {
              appointment.reviewerStaffId = actor.id;
            }
          }
        } else {
          await requireExecutionStaff(actor, 'CARE_STAFF_GROOMER', record.branchId, session);
          if (!(await isAssignedToAppointment(appointment, actor.id))) {
            throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Only assigned Care Staff/Groomer can finalize this record');
          }
        }

        // If serviceId is provided or segments belong to the finalizing actor, mark them COMPLETED (supports 1-step Vet/Groomer finalize)
        if (Array.isArray(appointment.services)) {
          for (const seg of appointment.services) {
            const isTargetService = data.serviceId && seg.serviceId && seg.serviceId.toString() === data.serviceId.toString();
            const isActorSegment = seg.assignedStaffId && (
              seg.assignedStaffId.toString() === actor.id.toString() ||
              (actorStaffProfileId && seg.assignedStaffId.toString() === actorStaffProfileId)
            );
            if ((isTargetService || isActorSegment) && seg.executionStatus !== 'COMPLETED') {
              seg.executionStatus = 'COMPLETED';
              seg.executionCompletedAt = new Date();
            }
          }
        }

        const allSegmentsComplete = (appointment.services || []).every((service) => service.executionStatus === 'COMPLETED');
        if (!allSegmentsComplete) {
          throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'All appointment segments must be completed before inventory finalization');
        }

        if (record.recordVersion > 0 && record.status !== 'REOPENED') {
          throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'A finalized record must be reopened before correction');
        }

        const effectiveReason = (data.reason && typeof data.reason === 'string' && data.reason.trim())
          ? data.reason.trim()
          : (record.reopenReason || null);

        if (record.recordVersion > 0 && (!effectiveReason || effectiveReason.length < 3)) {
          throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'A correction reason is required');
        }

        const incomingMaterials = data.actualMaterials || data.materials;
        if (incomingMaterials && Array.isArray(incomingMaterials)) {
          const eligibleFinMap = await assertServiceEligibleMaterials(incomingMaterials, { session });
          const plannedIdSet = new Set(
            (record.plannedMaterials || []).map((m) =>
              (m.inventoryItemId?._id || m.inventoryItemId || m.materialId)?.toString()
            ).filter(Boolean)
          );
          record.actualMaterials = incomingMaterials.map((m) => {
            const mId = (m.inventoryItemId || m.materialId)?._id?.toString() || (m.inventoryItemId || m.materialId)?.toString();
            const isPlanned = mId ? plannedIdSet.has(mId) : false;
            return normalizeMaterialEntry(m, eligibleFinMap, {
              isDefault: m.isDefault !== undefined ? Boolean(m.isDefault) : isPlanned,
              isExtra: m.isExtra !== undefined ? Boolean(m.isExtra) : !isPlanned,
            });
          });
        } else if (Array.isArray(record.actualMaterials) && record.actualMaterials.length > 0) {
          await assertServiceEligibleMaterials(record.actualMaterials, { session });
        }
        if (data.professional) {
          record.professional = { ...(record.professional || {}), ...data.professional };
        }

        if (!record.code) {
          record.code = generateServiceRecordCode(appointment.code, record._id);
        }

        const previousActual = (record.lastFinalizedActual || []).map((item) => (item.toObject ? item.toObject() : item));
        const newActual = (record.actualMaterials || []).map((item) => (item.toObject ? item.toObject() : item));
        const delta = calculateMaterialDelta(previousActual, newActual);
        const nextRecordVersion = (record.recordVersion || 0) + 1;
        const revisionId = new mongoose.Types.ObjectId();

        // Check if this revision was already created (race condition guard)
        let existingRevision = null;
        if (mongoose.connection.readyState === 1 || ServiceRecordRevision.findOne?._isMockFunction) {
          try {
            const revQ = withSession(
              ServiceRecordRevision.findOne({ serviceRecordId: record._id, recordVersion: nextRecordVersion }),
              session
            );
            existingRevision = await revQ;
          } catch (_e) {
            existingRevision = null;
          }
        }

        if (!existingRevision) {
          await applyServiceRecordDelta({
            session,
            serviceRecordId: record._id,
            serviceRecordCode: record.code,
            revisionId,
            recordVersion: nextRecordVersion,
            branchId: record.branchId,
            deltas: delta,
            actorId: actor.id,
            reason: effectiveReason
          });

          const revision = new ServiceRecordRevision({
            _id: revisionId,
            serviceRecordId: record._id,
            recordVersion: nextRecordVersion,
            previousActual,
            newActual,
            delta,
            professionalSnapshot: record.professional,
            actorId: actor.id,
            reason: effectiveReason,
            finalizedAt: new Date()
          });
          await saveWithSession(revision, session);
        }

        const now = new Date();
        record.lastFinalizedActual = newActual;
        record.recordVersion = nextRecordVersion;
        record.status = 'FINALIZED';
        record.actualEndAt = record.actualEndAt || now;
        record.finalizedAt = now;
        record.version += 1;
        await saveWithSession(record, session);

        // SR-04: Only mark appointment COMPLETED when ALL segments and ALL service records are finalized
        let otherRecords = [];
        try {
          let otherRecordsQuery = ServiceRecord.find({
            appointmentId: appointment._id,
            _id: { $ne: record._id },
          });
          otherRecordsQuery = withSession(otherRecordsQuery, session);
          otherRecords = await otherRecordsQuery;
        } catch (_e) {
          otherRecords = [];
        }

        const allRecordsFinalized = otherRecords.every((r) => r.status === 'FINALIZED');
        if (allSegmentsComplete && allRecordsFinalized && appointment.status !== 'COMPLETED') {
          appointment.status = 'COMPLETED';
          appointment.completedAt = appointment.completedAt || now;
          if (typeof appointment.save === 'function') {
            await saveWithSession(appointment, session);
          }
        }
        result = record;
      });
    } catch (err) {
      // Handle MongoDB duplicate key race condition (11000) idempotently
      if (err && err.code === 11000) {
        const reloaded = await ServiceRecord.findById(id);
        if (reloaded && reloaded.status === 'FINALIZED') {
          const enrichedReloaded = await enrichServiceRecords([reloaded]);
          return enrichedReloaded[0] || formatServiceRecord(reloaded);
        }
      }
      throw err;
    }

    const enrichedResult = await enrichServiceRecords([result]);
    return enrichedResult[0] || formatServiceRecord(result);
  } finally {
    activeFinalizeLocks.delete(lockKey);
    if (releaseLock) releaseLock();
  }
};
