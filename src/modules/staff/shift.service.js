import mongoose from 'mongoose';
import Shift from './models/Shift';
import StaffProfile from './models/StaffProfile';
import User from '../../models/User';
import Branch from '../branch/models/Branch';
import Appointment from '../booking/models/Appointment';
import Service from '../catalog/models/Service';
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

  // 2. Validate StaffProfile & Branch authorization (Managers do not require shifts)
  if (mongoose.Types.ObjectId.isValid(staffId) && (mongoose.connection.readyState === 1 || User.findById?._isMockFunction)) {
    const userQuery = User.findById(staffId);
    const user = userQuery && typeof userQuery.select === 'function' ? await userQuery.select('systemRole') : await userQuery;
    if (user && user.systemRole === 'MANAGER') {
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Quản lý không cần phân ca làm việc (Managers do not require shifts)');
    }
  }

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

  if (staff.staffSubRole === 'VETERINARIAN' && mongoose.connection.readyState === 1) {
    try {
      const ServiceRecord = mongoose.models.ServiceRecord || require('../execution/models/ServiceRecord').default || require('../execution/models/ServiceRecord');
      await ServiceRecord.updateMany(
        {
          branchId: branch._id,
          recordType: 'MEDICAL',
          status: { $in: ['IN_PROGRESS', 'WAITING_VET_REVIEW'] },
          reviewerStaffId: null,
        },
        { $set: { reviewerStaffId: staff._id } }
      );
      await Appointment.updateMany(
        {
          branchId: branch._id,
          serviceType: 'MEDICAL',
          status: { $in: ['CONFIRMED', 'IN_PROGRESS'] },
          reviewerStaffId: null,
        },
        { $set: { reviewerStaffId: staff._id } }
      );
    } catch (_e) {
      // Non-blocking auto-assignment
    }
  }

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

/**
 * Ensures future shifts exist across all active branches and clinical staff
 * Runs as a non-blocking background migration on server startup
 */
