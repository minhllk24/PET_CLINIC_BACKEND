import mongoose from 'mongoose';
import ServiceRecord from './models/ServiceRecord';
import ServiceRecordRevision from './models/ServiceRecordRevision';
import Appointment from '../booking/models/Appointment';
import StaffProfile from '../staff/models/StaffProfile';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { applyServiceRecordDelta } from '../inventory/inventory.service';

const materialMap = (items = []) => {
  const result = new Map();
  for (const item of items) {
    const key = (item.inventoryItemId || item.materialId).toString();
    result.set(key, (result.get(key) || 0) + Number(item.quantity !== undefined ? item.quantity : (item.actualQuantity || 0)));
  }
  return result;
};

const calculateMaterialDelta = (previous = [], current = []) => {
  const before = materialMap(previous);
  const after = materialMap(current);
  const ids = new Set([...before.keys(), ...after.keys()]);
  return [...ids].map((inventoryItemId) => ({
    inventoryItemId,
    delta: (after.get(inventoryItemId) || 0) - (before.get(inventoryItemId) || 0)
  })).filter((entry) => entry.delta !== 0);
};

export const formatServiceRecord = (rec) => {
  if (!rec) return null;
  const doc = rec.toObject ? rec.toObject() : rec;

  const res = {
    id: (doc._id || doc.id).toString(),
    appointmentId: (doc.appointmentId?._id || doc.appointmentId).toString(),
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

  // plannedMaterials
  if (doc.plannedMaterials) {
    res.plannedMaterials = doc.plannedMaterials.map(m => ({
      inventoryItemId: (m.inventoryItemId?._id || m.inventoryItemId).toString(),
      quantity: Number(m.quantity || 0),
      unit: m.unit || 'cái',
      isDefault: m.isDefault !== undefined ? Boolean(m.isDefault) : true,
    }));
  }

  // actualMaterials
  if (doc.actualMaterials) {
    res.actualMaterials = doc.actualMaterials.map(m => ({
      inventoryItemId: (m.inventoryItemId?._id || m.inventoryItemId || m.materialId).toString(),
      actualQuantity: Number(m.actualQuantity !== undefined ? m.actualQuantity : (m.quantity || 0)),
      unit: m.unit || 'cái',
      isExtra: Boolean(m.isExtra),
    }));
  }

  // professional
  if (doc.professional && Object.keys(doc.professional).length > 0) {
    res.professional = doc.professional;
  } else {
    res.professional = null;
  }

  return res;
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
  let query = StaffProfile.findOne({
    userId: actor.id,
    staffSubRole,
    status: 'ACTIVE',
    authorizedBranchIds: branchId
  }).select('_id');
  if (session) query = query.session(session);
  const profile = await query.lean();
  if (!profile) {
    throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Staff is not authorized for this branch');
  }
};

const isAssignedToAppointment = (appointment, actorId) => (
  (appointment.services || []).some((service) => (
    service.assignedStaffId && service.assignedStaffId.toString() === actorId.toString()
  ))
);

export const createRecord = async (data, actor) => {
  const appointment = await Appointment.findById(data.appointmentId);
  if (!appointment) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Appointment not found');

  const normalizeMaterial = (m) => ({
    inventoryItemId: m.inventoryItemId || m.materialId,
    quantity: m.quantity !== undefined ? Number(m.quantity) : Number(m.actualQuantity || 0),
    unit: m.unit || 'cái',
    notes: m.notes || null,
  });

  const record = new ServiceRecord({
    appointmentId: appointment._id,
    branchId: appointment.branchId,
    customerId: appointment.customerId || null,
    petId: appointment.petId || null,
    serviceIds: (appointment.services || []).map((service) => service.serviceId),
    assignedStaffIds: (appointment.services || []).map((service) => service.assignedStaffId).filter(Boolean),
    reviewerStaffId: appointment.reviewerStaffId || null,
    recordType: appointment.serviceType || data.serviceType || 'GROOMING',
    status: 'IN_PROGRESS',
    plannedMaterials: (data.plannedMaterials || []).map(normalizeMaterial),
    actualMaterials: (data.actualMaterials || data.plannedMaterials || []).map(normalizeMaterial),
    professional: {}
  });
  await record.save();
  return formatServiceRecord(record);
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
    filter.$or = [
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

  return {
    items: items.map(formatServiceRecord),
    nextCursor: null,
  };
};

export const getRecordById = async (id, actor = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
  }

  const record = await ServiceRecord.findById(id).lean();
  if (!record) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  }

  // Authorization check
  if (actor.systemRole === 'STAFF') {
    const isAssigned = (record.assignedStaffIds || []).some(sid => sid.toString() === actor.id.toString()) ||
      (record.reviewerStaffId && record.reviewerStaffId.toString() === actor.id.toString());
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

  return formatServiceRecord(record);
};

export const updateMaterials = async (id, data, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
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
      if (appointment && !isAssignedToAppointment(appointment, actor.id)) {
        throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Only assigned staff can edit materials');
      }
    } else if (record.recordType === 'MEDICAL') {
      if (appointment) {
        const actorAssignedSegments = (appointment.services || []).filter(
          s => s.assignedStaffId && s.assignedStaffId.toString() === actor.id.toString()
        );
        const isReviewer = record.reviewerStaffId && record.reviewerStaffId.toString() === actor.id.toString();

        if (actor.staffSubRole === 'NURSE') {
          const hasNurseSegment = actorAssignedSegments.some(s => s.requiredStaffRole === 'NURSE');
          if (!hasNurseSegment) {
            throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Nurse is not assigned to this medical segment');
          }
        } else if (actor.staffSubRole === 'VETERINARIAN') {
          const hasVetSegment = actorAssignedSegments.some(s => s.requiredStaffRole === 'VETERINARIAN') || isReviewer;
          if (!hasVetSegment) {
            throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Veterinarian is not assigned to this medical segment');
          }
        } else {
          throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Staff role not allowed to update medical materials');
        }
      }
    }
  }

  const materials = (data.materials || []).map(m => ({
    inventoryItemId: m.inventoryItemId || m.materialId,
    quantity: m.quantity !== undefined ? Number(m.quantity) : Number(m.actualQuantity || 0),
    unit: m.unit || 'cái',
    notes: m.notes || null,
  }));

  record.actualMaterials = materials;
  record.version += 1;
  await record.save();

  return formatServiceRecord(record);
};

