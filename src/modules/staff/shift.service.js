import mongoose from 'mongoose';
import Shift from './models/Shift';
import StaffProfile from './models/StaffProfile';
import Branch from '../branch/models/Branch';
import Appointment from '../booking/models/Appointment';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

const encodeCursor = (id) => Buffer.from(id.toString()).toString('base64');
const decodeCursor = (cursor) => {
  try {
    return Buffer.from(cursor, 'base64').toString('ascii');
  } catch (e) {
    return null;
  }
};

/**
 * Pure Serializer for Shift (enforces OpenAPI Shift schema additionalProperties: false)
 */
export const formatShift = (shift) => {
  const staffProfile = shift.staffId && typeof shift.staffId === 'object' && shift.staffId.staffSubRole
    ? shift.staffId
    : null;

  return {
    id: shift._id.toString(),
    staffId: (shift.staffId?._id || shift.staffId).toString(),
    branchId: (shift.branchId?._id || shift.branchId).toString(),
    staffSubRole: staffProfile?.staffSubRole || shift.staffSubRole || 'VETERINARIAN',
    startAt: new Date(shift.startAt).toISOString(),
    endAt: new Date(shift.endAt).toISOString(),
    status: shift.status || 'ACTIVE',
  };
};

/**
 * List Shifts with role-based filtering and pagination
 */
export const listShifts = async ({
  staffId,
  branchId,
  dateFrom,
  dateTo,
  status,
  limit = 20,
  cursor,
  actor = null,
}) => {
  const filter = {};

  // 1. RBAC & Scope checks
  if (actor) {
    if (actor.systemRole === 'STAFF') {
      // Staff can only see their own shifts
      const staffProfile = await StaffProfile.findOne({ userId: actor.id });
      if (!staffProfile) {
        return { items: [], nextCursor: null };
      }
      filter.staffId = staffProfile._id;
    } else if (actor.systemRole === 'MANAGER') {
      // Manager can only view shifts in assigned branches
      const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
      if (branchId) {
        if (!assignedIds.includes(branchId.toString())) {
          throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have access to shifts of this branch');
        }
        filter.branchId = new mongoose.Types.ObjectId(branchId);
      } else {
        filter.branchId = { $in: assignedIds.map((id) => new mongoose.Types.ObjectId(id)) };
      }
    }
  }

  if (branchId && !filter.branchId) {
    filter.branchId = new mongoose.Types.ObjectId(branchId);
  }

  if (staffId && !filter.staffId) {
    filter.staffId = new mongoose.Types.ObjectId(staffId);
  }

  if (status) {
    filter.status = status;
  }

  if (dateFrom || dateTo) {
    filter.startAt = {};
    if (dateFrom) filter.startAt.$gte = new Date(dateFrom);
    if (dateTo) filter.startAt.$lte = new Date(dateTo);
  }

  if (cursor) {
    const decodedId = decodeCursor(cursor);
    if (decodedId && mongoose.Types.ObjectId.isValid(decodedId)) {
      filter._id = { $gt: new mongoose.Types.ObjectId(decodedId) };
    }
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const shifts = await Shift.find(filter)
    .sort({ _id: 1 })
    .limit(parsedLimit + 1)
    .populate('staffId');

  let nextCursor = null;
  let items = shifts;
  if (shifts.length > parsedLimit) {
    items = shifts.slice(0, parsedLimit);
    nextCursor = encodeCursor(items[items.length - 1]._id);
  }

  return {
    items: items.map(formatShift),
    nextCursor,
  };
};

/**
 * Create a new Shift with Overlap Prevention
 */
export const createShift = async (data, actor = null) => {
  const { staffId, branchId, startAt, endAt } = data;

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'startAt must be before endAt and both must be valid dates');
  }

  // 1. RBAC Check for Manager
  if (actor && actor.systemRole === 'MANAGER') {
    const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
    if (!assignedIds.includes(branchId.toString())) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You can only create shifts for branches assigned to you');
    }
  }

  // 2. Validate StaffProfile & Branch authorization
  const staff = await StaffProfile.findById(staffId);
  if (!staff || staff.status !== 'ACTIVE') {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Active staff profile not found');
  }

  const branch = await Branch.findById(branchId);
  if (!branch || branch.status !== 'ACTIVE') {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Active branch not found');
  }

  const authorized = (staff.authorizedBranchIds || []).map((b) => b.toString());
  if (!authorized.includes(branchId.toString())) {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.BRANCH_SCOPE_ERROR, 'Staff is not authorized to work at this branch');
  }

  // 3. Shift Overlap Guardrail
  const overlap = await Shift.findOne({
    staffId: new mongoose.Types.ObjectId(staffId),
    status: 'ACTIVE',
    startAt: { $lt: endDate },
    endAt: { $gt: startDate },
  });

  if (overlap) {
    throw new AppError(409, 'Conflict', ErrorCodes.SHIFT_OVERLAP, 'Staff already has an active shift overlapping this time window');
  }

  const shift = new Shift({
    staffId: staff._id,
    branchId: branch._id,
    startAt: startDate,
    endAt: endDate,
    status: 'ACTIVE',
  });

  await shift.save();
  shift.staffId = staff; // for formatShift subRole

  return formatShift(shift);
};

/**
 * Update an existing Shift
 */
