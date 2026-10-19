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
    const key = item.inventoryItemId.toString();
    result.set(key, (result.get(key) || 0) + Number(item.quantity || 0));
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

  const record = new ServiceRecord({
    appointmentId: appointment._id,
    branchId: appointment.branchId,
    customerId: appointment.customerId || null,
    petId: appointment.petId || null,
    serviceIds: (appointment.services || []).map((service) => service.serviceId),
    assignedStaffIds: (appointment.services || []).map((service) => service.assignedStaffId).filter(Boolean),
    reviewerStaffId: appointment.reviewerStaffId || null,
    recordType: appointment.serviceType || data.serviceType,
    status: 'IN_PROGRESS',
    plannedMaterials: data.plannedMaterials || [],
    actualMaterials: data.actualMaterials || data.plannedMaterials || [],
    professional: {}
  });
  await record.save();
  return record;
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
  if (data.expectedVersion !== record.version) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONCURRENCY_CONFLICT, 'Service record has been changed');
  }
  if (data.actualMaterials) record.actualMaterials = data.actualMaterials;
  record.status = 'WAITING_VET_REVIEW';
  record.version += 1;
  await record.save();
  return record;
};

export const finalizeRecord = async (id, data, actor) => {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const record = await ServiceRecord.findById(id).session(session);
      if (!record) throw new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, 'Service record not found');
      if (data.expectedVersion !== record.version) {
        throw new AppError(409, 'Conflict', ErrorCodes.CONCURRENCY_CONFLICT, 'Service record has been changed');
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

      if (data.actualMaterials) record.actualMaterials = data.actualMaterials;
      if (data.professional) Object.assign(record.professional, data.professional);
      const previousActual = record.lastFinalizedActual.map((item) => item.toObject());
      const newActual = record.actualMaterials.map((item) => item.toObject());
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
    return result;
  } finally {
    await session.endSession();
  }
};