export const updateProfessional = async (id, data, actor) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
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
    const isReviewerOrAssigned = (record.reviewerStaffId && record.reviewerStaffId.toString() === actor.id.toString()) ||
      (record.assignedStaffIds || []).some(sid => sid.toString() === actor.id.toString());
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

  return formatServiceRecord(record);
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

  return formatServiceRecord(record);
};

export const getRevisions = async (id, actor = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid service record id format');
  }

  const record = await ServiceRecord.findById(id).lean();
  if (!record) {
    throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  }

  // Authorization check
  if (actor.systemRole === 'STAFF') {
    const isAssigned = (record.assignedStaffIds || []).some(sid => sid.toString() === actor.id.toString()) ||
      (record.reviewerStaffId && record.reviewerStaffId.toString() === actor.id.toString());
    if (!isAssigned) {
      throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'You are not assigned to this service record');
    }
  }

  const revisions = await ServiceRecordRevision.find({ serviceRecordId: id }).sort({ recordVersion: 1 }).lean();
  return {
    items: revisions.map(formatServiceRecordRevision),
  };
};

export const submitReview = async (id, data, actor) => {
  const record = await ServiceRecord.findById(id);
  if (!record) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
  if (record.recordType !== 'MEDICAL' || record.status !== 'IN_PROGRESS') {
    throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'Medical record must be in progress');
  }
  await requireExecutionStaff(actor, 'NURSE', record.branchId);
  const appointment = await Appointment.findById(record.appointmentId);
  if (!appointment || !isAssignedToAppointment(appointment, actor.id)) {
    throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Only an assigned Nurse can submit this Medical record for review');
  }
  if (data.expectedVersion !== undefined && data.expectedVersion !== record.version) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Service record has been changed');
  }
  if (data.actualMaterials) {
    record.actualMaterials = data.actualMaterials.map(m => ({
      inventoryItemId: m.inventoryItemId || m.materialId,
      quantity: m.quantity !== undefined ? Number(m.quantity) : Number(m.actualQuantity || 0),
      unit: m.unit || 'cái',
      notes: m.notes || null,
    }));
  }
  record.status = 'WAITING_VET_REVIEW';
  record.version += 1;
  await record.save();
  return formatServiceRecord(record);
};