export const updateShift = async (id, data, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Shift not found');
  }

  const shift = await Shift.findById(id).populate('staffId');
  if (!shift) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Shift not found');
  }

  // Scope check for Manager
  if (actor && actor.systemRole === 'MANAGER') {
    const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
    if (!assignedIds.includes(shift.branchId.toString())) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to modify shifts of this branch');
    }
  }

  const newStart = data.startAt ? new Date(data.startAt) : shift.startAt;
  const newEnd = data.endAt ? new Date(data.endAt) : shift.endAt;

  if (newStart >= newEnd) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'startAt must be before endAt');
  }

  // Overlap check if timing changed
  if (data.startAt || data.endAt) {
    const overlap = await Shift.findOne({
      _id: { $ne: shift._id },
      staffId: shift.staffId._id || shift.staffId,
      status: 'ACTIVE',
      startAt: { $lt: newEnd },
      endAt: { $gt: newStart },
    });

    if (overlap) {
      throw new AppError(409, 'Conflict', ErrorCodes.SHIFT_OVERLAP, 'Updated shift times overlap with another active shift for this staff');
    }
  }

  // Safety check: Cannot change shift time if confirmed appointments would fall outside the new window
  if (data.startAt || data.endAt) {
    let conflictingAppointments = [];
    if (mongoose.connection.readyState !== 0) {
      conflictingAppointments = await Appointment.find({
        branchId: shift.branchId,
        status: { $in: ['CONFIRMED', 'IN_PROGRESS'] },
        'services.assignedStaffId': shift.staffId._id || shift.staffId,
        'services.scheduledStart': { $gte: shift.startAt },
        'services.scheduledEnd': { $lte: shift.endAt },
        $or: [
          { 'services.scheduledStart': { $lt: newStart } },
          { 'services.scheduledEnd': { $gt: newEnd } },
        ],
      });
    }

    if (conflictingAppointments.length > 0) {
      const error = new AppError(
        409,
        'Conflict',
        ErrorCodes.CONFLICT,
        'Cannot update shift: existing confirmed appointments fall outside the new shift time'
      );
      error.affectedAppointmentIds = conflictingAppointments.map((a) => (a._id || a.id).toString());
      throw error;
    }
  }

  if (data.startAt) shift.startAt = newStart;
  if (data.endAt) shift.endAt = newEnd;

  await shift.save();
  return formatShift(shift);
};

/**
 * Cancel a Shift safely
 */
export const cancelShift = async (id, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Shift not found');
  }

  const shift = await Shift.findById(id).populate('staffId');
  if (!shift) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Shift not found');
  }

  // Scope check for Manager
  if (actor && actor.systemRole === 'MANAGER') {
    const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
    if (!assignedIds.includes(shift.branchId.toString())) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to cancel shifts of this branch');
    }
  }

  // Safety check: Cannot cancel shift with confirmed appointments
  let confirmedAppointments = [];
  if (mongoose.connection.readyState !== 0) {
    confirmedAppointments = await Appointment.find({
      branchId: shift.branchId,
      status: { $in: ['CONFIRMED', 'IN_PROGRESS'] },
      'services.assignedStaffId': shift.staffId._id || shift.staffId,
      'services.scheduledStart': { $lt: shift.endAt },
      'services.scheduledEnd': { $gt: shift.startAt },
    });
  } else {
    const hasConfirmed = await Appointment.findOne({
      branchId: shift.branchId,
      status: { $in: ['CONFIRMED', 'IN_PROGRESS'] },
      'services.assignedStaffId': shift.staffId._id || shift.staffId,
      'services.scheduledStart': { $lt: shift.endAt },
      'services.scheduledEnd': { $gt: shift.startAt },
    });
    if (hasConfirmed) confirmedAppointments = [hasConfirmed];
  }

  if (confirmedAppointments.length > 0) {
    const error = new AppError(
      409,
      'Conflict',
      ErrorCodes.CONFLICT,
      'Cannot cancel shift with existing confirmed appointments'
    );
    error.affectedAppointmentIds = confirmedAppointments.map((a) => (a._id || a.id).toString());
    throw error;
  }

  shift.status = 'CANCELLED';
  await shift.save();

  return formatShift(shift);
};

/**
 * Delete a Shift (Hard delete if shift has not started, block if ongoing or completed)
 */
export const deleteShift = async (id, actor = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Shift not found');
  }

  const shift = await Shift.findById(id).populate('staffId');
  if (!shift) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Shift not found');
  }

  // Scope check for Manager
  if (actor && actor.systemRole === 'MANAGER') {
    const assignedIds = (actor.assignedBranchIds || []).map((b) => b.toString());
    if (!assignedIds.includes(shift.branchId.toString())) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to delete shifts of this branch');
    }
  }

  // Check if shift has already started or completed
  const now = new Date();
  if (shift.startAt && new Date(shift.startAt) <= now) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Cannot delete shift that has already started or completed. Please cancel it instead.');
  }

  // Check for confirmed appointments
  let confirmedAppointments = [];
  if (mongoose.connection.readyState !== 0) {
    confirmedAppointments = await Appointment.find({
      branchId: shift.branchId,
      status: { $in: ['CONFIRMED', 'IN_PROGRESS'] },
      'services.assignedStaffId': shift.staffId._id || shift.staffId,
      'services.scheduledStart': { $lt: shift.endAt },
      'services.scheduledEnd': { $gt: shift.startAt },
    });
  }

  if (confirmedAppointments.length > 0) {
    const error = new AppError(
      409,
      'Conflict',
      ErrorCodes.CONFLICT,
      'Cannot delete shift with existing confirmed appointments'
    );
    error.affectedAppointmentIds = confirmedAppointments.map((a) => (a._id || a.id).toString());
    throw error;
  }

  await Shift.findByIdAndDelete(id);

  return {
    success: true,
    message: 'Shift deleted successfully',
    id
  };
};
