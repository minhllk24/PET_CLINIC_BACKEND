import mongoose from 'mongoose';
import ServiceRecord from './models/ServiceRecord';
import ServiceRecordRevision from './models/ServiceRecordRevision';
import Appointment from '../booking/models/Appointment';
import InventoryStock from '../inventory/models/InventoryStock';
import InventoryTransaction from '../inventory/models/InventoryTransaction';
import AppError from '../../utils/AppError';

export const createRecord = async (data, actor) => {
  const { appointmentId, branchId, customerId, petId, serviceType, actualMaterials } = data;
  const record = new ServiceRecord({
    appointmentId,
    branchId,
    customerId,
    petId,
    serviceType,
    status: 'IN_PROGRESS',
    actualMaterials: actualMaterials || [],
    professional: {}
  });
  await record.save();
  return record;
};

export const submitReview = async (id, data, actor) => {
  const record = await ServiceRecord.findById(id);
  if (!record) throw new AppError(404, 'NotFound', 'RECORD_NOT_FOUND', 'Record not found');

  if (record.serviceType !== 'MEDICAL') {
    throw new AppError(400, 'ValidationError', 'INVALID_SERVICE_TYPE', 'Only MEDICAL records need review');
  }

  record.status = 'WAITING_VET_REVIEW';
  if (data.actualMaterials) {
    record.actualMaterials = data.actualMaterials;
  }
  await record.save();

  // Mark the corresponding appointment segment as COMPLETED
  const apt = await Appointment.findById(record.appointmentId);
  if (apt) {
    // simplified
    const segment = apt.services.find(s => s.executionStatus === 'IN_PROGRESS');
    if (segment) segment.executionStatus = 'COMPLETED';
    await apt.save();
  }

  return record;
};

export const finalizeRecord = async (id, data, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const record = await ServiceRecord.findById(id).session(session);
    if (!record) throw new AppError(404, 'NotFound', 'RECORD_NOT_FOUND', 'Record not found');

    if (data.expectedVersion !== undefined && record.version !== data.expectedVersion) {
      throw new AppError(409, 'Conflict', 'CONCURRENCY_CONFLICT', 'Service record has been updated by another user');
    }

    if (record.serviceType === 'MEDICAL') {
      if (record.status !== 'WAITING_VET_REVIEW') {
        throw new AppError(400, 'BadRequest', 'INVALID_STATE', 'Medical record must be in WAITING_VET_REVIEW');
      }
      if (actor.staffSubRole !== 'VETERINARIAN') {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Only Veterinarian can finalize medical records');
      }
      const apt = await Appointment.findById(record.appointmentId).session(session);
      if (apt && apt.reviewerStaffId && apt.reviewerStaffId.toString() !== actor.id.toString()) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'You are not the assigned reviewer for this appointment');
      }
    }

    if (data.actualMaterials) record.actualMaterials = data.actualMaterials;
    if (data.professional) Object.assign(record.professional, data.professional);

    // Calculate deltas and issue inventory
    // To keep it simple, we assume this is the first finalization (no previous revision)
    for (const mat of record.actualMaterials) {
      if (mat.quantity > 0) {
        const stock = await InventoryStock.findOne({ branchId: record.branchId, inventoryItemId: mat.inventoryItemId }).session(session);
        if (!stock || stock.quantity < mat.quantity) {
          throw new AppError(422, 'UnprocessableEntity', 'INSUFFICIENT_INVENTORY', 'Insufficient stock for materials');
        }
        stock.quantity -= mat.quantity;
        await stock.save({ session });

        const tx = new InventoryTransaction({
          branchId: record.branchId,
          inventoryItemId: mat.inventoryItemId,
          transactionType: 'ISSUE',
          quantity: mat.quantity,
          stockAfter: stock.quantity,
          sourceType: 'SERVICE_RECORD_REVISION', // wait, sourceId needs to be revision ID
          actorId: actor.id,
          postedAt: new Date(),
          notes: 'Material used in service'
        });
        await tx.save({ session });
        mat._txId = tx._id;
      }
    }

    // Create Revision
    const revision = new ServiceRecordRevision({
      serviceRecordId: record._id,
      version: 1, // simplified
      actualMaterials: record.actualMaterials,
      professional: record.professional,
      createdBy: actor.id
    });
    await revision.save({ session });

    // Update tx sourceId
    for (const mat of record.actualMaterials) {
      if (mat._txId) {
        await InventoryTransaction.findByIdAndUpdate(mat._txId, { sourceId: revision._id, recordVersion: revision.version }, { session });
      }
    }

    record.version += 1;
    record.status = 'FINALIZED';
    await record.save({ session });

    // Mark appointment as COMPLETED
    const apt = await Appointment.findById(record.appointmentId).session(session);
    if (apt) {
      apt.services.forEach(s => s.executionStatus = 'COMPLETED');
      apt.status = 'COMPLETED';
      // System automatically applies deposit
      if (apt.pricing.paidAmount > 0 && apt.paymentMethod === 'PAY_AT_STORE') {
        // Find payment
        const payment = await Payment.findOne({ targetType: 'APPOINTMENT', targetId: apt._id, kind: 'DEPOSIT' }).session(session);
        if (payment && payment.status === 'PAID') {
          // In real system, maybe create an applied record, but status remains PAID
        }
      }
      await apt.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return record;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