export const finalizeRecord = async (id, data, actor) => {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const record = await ServiceRecord.findById(id).session(session);
      if (!record) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
      if (data.expectedVersion !== undefined && data.expectedVersion !== record.version) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Service record has been changed');
      }

      const appointment = await Appointment.findById(record.appointmentId).session(session);
      if (!appointment) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Appointment not found');
      const allSegmentsComplete = (appointment.services || []).every((service) => service.executionStatus === 'COMPLETED');
      if (!allSegmentsComplete) {
        throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'All appointment segments must be completed before inventory finalization');
      }

      if (record.recordType === 'MEDICAL') {
        await requireExecutionStaff(actor, 'VETERINARIAN', record.branchId, session);
        if (!['WAITING_VET_REVIEW', 'REOPENED'].includes(record.status)) {
          throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'Medical record is not ready for Veterinarian review');
        }
        if (actor.staffSubRole !== 'VETERINARIAN' || !record.reviewerStaffId || record.reviewerStaffId.toString() !== actor.id.toString()) {
          throw new AppError(403, 'Forbidden', ErrorCodes.MEDICAL_REVIEW_REQUIRED, 'Only the assigned Veterinarian reviewer can finalize this record');
        }
      } else {
        await requireExecutionStaff(actor, 'CARE_STAFF_GROOMER', record.branchId, session);
        if (!isAssignedToAppointment(appointment, actor.id)) {
          throw new AppError(403, 'Forbidden', ErrorCodes.ASSIGNMENT_SCOPE_ERROR, 'Only assigned Care Staff/Groomer can finalize this record');
        }
      }

      if (record.recordVersion > 0 && record.status !== 'REOPENED') {
        throw new AppError(409, 'Conflict', ErrorCodes.INVALID_STATE_TRANSITION, 'A finalized record must be reopened before correction');
      }
      if (record.recordVersion > 0 && (!data.reason || data.reason.trim().length < 3)) {
        throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'A correction reason is required');
      }

      if (data.actualMaterials) {
        record.actualMaterials = data.actualMaterials.map(m => ({
          inventoryItemId: m.inventoryItemId || m.materialId,
          quantity: m.quantity !== undefined ? Number(m.quantity) : Number(m.actualQuantity || 0),
          unit: m.unit || 'cái',
          notes: m.notes || null,
        }));
      }
      if (data.professional) Object.assign(record.professional, data.professional);
      const previousActual = record.lastFinalizedActual.map((item) => (item.toObject ? item.toObject() : item));
      const newActual = record.actualMaterials.map((item) => (item.toObject ? item.toObject() : item));
      const delta = calculateMaterialDelta(previousActual, newActual);
      const nextRecordVersion = record.recordVersion + 1;
      const revisionId = new mongoose.Types.ObjectId();

      await applyServiceRecordDelta({
        session,
        revisionId,
        recordVersion: nextRecordVersion,
        branchId: record.branchId,
        deltas: delta,
        actorId: actor.id
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
        reason: data.reason || null,
        finalizedAt: new Date()
      });
      await revision.save({ session });

      record.lastFinalizedActual = newActual;
      record.recordVersion = nextRecordVersion;
      record.status = 'FINALIZED';
      record.actualEndAt = new Date();
      record.version += 1;
      await record.save({ session });

      if (appointment.status !== 'COMPLETED') {
        appointment.status = 'COMPLETED';
        await appointment.save({ session });
      }
      result = record;
    });
    return formatServiceRecord(result);
  } finally {
    await session.endSession();
  }
};
