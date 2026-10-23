import mongoose from 'mongoose';
import Branch from '../branch/models/Branch';
import Service from '../catalog/models/Service';
import BranchServiceConfig from '../branch/models/BranchServiceConfig';
import Shift from '../staff/models/Shift';
import StaffProfile from '../staff/models/StaffProfile';
import Appointment from './models/Appointment';
import SlotReservation from './models/SlotReservation';
import AppError from '../../utils/AppError';

/**
 * Helper to parse "HH:mm" into minutes from start of day (UTC)
 */
export const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, mins] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (mins || 0);
};

/**
 * Helper to format minutes from start of day into "HH:mm"
 */
export const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Creates an ISO date-time string given a date "YYYY-MM-DD" and "HH:mm"
 */
export const createDateTimeISO = (dateStr, timeStr) => {
  return new Date(`${dateStr}T${timeStr}:00.000Z`).toISOString();
};

/**
 * Core Dynamic Availability Slot Engine (Zero manual slot creation)
 */
export const getAvailability = async ({ serviceIds, branchId, date, includeFull = false }) => {
  // 1. Normalize serviceIds (support array, comma-separated string, or single string)
  let normalizedServiceIds = [];
  if (Array.isArray(serviceIds)) {
    normalizedServiceIds = serviceIds.flatMap((id) =>
      typeof id === 'string' ? id.split(',') : [id]
    );
  } else if (typeof serviceIds === 'string') {
    normalizedServiceIds = serviceIds.split(',');
  }

  normalizedServiceIds = normalizedServiceIds
    .map((id) => (typeof id === 'string' ? id.trim() : id))
    .filter(Boolean);

  if (normalizedServiceIds.length === 0) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'serviceIds is required');
  }

  for (const id of normalizedServiceIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', `Invalid serviceId: ${id}`);
    }
  }

  if (!mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Invalid branchId');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Invalid date format (must be YYYY-MM-DD)');
  }

  // 2. Fetch Branch and check operating status & holidays
  const branch = await Branch.findById(branchId);
  if (!branch || branch.status !== 'ACTIVE') {
    return {
      serviceIds: normalizedServiceIds,
      branchId,
      date,
      scheduledDurationMinutes: 0,
      slots: [],
    };
  }

  // Check holiday
  const isHoliday = (branch.holidays || []).some((h) => h.date === date);
  if (isHoliday) {
    return {
      serviceIds: normalizedServiceIds,
      branchId,
      date,
      scheduledDurationMinutes: 0,
      slots: [],
    };
  }

  // Determine dayOfWeek (0: Sunday, 1: Monday, ..., 6: Saturday)
  const targetDateObj = new Date(`${date}T00:00:00.000Z`);
  const dayOfWeek = targetDateObj.getUTCDay();

  // Find opening hours for this dayOfWeek
  const dayOpening = (branch.openingHours || []).find((h) => h.dayOfWeek === dayOfWeek);
  if (!dayOpening || !dayOpening.open || !dayOpening.close) {
    return {
      serviceIds: normalizedServiceIds,
      branchId,
      date,
      scheduledDurationMinutes: 0,
      slots: [],
    };
  }

  const branchOpenMinutes = timeToMinutes(dayOpening.open);
  const branchCloseMinutes = timeToMinutes(dayOpening.close);

  if (branchOpenMinutes >= branchCloseMinutes) {
    return {
      serviceIds: normalizedServiceIds,
      branchId,
      date,
      scheduledDurationMinutes: 0,
      slots: [],
    };
  }

  // 3. Fetch Services and validate
  const objectIds = normalizedServiceIds.map((id) => new mongoose.Types.ObjectId(id));
  const rawServices = await Service.find({ _id: { $in: objectIds } });

  // Map to preserve input order
  const serviceMap = new Map();
  rawServices.forEach((s) => serviceMap.set(s._id.toString(), s));

  const orderedServices = [];
  for (const id of normalizedServiceIds) {
    const s = serviceMap.get(id);
    if (!s || s.status !== 'ACTIVE') {
      return {
        serviceIds: normalizedServiceIds,
        branchId,
        date,
        scheduledDurationMinutes: 0,
        slots: [],
      };
    }
    // Only BOOKABLE services can produce availability slots
    if (s.bookingMode !== 'BOOKABLE') {
      return {
        serviceIds: normalizedServiceIds,
        branchId,
        date,
        scheduledDurationMinutes: 0,
        slots: [],
      };
    }
    orderedServices.push(s);
  }

  // All services must share the exact same serviceType
  const primaryServiceType = orderedServices[0].serviceType;
  const isConsistentType = orderedServices.every((s) => s.serviceType === primaryServiceType);
  if (!isConsistentType) {
    throw new AppError(
      400,
      'ValidationError',
      'VALIDATION_ERROR',
      'All services in an appointment must have the same serviceType'
    );
  }

  const scheduledDurationMinutes = orderedServices.reduce(
    (sum, s) => sum + (Number(s.durationMinutes) || 0),
    0
  );

  // 4. Fetch BranchServiceConfig for all services
  const configs = await BranchServiceConfig.find({
    branchId: new mongoose.Types.ObjectId(branchId),
    serviceId: { $in: objectIds },
  });

  const configMap = new Map();
  configs.forEach((c) => configMap.set(c.serviceId.toString(), c));

  // If any service is missing config or disabled, no slots available
  for (const s of orderedServices) {
    const config = configMap.get(s._id.toString());
    if (!config || !config.enabled) {
      return {
        serviceIds: normalizedServiceIds,
        branchId,
        date,
        serviceType: primaryServiceType,
        scheduledDurationMinutes,
        slots: [],
      };
    }
  }

  // 5. Fetch Active Shifts on this date at branch
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const shifts = await Shift.find({
    branchId: new mongoose.Types.ObjectId(branchId),
    status: 'ACTIVE',
    startAt: { $lt: endOfDay },
    endAt: { $gt: startOfDay },
  }).populate('staffId');

  // Active qualified staff profiles mapped to their shift intervals
  const staffShifts = [];
  for (const shift of shifts) {
    const profile = shift.staffId;
    if (profile && profile.status === 'ACTIVE') {
      const shiftStartMins = Math.max(
        0,
        Math.floor((new Date(shift.startAt).getTime() - startOfDay.getTime()) / 60000)
      );
      const shiftEndMins = Math.min(
        1440,
        Math.floor((new Date(shift.endAt).getTime() - startOfDay.getTime()) / 60000)
      );
      staffShifts.push({
        staffId: profile._id.toString(),
        subRole: profile.staffSubRole,
        startMins: shiftStartMins,
        endMins: shiftEndMins,
      });
    }
  }

  // 6. Fetch Existing Appointments and Holds on this date
  const now = new Date();
  const existingAppointments = await Appointment.find({
    branchId: new mongoose.Types.ObjectId(branchId),
    status: { $in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT', 'PENDING_CONFIRMATION'] },
    scheduledStart: { $lt: endOfDay },
    scheduledEnd: { $gt: startOfDay },
  });

  // Filter out expired holds
  const activeBookings = existingAppointments.filter((apt) => {
    if (apt.status === 'PENDING_PAYMENT' || apt.status === 'PENDING_CONFIRMATION') {
      if (apt.holdExpiresAt && new Date(apt.holdExpiresAt) < now) {
        return false;
      }
    }
    return true;
  });

  // Extract occupied segments: serviceId, startMins, endMins, assignedStaffId, isHold
  const occupiedSegments = [];
  for (const apt of activeBookings) {
    const isHold = ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'].includes(apt.status);
    if (apt.services && Array.isArray(apt.services)) {
      for (const seg of apt.services) {
        if (seg.scheduledStart && seg.scheduledEnd) {
          const segStartMins = Math.floor(
            (new Date(seg.scheduledStart).getTime() - startOfDay.getTime()) / 60000
          );
          const segEndMins = Math.floor(
            (new Date(seg.scheduledEnd).getTime() - startOfDay.getTime()) / 60000
          );
          occupiedSegments.push({
            appointmentId: apt._id ? apt._id.toString() : null,
            serviceId: (seg.serviceId?._id || seg.serviceId)?.toString(),
            assignedStaffId: seg.assignedStaffId ? seg.assignedStaffId.toString() : null,
            startMins: segStartMins,
            endMins: segEndMins,
            isHold,
          });
        }
      }
    }
  }

  // 7. Extract Blocked Windows from configs
  const blockedWindowsList = [];
  for (const config of configs) {
    if (config.blockedWindows && Array.isArray(config.blockedWindows)) {
      for (const bw of config.blockedWindows) {
        const bwStart = new Date(bw.startAt);
        const bwEnd = new Date(bw.endAt);
        if (bwStart < endOfDay && bwEnd > startOfDay) {
          const bwStartMins = Math.max(0, Math.floor((bwStart.getTime() - startOfDay.getTime()) / 60000));
          const bwEndMins = Math.min(1440, Math.floor((bwEnd.getTime() - startOfDay.getTime()) / 60000));
          blockedWindowsList.push({
            serviceId: config.serviceId.toString(),
            startMins: bwStartMins,
            endMins: bwEndMins,
            reason: bw.reason,
          });
        }
      }
    }
  }

  // 8. Generate Slots
  // Slot step is 15 minutes
  const SLOT_STEP = 15;
  const availableSlots = [];

  for (
    let slotStart = branchOpenMinutes;
    slotStart + scheduledDurationMinutes <= branchCloseMinutes;
    slotStart += SLOT_STEP
  ) {
    const slotEnd = slotStart + scheduledDurationMinutes;
    let currentStart = slotStart;
    let slotSegments = [];
    let minRemainingCapacity = Infinity;
    let isBlocked = false;
    let totalSlotCapacity = 1;
    let totalBookedCount = 0;
    let totalHeldCount = 0;
    let staffUnavailable = false;

    // Track staff used across the sequential segments in this candidate slot
    for (const service of orderedServices) {
      const duration = Number(service.durationMinutes);
      const segStart = currentStart;
      const segEnd = currentStart + duration;

      const sId = service._id.toString();
      const config = configMap.get(sId);
      const capacity = Number(config?.capacity) || 1;
      totalSlotCapacity = Math.max(totalSlotCapacity, capacity);

      // Check if blocked by blockedWindows
      const hasBlockedWindow = blockedWindowsList.some((bw) => {
        return bw.serviceId === sId && Math.max(bw.startMins, segStart) < Math.min(bw.endMins, segEnd);
      });
      if (hasBlockedWindow) {
        isBlocked = true;
      }

      // Check if service has specific availability window on this day
      if (config?.availability && config.availability.length > 0) {
        const dayAvail = config.availability.filter((a) => a.dayOfWeek === dayOfWeek);
        if (dayAvail.length > 0) {
          const withinAvail = dayAvail.some((w) => {
            const wOpen = timeToMinutes(w.open);
            const wClose = timeToMinutes(w.close);
            return segStart >= wOpen && segEnd <= wClose;
          });
          if (!withinAvail) {
            isBlocked = true;
          }
        }
      }

      // Check capacity: count overlapping active segments of this service
      const concurrentSegments = occupiedSegments.filter((occ) => {
        return occ.serviceId === sId && Math.max(occ.startMins, segStart) < Math.min(occ.endMins, segEnd);
      });

      const bookedSegments = concurrentSegments.filter((s) => !s.isHold);
      const heldSegments = concurrentSegments.filter((s) => s.isHold);

      totalBookedCount = Math.max(totalBookedCount, bookedSegments.length);
      totalHeldCount = Math.max(totalHeldCount, heldSegments.length);

      const remainingForSegment = Math.max(0, capacity - concurrentSegments.length);
      if (remainingForSegment < minRemainingCapacity) {
        minRemainingCapacity = remainingForSegment;
      }

      // Check staff availability:
      const occupiedStaffIds = new Set(
        occupiedSegments
          .filter(
            (occ) =>
              occ.assignedStaffId &&
              Math.max(occ.startMins, segStart) < Math.min(occ.endMins, segEnd)
          )
          .map((occ) => occ.assignedStaffId)
      );

      const availableStaff = staffShifts.filter((shift) => {
        return (
          shift.subRole === service.requiredStaffRole &&
          shift.startMins <= segStart &&
          shift.endMins >= segEnd &&
          !occupiedStaffIds.has(shift.staffId)
        );
      });

      if (availableStaff.length === 0) {
        staffUnavailable = true;
      }

      slotSegments.push({
        serviceId: sId,
        start: createDateTimeISO(date, minutesToTime(segStart)),
        end: createDateTimeISO(date, minutesToTime(segEnd)),
      });

      currentStart = segEnd;
    }

    const occupiedCount = totalBookedCount + totalHeldCount;
    let remaining = minRemainingCapacity === Infinity ? Math.max(0, totalSlotCapacity - occupiedCount) : minRemainingCapacity;

    if (staffUnavailable) {
      remaining = 0;
    }

    let status = 'AVAILABLE';
    if (isBlocked) {
      status = 'BLOCKED';
      remaining = 0;
    } else if (remaining <= 0 || staffUnavailable) {
      status = 'FULL';
      remaining = 0;
    }

    const slotData = {
      start: createDateTimeISO(date, minutesToTime(slotStart)),
      end: createDateTimeISO(date, minutesToTime(slotEnd)),
      bookedCount: totalBookedCount,
      heldCount: totalHeldCount,
      occupiedCount,
      totalCount: totalSlotCapacity,
      remaining: status === 'AVAILABLE' ? Math.max(1, remaining) : 0,
      status,
      timezone: 'Asia/Ho_Chi_Minh',
      segments: slotSegments,
    };

    if (status === 'AVAILABLE') {
      availableSlots.push(slotData);
    } else if (includeFull) {
      availableSlots.push(slotData);
    }
  }

  return {
    serviceIds: normalizedServiceIds,
    branchId,
    date,
    serviceType: primaryServiceType,
    scheduledDurationMinutes,
    slots: availableSlots,
  };
};

/**
 * Branch Operation Slots Engine (for Manager / Staff / Occupancy View)
 */
export const getBranchOperationSlots = async ({ branchId, date, serviceId, includeFull = true }, actor) => {
  if (serviceId) {
    return getAvailability({ serviceIds: [serviceId], branchId, date, includeFull: true });
  }

  const configs = await BranchServiceConfig.find({
    branchId: new mongoose.Types.ObjectId(branchId),
    enabled: true,
  });

  const serviceIds = configs.map((c) => c.serviceId.toString());
  if (serviceIds.length === 0) {
    return {
      branchId,
      date,
      servicesCount: 0,
      servicesAvailability: [],
    };
  }

  const results = await Promise.all(
    serviceIds.map((sId) =>
      getAvailability({ serviceIds: [sId], branchId, date, includeFull: true }).catch(() => null)
    )
  );

  return {
    branchId,
    date,
    servicesCount: results.filter(Boolean).length,
    servicesAvailability: results.filter(Boolean),
  };
};