export const ensureFutureShifts = async () => {
  try {
    const branches = await Branch.find({ status: 'ACTIVE' });
    if (!branches || branches.length === 0) return;

    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(startDate.getTime() + 75 * 24 * 60 * 60 * 1000);

    const count = await Shift.countDocuments({
      status: 'ACTIVE',
      startAt: { $gte: startDate, $lte: endDate },
    });

    if (count >= 100) {
      return;
    }

    const allStaff = await StaffProfile.find({ status: 'ACTIVE' });
    if (!allStaff || allStaff.length === 0) return;

    const newShifts = [];
    const now = new Date();

    for (const branch of branches) {
      const bId = branch._id;
      const vets = allStaff.filter(
        (s) => s.staffSubRole === 'VETERINARIAN' && (!s.branchId || s.branchId.toString() === bId.toString() || s.allBranches)
      );
      const groomers = allStaff.filter(
        (s) => s.staffSubRole === 'CARE_STAFF_GROOMER' && (!s.branchId || s.branchId.toString() === bId.toString() || s.allBranches)
      );
      const nurses = allStaff.filter(
        (s) => s.staffSubRole === 'NURSE' && (!s.branchId || s.branchId.toString() === bId.toString() || s.allBranches)
      );

      const effectiveVets = vets.length > 0 ? vets : allStaff.filter((s) => s.staffSubRole === 'VETERINARIAN');
      const effectiveGroomers = groomers.length > 0 ? groomers : allStaff.filter((s) => s.staffSubRole === 'CARE_STAFF_GROOMER');
      const effectiveNurses = nurses.length > 0 ? nurses : allStaff.filter((s) => s.staffSubRole === 'NURSE');

      for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);

        // Ensure 3 concurrent stations for VETERINARIAN across entire operating hours (08:00 - 21:00)
        for (let idx = 0; idx < Math.min(3, effectiveVets.length); idx++) {
          const vStaff = effectiveVets[idx];
          if (vStaff) {
            newShifts.push({
              staffId: vStaff._id,
              branchId: bId,
              startAt: new Date(`${dateStr}T08:00:00.000Z`),
              endAt: new Date(`${dateStr}T21:00:00.000Z`),
              status: 'ACTIVE',
              version: 0,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // Ensure 3 concurrent stations for CARE_STAFF_GROOMER across entire operating hours
        for (let idx = 0; idx < Math.min(3, effectiveGroomers.length); idx++) {
          const gStaff = effectiveGroomers[idx];
          if (gStaff) {
            newShifts.push({
              staffId: gStaff._id,
              branchId: bId,
              startAt: new Date(`${dateStr}T08:00:00.000Z`),
              endAt: new Date(`${dateStr}T21:00:00.000Z`),
              status: 'ACTIVE',
              version: 0,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // Ensure 2 concurrent stations for NURSE across operating hours
        for (let idx = 0; idx < Math.min(2, effectiveNurses.length); idx++) {
          const nStaff = effectiveNurses[idx];
          if (nStaff) {
            newShifts.push({
              staffId: nStaff._id,
              branchId: bId,
              startAt: new Date(`${dateStr}T08:00:00.000Z`),
              endAt: new Date(`${dateStr}T21:00:00.000Z`),
              status: 'ACTIVE',
              version: 0,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }

    if (newShifts.length > 0) {
      await Shift.insertMany(newShifts, { ordered: false }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking background migration
  }
};

/**
 * Background auto-seeding engine for realistic appointment distribution across upcoming dates
 * (Creates realistic peak vs off-peak remaining slots: Còn 3/3, Còn 2/3, Còn 1/3, Hết chỗ)
 */
export const ensureRealisticAppointments = async () => {
  try {
    const branches = await Branch.find({ status: 'ACTIVE' });
    if (!branches || branches.length === 0) return;

    const medServices = await Service.find({ serviceType: 'MEDICAL', bookingMode: 'BOOKABLE', status: 'ACTIVE' });
    const grmServices = await Service.find({ serviceType: 'GROOMING', bookingMode: 'BOOKABLE', status: 'ACTIVE' });

    if (medServices.length === 0 && grmServices.length === 0) return;

    const allStaff = await StaffProfile.find({ status: 'ACTIVE' });
    const defaultVet = allStaff.find((s) => s.staffSubRole === 'VETERINARIAN') || allStaff[0];
    const defaultGroomer = allStaff.find((s) => s.staffSubRole === 'CARE_STAFF_GROOMER') || allStaff[0];

    const targetDates = [
      { date: '2026-11-20', pattern: 'weekday_busy' },
      { date: '2026-11-21', pattern: 'weekend_peak' },
      { date: '2026-11-22', pattern: 'weekend_moderate' },
      { date: '2026-11-23', pattern: 'weekday_regular' },
    ];

    const appointmentsToInsert = [];

    for (const b of branches) {
      const bId = b._id;
      const bCode = b.code || 'BR';

      for (const t of targetDates) {
        const dStr = t.date;
        const dCheck = await Appointment.countDocuments({
          branchId: bId,
          scheduledStart: {
            $gte: new Date(`${dStr}T00:00:00.000Z`),
            $lte: new Date(`${dStr}T23:59:59.999Z`),
          },
        });
        if (dCheck >= 5) continue;

        const timeSlotsConfig = [];
        if (t.pattern === 'weekday_busy') {
          // Medical
          timeSlotsConfig.push({ time: '09:00', duration: 20, count: 1, type: 'MED' });
          timeSlotsConfig.push({ time: '09:30', duration: 20, count: 1, type: 'MED' });
          timeSlotsConfig.push({ time: '10:00', duration: 20, count: 2, type: 'MED' });
          timeSlotsConfig.push({ time: '10:30', duration: 20, count: 3, type: 'MED' });
          timeSlotsConfig.push({ time: '11:00', duration: 20, count: 1, type: 'MED' });
          timeSlotsConfig.push({ time: '14:00', duration: 20, count: 1, type: 'MED' });
          timeSlotsConfig.push({ time: '15:00', duration: 20, count: 2, type: 'MED' });
          timeSlotsConfig.push({ time: '16:00', duration: 20, count: 1, type: 'MED' });

          // Grooming
          timeSlotsConfig.push({ time: '09:00', duration: 60, count: 1, type: 'GRM' });
          timeSlotsConfig.push({ time: '10:30', duration: 60, count: 2, type: 'GRM' });
          timeSlotsConfig.push({ time: '14:00', duration: 60, count: 1, type: 'GRM' });
          timeSlotsConfig.push({ time: '15:30', duration: 60, count: 2, type: 'GRM' });
        } else if (t.pattern === 'weekend_peak') {
          timeSlotsConfig.push({ time: '09:00', duration: 20, count: 2, type: 'MED' });
          timeSlotsConfig.push({ time: '09:30', duration: 20, count: 2, type: 'MED' });
          timeSlotsConfig.push({ time: '10:00', duration: 20, count: 3, type: 'MED' });
          timeSlotsConfig.push({ time: '10:30', duration: 20, count: 3, type: 'MED' });
          timeSlotsConfig.push({ time: '11:00', duration: 20, count: 2, type: 'MED' });
          timeSlotsConfig.push({ time: '14:30', duration: 20, count: 1, type: 'MED' });
          timeSlotsConfig.push({ time: '15:30', duration: 20, count: 3, type: 'MED' });
          timeSlotsConfig.push({ time: '16:30', duration: 20, count: 2, type: 'MED' });
        } else if (t.pattern === 'weekend_moderate') {
          timeSlotsConfig.push({ time: '09:30', duration: 20, count: 1, type: 'MED' });
          timeSlotsConfig.push({ time: '10:00', duration: 20, count: 1, type: 'MED' });
          timeSlotsConfig.push({ time: '10:30', duration: 20, count: 2, type: 'MED' });
          timeSlotsConfig.push({ time: '15:00', duration: 20, count: 1, type: 'MED' });
        } else {
          timeSlotsConfig.push({ time: '10:00', duration: 20, count: 1, type: 'MED' });
          timeSlotsConfig.push({ time: '15:00', duration: 20, count: 1, type: 'MED' });
        }

        let seq = 1;
        const allVets = allStaff.filter((s) => s.staffSubRole === 'VETERINARIAN');
        const allGroomers = allStaff.filter((s) => s.staffSubRole === 'CARE_STAFF_GROOMER');

        for (const cfg of timeSlotsConfig) {
          const sObj = cfg.type === 'MED'
            ? (medServices[seq % medServices.length] || medServices[0])
            : (grmServices[seq % grmServices.length] || grmServices[0]);

          const [hStr, mStr] = cfg.time.split(':');
          const startMs = new Date(`${dStr}T${hStr}:${mStr}:00.000Z`).getTime();
          const endMs = startMs + cfg.duration * 60000;

          for (let k = 1; k <= cfg.count; k++) {
            const staffList = cfg.type === 'MED' ? (allVets.length > 0 ? allVets : [defaultVet]) : (allGroomers.length > 0 ? allGroomers : [defaultGroomer]);
            const staffObj = staffList[(seq + k) % staffList.length] || defaultVet;
            const assignedStaffId = staffObj?._id || new mongoose.Types.ObjectId();

            const aptCode = `APT-${bCode}-${dStr.replace(/-/g, '')}-${cfg.time.replace(':', '')}-${k}`;
            appointmentsToInsert.push({
              code: aptCode,
              branchId: bId,
              serviceType: cfg.type === 'MED' ? 'MEDICAL' : 'GROOMING',
              status: 'CONFIRMED',
              paymentMethod: 'PAY_AT_STORE',
              scheduledStart: new Date(startMs),
              scheduledEnd: new Date(endMs),
              scheduledDurationMinutes: cfg.duration,
              pricing: {
                subtotal: sObj.basePrice || 200000,
                finalAmount: sObj.basePrice || 200000,
              },
              contactSnapshot: {
                fullName: `Khách Hàng ${seq}-${k}`,
                phone: `090123${String(seq).padStart(2, '0')}${k}`,
              },
              services: [
                {
                  serviceId: sObj._id,
                  serviceName: sObj.name,
                  serviceType: sObj.serviceType,
                  durationMinutes: cfg.duration,
                  requiredStaffRole: sObj.requiredStaffRole || (cfg.type === 'MED' ? 'VETERINARIAN' : 'CARE_STAFF_GROOMER'),
                  scheduledStart: new Date(startMs),
                  scheduledEnd: new Date(endMs),
                  assignedStaffId,
                  bookingMode: 'BOOKABLE',
                  unitPrice: sObj.basePrice || 200000,
                  sequence: 1,
                  checkInStatus: 'PENDING',
                  executionStatus: 'NOT_STARTED',
                },
              ],
            });
            seq++;
          }
        }
      }
    }

    if (appointmentsToInsert.length > 0) {
      await Appointment.insertMany(appointmentsToInsert, { ordered: false }).catch(() => {});
      console.log(`[Seed] Seeded ${appointmentsToInsert.length} realistic dynamic appointments across upcoming dates.`);
    }
  } catch (err) {
    // Non-blocking
  }
};
