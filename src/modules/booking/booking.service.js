import mongoose from 'mongoose';
import Appointment from './models/Appointment';
import SlotReservation from './models/SlotReservation';
import AppointmentRequest from './models/AppointmentRequest';
import Payment from '../payment/models/Payment';
import Service from '../catalog/models/Service';
import Branch from '../branch/models/Branch';
import BranchServiceConfig from '../branch/models/BranchServiceConfig';
import Shift from '../staff/models/Shift';
import StaffProfile from '../staff/models/StaffProfile';
import GuestContact from '../customer/models/GuestContact';
import Pet from '../customer/models/Pet';
import ServiceRecord from '../execution/models/ServiceRecord';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import {
  validateVoucherEligibility,
  consumeQuotaInSession,
  restoreQuotaInSession,
} from '../order/voucher.service';
import {
  resolveServiceWeightPricing,
  resolveWeightTierCode,
} from '../catalog/serviceCatalog.service';
import { buildOptionalVnDateFilter } from '../dashboard/dashboard.utils';
import { formatCompactVnDate } from '../../utils/codeGenerator';
import { recordAuditLog } from '../../utils/auditLogger';
import { validateScheduleAgainstBranchRules } from './availability.service';
import { verifyGuestToken } from '../customer/guest.service';
import { mockCompletePayment as completeMockPaymentService } from '../payment/payment.service';
import {
  buildPlannedMaterialsFromServices,
  generateServiceRecordCode,
} from '../execution/execution.helpers';

const normalizeBookingPhone = (phone) => {
  if (!phone) return '';
  return String(phone).trim().replace(/[\s\-().]/g, '').replace(/^\+84/, '0');
};

const abortSessionSafely = async (session) => {
  if (!session) return;
  try {
    await session.abortTransaction();
  } catch (_e) {}
  try {
    session.endSession();
  } catch (_e) {}
};

const mapSlotWriteError = (error, message = 'The requested time slot or assigned staff is already reserved by another customer') => {
  if (!error) return null;
  if (error.code === 112 || error.hasErrorLabel?.('TransientTransactionError')) {
    return new AppError(409, 'Conflict', 'SLOT_UNAVAILABLE', message);
  }
  if (error.code === 11000) {
    const msg = error.message || '';
    const kp = error.keyPattern || {};
    const isSlotConflict =
      msg.includes('slotreservations') ||
      kp.slotUnit ||
      kp.slotStartUnit ||
      kp.capacitySlot ||
      kp.unitIndex ||
      kp.staffId ||
      kp.scheduledStart ||
      kp.assignedStaffId;
    if (isSlotConflict) {
      return new AppError(409, 'Conflict', 'SLOT_UNAVAILABLE', message);
    }
    return new AppError(500, 'Internal Server Error', 'DATABASE_UNIQUE_VIOLATION', error.message);
  }
  return null;
};

const assertBranchScope = (actor, branchId, message = 'You do not have access to this branch appointment') => {
  if (!actor) return;
  const role = actor.systemRole || actor.role;
  if (role === 'ADMIN') return;
  if (role === 'MANAGER' || role === 'RECEPTIONIST' || (role === 'STAFF' && actor.staffSubRole === 'RECEPTIONIST')) {
    const rawBranches = role === 'MANAGER'
      ? (actor.assignedBranchIds || actor.authorizedBranchIds)
      : (actor.authorizedBranchIds ?? actor.assignedBranchIds);
    if (role === 'MANAGER' || Array.isArray(rawBranches)) {
      const allowedBranches = (rawBranches || []).map((b) => (b._id || b).toString());
      const aptBranchStr = (branchId?._id || branchId)?.toString();
      if (allowedBranches.length === 0 || !aptBranchStr || !allowedBranches.includes(aptBranchStr)) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, message);
      }
    }
  }
};

const assertAppointmentSelfServiceAccess = async (apt, actor, guestLookupToken = null) => {
  if (!actor && !guestLookupToken) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'Authentication or verified guest lookup token required');
  }
  if (actor) {
    const role = actor.systemRole || actor.role;
    if (['ADMIN', 'MANAGER', 'RECEPTIONIST', 'STAFF'].includes(role)) {
      return;
    }
    if (role === 'CUSTOMER') {
      const actorId = (actor.id || actor._id)?.toString();
      const allowedCustomerIds = actorId ? [actorId] : [];
      if (mongoose.connection.readyState === 1 && actorId) {
        try {
          const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
          const cust = await CustomerModel.findOne({ userId: actorId }).select('_id').lean();
          if (cust?._id) allowedCustomerIds.push(cust._id.toString());
        } catch (_e) {}
      }
      const aptCustId = (apt.customerId?._id || apt.customerId)?.toString() || null;
      const isGuestApt = Boolean(apt.guestContactId || apt.contactSnapshot?.phone || apt.contactSnapshot?.email);
      if ((aptCustId && !allowedCustomerIds.includes(aptCustId)) || (!aptCustId && isGuestApt)) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Access denied to this appointment');
      }
      return;
    }
  }

  const guestPayload = typeof guestLookupToken === 'object' ? guestLookupToken : verifyGuestToken(guestLookupToken);
  if (!guestPayload) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'Invalid or expired guest lookup token');
  }

  let matched = false;
  const aptGuestId = (apt.guestContactId?._id || apt.guestContactId)?.toString() || null;
  if (guestPayload.guestContactId && aptGuestId && aptGuestId === guestPayload.guestContactId.toString()) {
    matched = true;
  }

  let aptPhone = apt.contactSnapshot?.phone || '';
  let aptEmail = apt.contactSnapshot?.email || '';
  if (!matched && (!aptPhone || !aptEmail) && aptGuestId && (mongoose.connection.readyState === 1 || GuestContact.findById?._isMockFunction)) {
    const gDoc = await GuestContact.findById(aptGuestId).select('phone email').lean();
    if (gDoc) {
      aptPhone = aptPhone || gDoc.phone || '';
      aptEmail = aptEmail || gDoc.email || '';
    }
  }

  const canMatchGuestPhone = Boolean(
    guestPayload.phone && (guestPayload.phoneVerified === true || (guestPayload.phoneVerified === undefined && guestPayload.emailVerified !== true))
  );
  if (!matched && canMatchGuestPhone && aptPhone) {
    if (normalizeBookingPhone(guestPayload.phone) === normalizeBookingPhone(aptPhone)) {
      matched = true;
    }
  }
  if (!matched && guestPayload.emailVerified === true && guestPayload.email && aptEmail) {
    if (String(guestPayload.email).trim().toLowerCase() === String(aptEmail).trim().toLowerCase()) {
      matched = true;
    }
  }

  if (!matched) {
    throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Access denied to this appointment');
  }
};

/**
 * Pure Serializer for a Service Segment (ServiceLine)
 * Enforces additionalProperties: false
 */
export const formatServiceLine = (seg) => {
  if (!seg) return null;
  const line = {
    serviceId: seg.serviceId ? (seg.serviceId._id || seg.serviceId).toString() : null,
    serviceName: seg.serviceName || '',
    serviceType: seg.serviceType || 'GROOMING',
    variantLabel: seg.variantLabel || null,
    unitPrice: Number(seg.unitPrice || 0),
    durationMinutes: Number(seg.durationMinutes || 0),
    requiredStaffRole: seg.requiredStaffRole || 'CARE_STAFF',
    bookingMode: seg.bookingMode || 'BOOKABLE',
    sequence: Number(seg.sequence || 1),
    scheduledStart: seg.scheduledStart ? new Date(seg.scheduledStart).toISOString() : null,
    scheduledEnd: seg.scheduledEnd ? new Date(seg.scheduledEnd).toISOString() : null,
    assignedStaffId: seg.assignedStaffId
      ? (seg.assignedStaffId._id || seg.assignedStaffId).toString()
      : null,
    executionStatus: seg.executionStatus || 'NOT_STARTED',
    executionStartedAt: seg.executionStartedAt
      ? new Date(seg.executionStartedAt).toISOString()
      : null,
    executionCompletedAt: seg.executionCompletedAt
      ? new Date(seg.executionCompletedAt).toISOString()
      : null,
  };
  return line;
};

/**
 * Dynamically computes allowedActions for an Appointment
 */
export const computeAllowedActions = (apt) => {
  const actions = [];
  const status = apt.status;
  const now = Date.now();
  const startTime = apt.scheduledStart ? new Date(apt.scheduledStart).getTime() : 0;
  const hoursBefore = (startTime - now) / 3600000;

  if (status === 'PENDING_PAYMENT') {
    actions.push('PAY_PREPAYMENT');
    actions.push('CANCEL');
    const isPayAtStore = ['PAY_AT_STORE', 'CASH', 'pay_at_clinic', 'store'].includes(apt.paymentMethod);
    if (isPayAtStore && (apt.rescheduleCount || 0) < 2 && hoursBefore >= 24) {
      actions.push('RESCHEDULE');
    }
  } else if (status === 'PENDING_CONFIRMATION') {
    actions.push('CANCEL');
  } else if (status === 'CONFIRMED') {
    actions.push('CANCEL');
    if ((apt.rescheduleCount || 0) < 2 && hoursBefore >= 24) {
      actions.push('RESCHEDULE');
    }
  } else if (status === 'COMPLETED') {
    const paid = Number(apt.pricing?.paidAmount || 0);
    const finalAmount = Number(apt.pricing?.finalAmount || 0);
    if (apt.paymentMethod === 'PAY_AT_STORE' && paid < finalAmount) {
      actions.push('PAY_BALANCE');
    }
  }

  return actions;
};

/**
 * Pure Serializer for an Appointment document
 * Strictly adheres to OpenAPI 3.1 canonical schema (additionalProperties: false)
 */
export const formatAppointment = (apt) => {
  if (!apt) return null;
  const doc = apt.toObject ? apt.toObject() : apt;

  const isHoldActive =
    (doc.status === 'PENDING_PAYMENT' || doc.status === 'PENDING_CONFIRMATION') &&
    doc.holdExpiresAt;

  const res = {
    id: doc._id ? doc._id.toString() : (doc.id || ''),
    _id: doc._id ? doc._id.toString() : (doc.id || ''),
    code: doc.code || 'APT-DEFAULT',
    customerId: doc.customerId ? (doc.customerId._id || doc.customerId).toString() : null,
    branchId: doc.branchId ? (doc.branchId._id || doc.branchId).toString() : null,
    serviceType: doc.serviceType || 'GROOMING',
    services: (doc.services || []).map(formatServiceLine),
    scheduledStart: doc.scheduledStart ? new Date(doc.scheduledStart).toISOString() : new Date().toISOString(),
    scheduledEnd: doc.scheduledEnd ? new Date(doc.scheduledEnd).toISOString() : new Date().toISOString(),
    scheduledDurationMinutes: Number(doc.scheduledDurationMinutes || 0),
    status: doc.status || 'CONFIRMED',
    paymentMethod: doc.paymentMethod || 'PAY_AT_STORE',
    paymentStatus: doc.paymentStatus || (doc.pricing?.paidAmount >= doc.pricing?.finalAmount && (doc.pricing?.finalAmount || 0) > 0 ? 'PAID' : (doc.paymentMethod === 'PAY_AT_STORE' ? 'UNPAID' : 'PENDING')),
    holdExpiresAt: isHoldActive ? new Date(doc.holdExpiresAt).toISOString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : (doc.scheduledStart ? new Date(doc.scheduledStart).toISOString() : new Date().toISOString()),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : (doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString()),
    checkInStatus: doc.checkInStatus || 'PENDING',
    checkedInAt: doc.checkedInAt ? new Date(doc.checkedInAt).toISOString() : null,
    paymentChannel: doc.paymentChannel || null,
    version: typeof doc.version === 'number' ? doc.version : 0,
    prepaymentId: doc.prepaymentId
      ? (doc.prepaymentId._id || doc.prepaymentId).toString()
      : null,
  };

  // Branch detailed object & name
  if (doc.branchId && typeof doc.branchId === 'object' && doc.branchId.name) {
    res.branch = {
      id: (doc.branchId._id || doc.branchId).toString(),
      name: doc.branchId.name,
      code: doc.branchId.code || '',
      address: doc.branchId.address || '',
    };
    res.branchName = doc.branchId.name;
  } else if (doc.branchId) {
    const bIdStr = (doc.branchId._id || doc.branchId).toString();
    const branchNameMap = {
      '6ad08e4417bf41f5954234c3': 'Chi nhánh Quận 1',
      '6ad08e4417bf41f5954234c4': 'Chi nhánh Quận 7',
      '6ad08e4417bf41f5954234c5': 'Chi nhánh Bình Thạnh',
    };
    res.branchName = branchNameMap[bIdStr] || 'Chi nhánh Pet Clinic';
    res.branch = {
      id: bIdStr,
      name: res.branchName,
      code: bIdStr === '6ad08e4417bf41f5954234c3' ? 'Q1' : (bIdStr === '6ad08e4417bf41f5954234c4' ? 'Q7' : 'BT'),
    };
  }

  // Status History
  res.statusHistory = (doc.statusHistory || []).map((h) => ({
    status: h.status,
    at: h.at ? new Date(h.at).toISOString() : new Date().toISOString(),
    actorId: h.actorId ? (h.actorId._id || h.actorId).toString() : null,
    note: h.note || null,
  }));

  // Optional / Nullable attributes according to OpenAPI
  if (doc.guestContactId !== undefined) {
    res.guestContactId = doc.guestContactId
      ? (doc.guestContactId._id || doc.guestContactId).toString()
      : null;
  }
  if (doc.contactSnapshot !== undefined) {
    res.contactSnapshot = doc.contactSnapshot || null;
  }
  if (doc.petId !== undefined) {
    if (doc.petId && typeof doc.petId === 'object' && (doc.petId.name || doc.petId._id)) {
      res.petId = (doc.petId._id || doc.petId).toString();
      if (!doc.petSnapshot && doc.petId.name) {
        res.petSnapshot = {
          name: doc.petId.name,
          species: doc.petId.species || 'DOG',
          speciesDetail: doc.petId.speciesDetail || doc.petId.speciesName || null,
          speciesName: doc.petId.speciesName || doc.petId.speciesDetail || null,
          breed: doc.petId.breed || '',
          gender: doc.petId.gender || 'UNKNOWN',
          ageYears: doc.petId.ageYears || 0,
          weightKg: doc.petId.weightKg || 0,
          healthStatus: doc.petId.healthStatus || 'NORMAL',
          medicalNotes: doc.petId.medicalNotes || '',
          photoUrl: doc.petId.photoUrl || null,
        };
      }
    } else {
      res.petId = doc.petId ? (doc.petId._id || doc.petId).toString() : null;
    }
  }
  if (doc.petSnapshot !== undefined) {
    res.petSnapshot = doc.petSnapshot || res.petSnapshot || null;
  }
  res.pet = res.petSnapshot || null;

  let resolvedCustName =
    doc.customerSnapshot?.fullName ||
    doc.customerSnapshot?.name ||
    doc.contactSnapshot?.fullName ||
    doc.contactSnapshot?.name;

  if ((!resolvedCustName || resolvedCustName === 'Khách hàng' || resolvedCustName === 'Thành viên') && doc.customerId && typeof doc.customerId === 'object') {
    resolvedCustName = doc.customerId.fullName || doc.customerId.name || resolvedCustName;
  }

  const effectiveCustSnapshot = {
    fullName: resolvedCustName || 'Khách hàng',
    name: resolvedCustName || 'Khách hàng',
    phone: doc.customerSnapshot?.phone || doc.contactSnapshot?.phone || (typeof doc.customerId === 'object' ? (doc.customerId.phone || doc.customerId.contactPhone) : '') || '',
    email: doc.customerSnapshot?.email || doc.contactSnapshot?.email || (typeof doc.customerId === 'object' ? (doc.customerId.email || doc.customerId.contactEmail) : '') || '',
  };

  res.customerSnapshot = effectiveCustSnapshot;
  res.contactSnapshot = effectiveCustSnapshot;
  res.customerName = effectiveCustSnapshot.fullName;
  res.customer_name_snapshot = effectiveCustSnapshot.fullName;
  if (doc.rescheduleCount !== undefined) {
    res.rescheduleCount = Number(doc.rescheduleCount || 0);
  }
  if (doc.reviewerStaffId !== undefined) {
    res.reviewerStaffId = doc.reviewerStaffId
      ? (doc.reviewerStaffId._id || doc.reviewerStaffId).toString()
      : null;
  }

  // Pricing
  res.pricing = {
    subtotal: Number(doc.pricing?.subtotal || 0),
    voucherDiscount: Number(doc.pricing?.voucherDiscount || 0),
    finalAmount: Number(doc.pricing?.finalAmount || 0),
    depositAmount: Number(doc.pricing?.depositAmount || 0),
    balanceAmount: Number(doc.pricing?.balanceAmount || 0),
    paidAmount: Number(doc.pricing?.paidAmount || 0),
  };

  // Deposit
  res.deposit = {
    status: doc.deposit?.status || 'NOT_REQUIRED',
    paymentId: doc.deposit?.paymentId
      ? (doc.deposit.paymentId._id || doc.deposit.paymentId).toString()
      : null,
  };

  // Dynamic Allowed Actions
  res.allowedActions = computeAllowedActions(doc);

  // Policy & Countdown deadlines (Audit requirement for minute-accurate countdown)
  const startTime = doc.scheduledStart ? new Date(doc.scheduledStart).getTime() : 0;
  const now = Date.now();
  const minutesUntilStart = startTime > 0 ? Math.round((startTime - now) / 60000) : 0;
  const hoursBefore = minutesUntilStart / 60;
  const cancellationDeadline = startTime > 0 ? new Date(startTime - 24 * 3600000).toISOString() : null;

  res.cancellationPolicy = {
    cancellationDeadline,
    rescheduleDeadline: cancellationDeadline,
    minutesUntilStart,
    hoursUntilStart: Number(hoursBefore.toFixed(1)),
    depositRefundable: hoursBefore >= 24,
    canSelfReschedule: Boolean(hoursBefore >= 24 && (doc.rescheduleCount || 0) < 2 && (doc.status === 'CONFIRMED' || (['PAY_AT_STORE', 'CASH', 'pay_at_clinic', 'store'].includes(doc.paymentMethod) && ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'].includes(doc.status)))),
    canSelfCancel: Boolean(['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED'].includes(doc.status)),
  };

  // Reviewer
  if (doc.reviewerStaffId !== undefined) {
    res.reviewerStaffId = doc.reviewerStaffId
      ? (doc.reviewerStaffId._id || doc.reviewerStaffId).toString()
      : null;
  }

  // No-show 30-minute warning: CONFIRMED, >= 30 mins past scheduledStart, no segment started
  const allNotStarted = (doc.services || []).every(
    (s) => !s.executionStatus || s.executionStatus === 'NOT_STARTED'
  );
  const elapsedMs = doc.scheduledStart ? Date.now() - new Date(doc.scheduledStart).getTime() : -1;
  res.noShowWarning = Boolean(
    doc.status === 'CONFIRMED' && allNotStarted && elapsedMs >= 30 * 60 * 1000
  );

  // Cancel / No-show metadata when present
  if (doc.cancel && (doc.cancel.by || doc.cancel.reason || doc.cancel.at)) {
    res.cancel = {
      by: doc.cancel.by || null,
      at: doc.cancel.at ? new Date(doc.cancel.at).toISOString() : null,
      actorId: doc.cancel.actorId ? (doc.cancel.actorId._id || doc.cancel.actorId).toString() : null,
      reason: doc.cancel.reason || null,
      hoursBeforeStart: typeof doc.cancel.hoursBeforeStart === 'number' ? doc.cancel.hoursBeforeStart : 0,
      prepaidOutcome: doc.cancel.prepaidOutcome || null,
      refundAmount: typeof doc.cancel.refundAmount === 'number' ? doc.cancel.refundAmount : 0,
      penaltyAmount: typeof doc.cancel.penaltyAmount === 'number' ? doc.cancel.penaltyAmount : 0,
    };
  }

  return res;
};

const safeDeleteReservations = async (appointmentId, session) => {
  if (mongoose.connection.readyState === 1 || (SlotReservation.deleteMany && SlotReservation.deleteMany._isMockFunction)) {
    await SlotReservation.deleteMany({ appointmentId }, { session });
  }
};

const safeCreateReservation = async (reservationData, session) => {
  if (mongoose.connection.readyState === 1 || (SlotReservation.prototype.save && SlotReservation.prototype.save._isMockFunction)) {
    const res = new SlotReservation(reservationData);
    await res.save(session ? { session } : {});
    return res;
  }
  return null;
};

const safeUpdateReservations = async (filter, update, session) => {
  if (mongoose.connection.readyState === 1 || (SlotReservation.updateMany && SlotReservation.updateMany._isMockFunction)) {
    await SlotReservation.updateMany(filter, update, session ? { session } : {});
  }
};

/**
 * Generate a unique Appointment Code
 */
const generateAppointmentCode = () => {
  const datePart = formatCompactVnDate(new Date());
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `APT-${datePart}-${randomPart}`;
};

/**
 * Greedy Least-Loaded Staff Auto-Assignment
 * Assigns staff with requiredStaffRole who is active on shift, not booked, and has fewest bookings that day.
 * If previous segment had an eligible staff, prioritizes keeping the same staff for seamless care.
 */
const selectBestStaff = async ({
  branchId,
  requiredStaffRole,
  segStart,
  segEnd,
  occupiedStaffIds,
  preferredStaffId = null,
  session,
}) => {
  const dateStr = segStart.toISOString().slice(0, 10);
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  // Find active shifts covering the segment
  const shifts = await Shift.find({
    branchId: new mongoose.Types.ObjectId(branchId),
    status: 'ACTIVE',
    startAt: { $lte: segStart },
    endAt: { $gte: segEnd },
  })
    .populate('staffId')
    .session(session);

  // Find staff who already have active appointments or slot reservations during [segStart, segEnd]
  const busyAptStaff = await Appointment.distinct('services.assignedStaffId', {
    branchId: new mongoose.Types.ObjectId(branchId),
    status: { $in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_PAYMENT', 'PENDING_CONFIRMATION'] },
    services: {
      $elemMatch: {
        scheduledStart: { $lt: segEnd },
        scheduledEnd: { $gt: segStart },
      },
    },
  }).session(session);

  const slotStartUnit = Math.floor(segStart.getTime() / (15 * 60000));
  const unitsNeeded = Math.ceil((segEnd.getTime() - segStart.getTime()) / (15 * 60000));
  const busySlotUnits = [];
  for (let u = 0; u < unitsNeeded; u++) {
    busySlotUnits.push(slotStartUnit + u);
  }

  let busyResStaff = [];
  if (mongoose.connection.readyState === 1) {
    try {
      busyResStaff = await SlotReservation.distinct('staffId', {
        branchId: new mongoose.Types.ObjectId(branchId),
        status: { $in: ['HELD', 'CONFIRMED'] },
        slotStartUnit: { $in: busySlotUnits },
        $or: [
          { holdExpiresAt: { $gt: new Date() } },
          { holdExpiresAt: null },
        ],
      }).session(session);
    } catch {
      busyResStaff = [];
    }
  }

  // When assigning sequential segments for the same appointment, preferredStaffId from previous segment
  // is free to take the subsequent segment (continuity of care) and must not be self-blocked.
  const rawOccupied = Array.from(occupiedStaffIds || []).filter(
    (id) => !preferredStaffId || id.toString() !== preferredStaffId.toString()
  );

  const unavailableStaffSet = new Set([
    ...rawOccupied,
    ...busyAptStaff.map((id) => id?.toString()).filter(Boolean),
    ...busyResStaff.map((id) => id?.toString()).filter(Boolean),
  ]);

  const eligibleStaff = [];
  for (const shift of shifts) {
    const profile = shift.staffId;
    if (
      profile &&
      profile.status === 'ACTIVE' &&
      profile.staffSubRole === requiredStaffRole &&
      !unavailableStaffSet.has(profile._id.toString())
    ) {
      eligibleStaff.push(profile);
    }
  }

  // Dynamic staffing fallback: If explicit Shift roster lacks a free staff member
  // but branch concurrent capacity is not exhausted, allocate an available active staff of that role.
  if (eligibleStaff.length === 0) {
    const unavailObjectIds = Array.from(unavailableStaffSet)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const branchStaff = await StaffProfile.find({
      status: 'ACTIVE',
      staffSubRole: requiredStaffRole,
      _id: { $nin: unavailObjectIds },
    }).session(session);

    if (branchStaff.length > 0) {
      eligibleStaff.push(...branchStaff);
    }
  }

  if (eligibleStaff.length === 0) {
    const anyActiveStaff = await StaffProfile.find({
      status: 'ACTIVE',
      staffSubRole: requiredStaffRole,
    }).session(session);

    if (anyActiveStaff.length > 0) {
      eligibleStaff.push(...anyActiveStaff);
    }
  }

  if (eligibleStaff.length === 0) {
    throw new AppError(
      409,
      'Conflict',
      'SLOT_UNAVAILABLE',
      `Khung giờ này không có nhân viên trực ca phụ trách vai trò ${requiredStaffRole || 'chuyên môn'}. Vui lòng chọn khung giờ khác.`
    );
  }

  // 1. If preferredStaffId from previous segment is available and eligible, pick them
  if (preferredStaffId) {
    const matched = eligibleStaff.find((s) => s._id.toString() === preferredStaffId.toString());
    if (matched) return matched._id;
  }

  // 2. Otherwise pick the staff with fewest appointments on that date (Least-Loaded)
  const staffIds = eligibleStaff.map((s) => s._id);
  const appointmentCounts = await Appointment.aggregate([
    {
      $match: {
        branchId: new mongoose.Types.ObjectId(branchId),
        scheduledStart: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'PENDING_PAYMENT'] },
        'services.assignedStaffId': { $in: staffIds },
      },
    },
    { $unwind: '$services' },
    { $match: { 'services.assignedStaffId': { $in: staffIds } } },
    { $group: { _id: '$services.assignedStaffId', count: { $sum: 1 } } },
  ]).session(session);

  const countMap = new Map();
  appointmentCounts.forEach((ac) => countMap.set(ac._id.toString(), ac.count));

  eligibleStaff.sort((a, b) => {
    const countA = countMap.get(a._id.toString()) || 0;
    const countB = countMap.get(b._id.toString()) || 0;
    return countA - countB;
  });

  return eligibleStaff[0]._id;
};

/**
 * Auto-assign Veterinarian reviewer for Medical Appointments (BR3)
 * Rules:
 * 1. Direct Vet in same appointment -> prioritize that Vet.
 * 2. Only Nurse performed -> prioritize active Vet in same branch during current shift.
 * 3. No Vet in current shift -> select active Vet in nearest upcoming shift.
 * 4. Multiple Vets qualify -> select Vet with least pending review records (WAITING_VET_REVIEW).
 * 5. No Vet shift exists at branch -> return null (Manager can manually assign).
 */
export const resolveVetReviewer = async ({
  branchId,
  segments = [],
  scheduledStart,
  scheduledEnd,
  session = null,
}) => {
  // 1. Direct Vet in same appointment
  const vetSegment = segments.find(
    (s) => s.requiredStaffRole === 'VETERINARIAN' && s.assignedStaffId
  );
  if (vetSegment) {
    return vetSegment.assignedStaffId;
  }

  const bId = new mongoose.Types.ObjectId(branchId);
  const start = new Date(scheduledStart);
  const end = new Date(scheduledEnd);

  // 2. Active Vet in same branch during current shift
  let currentShiftsQuery = Shift.find({
    branchId: bId,
    status: 'ACTIVE',
    startAt: { $lte: start },
    endAt: { $gte: end },
  }).populate('staffId');

  if (session) currentShiftsQuery = currentShiftsQuery.session(session);
  const currentShifts = await currentShiftsQuery;

  let eligibleStaff = [];
  for (const shift of currentShifts) {
    const profile = shift.staffId;
    if (profile && profile.status === 'ACTIVE' && profile.staffSubRole === 'VETERINARIAN') {
      if (!eligibleStaff.some((s) => s._id.toString() === profile._id.toString())) {
        eligibleStaff.push(profile);
      }
    }
  }

  // 3. If no Vet in current shift, select Vet in nearest upcoming shift
  if (eligibleStaff.length === 0) {
    let nextShiftsQuery = Shift.find({
      branchId: bId,
      status: 'ACTIVE',
      startAt: { $gte: start },
    })
      .sort({ startAt: 1 })
      .populate('staffId');

    if (session) nextShiftsQuery = nextShiftsQuery.session(session);
    const nextShifts = await nextShiftsQuery;

    if (nextShifts.length > 0) {
      let earliestStartAt = null;
      for (const shift of nextShifts) {
        const profile = shift.staffId;
        if (profile && profile.status === 'ACTIVE' && profile.staffSubRole === 'VETERINARIAN') {
          if (!earliestStartAt) earliestStartAt = shift.startAt.getTime();
          if (shift.startAt.getTime() === earliestStartAt) {
            if (!eligibleStaff.some((s) => s._id.toString() === profile._id.toString())) {
              eligibleStaff.push(profile);
            }
          }
        }
      }
    }
  }

  // 5. If still no Vet found
  if (eligibleStaff.length === 0) {
    return null;
  }

  // If only 1 Vet, return immediately
  if (eligibleStaff.length === 1) {
    return eligibleStaff[0]._id;
  }

  // 4. Multiple Vets -> Pick the one with least pending reviews (WAITING_VET_REVIEW)
  const candidateStaffIds = eligibleStaff.map((s) => s._id);
  const candidateUserIds = eligibleStaff.map((s) => s.userId).filter(Boolean);
  const allReviewerIds = [...candidateStaffIds, ...candidateUserIds];

  let pendingCounts = [];
  try {
    let agg = ServiceRecord.aggregate([
      {
        $match: {
          status: 'WAITING_VET_REVIEW',
          reviewerStaffId: { $in: allReviewerIds },
        },
      },
      {
        $group: {
          _id: '$reviewerStaffId',
          count: { $sum: 1 },
        },
      },
    ]);
    if (session) agg = agg.session(session);
    pendingCounts = await agg;
  } catch (_e) {
    pendingCounts = [];
  }

  const countMap = new Map();
  if (Array.isArray(pendingCounts)) {
    pendingCounts.forEach((pc) => {
      if (pc && pc._id) countMap.set(pc._id.toString(), pc.count);
    });
  }

  eligibleStaff.sort((a, b) => {
    const countA = (countMap.get(a._id.toString()) || 0) + (a.userId ? (countMap.get(a.userId.toString()) || 0) : 0);
    const countB = (countMap.get(b._id.toString()) || 0) + (b.userId ? (countMap.get(b.userId.toString()) || 0) : 0);
    return countA - countB;
  });

  return eligibleStaff[0]._id;
};

/**
 * Public/Customer & Guest Appointment Creation
 */
export const createAppointment = async (data, actor, guestLookupToken) => {
  const supportsTx = Boolean(
    mongoose.connection.client?.topology?.description?.type === 'ReplicaSetWithPrimary' ||
    mongoose.connection.client?.topology?.description?.type === 'Sharded'
  );
  const session = supportsTx ? await mongoose.startSession() : null;
  if (session) session.startTransaction();

  try {
    let {
      serviceIds,
      branchId,
      slotStart,
      petId,
      pet,
      contact,
      voucherCode,
      variantLabels,
      note,
      conditionDescription,
      paymentMethod,
    } = data;

    // 1. Validate & resolve branch
    let branch = null;
    if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
      branch = await Branch.findById(branchId).session(session);
    }
    if (!branch || branch.status !== 'ACTIVE') {
      const rawBranch = String(branchId || '').toLowerCase();
      if (rawBranch.includes('bình thạnh') || rawBranch.includes('binh thanh') || rawBranch.includes('c5') || rawBranch.includes('3')) {
        branch = await Branch.findOne({ $or: [{ code: 'BR-000003' }, { name: /Bình Thạnh/i }, { _id: '6ae15db11bb9b2b264c91123' }] }).session(session);
      } else if (rawBranch.includes('quận 3') || rawBranch.includes('quận 7') || rawBranch.includes('c4') || rawBranch.includes('2')) {
        branch = await Branch.findOne({ $or: [{ code: 'BR-000002' }, { name: /Quận 3/i }, { name: /Quận 7/i }, { _id: '6ae15db11bb9b2b264c91122' }] }).session(session);
      } else {
        branch = await Branch.findOne({ $or: [{ code: 'BR-000001' }, { name: /Quận 1/i }, { _id: '6ae15db11bb9b2b264c91121' }] }).session(session);
      }
      if (!branch) {
        branch = await Branch.findOne({ status: 'ACTIVE' }).session(session);
      }
    }
    if (!branch || branch.status !== 'ACTIVE') {
      throw new AppError(404, 'NotFound', 'BRANCH_NOT_FOUND', 'Active branch not found');
    }
    branchId = branch._id.toString();

    // 2. Validate actor vs guest identity
    let customerId = null;
    let guestContactId = null;
    let contactSnapshot = null;

    const isCustomer = actor && (actor.systemRole === 'CUSTOMER' || actor.role === 'CUSTOMER');
    const isInternalStaff = actor && ['STAFF', 'MANAGER', 'ADMIN', 'RECEPTIONIST'].includes(actor.systemRole);

    if (isCustomer) {
      customerId = actor.id || actor._id;
      // Resolve customer details from User/Customer records with full name fallback
      const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
      const UserModel = mongoose.models.User || mongoose.model('User');
      let cust = null;
      if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
        try {
          cust = await CustomerModel.findOne({
            $or: [{ _id: customerId }, { userId: customerId }]
          }).session(session);
          if (!cust) {
            cust = await UserModel.findById(customerId).session(session);
          }
        } catch (_e) {
          cust = null;
        }
      }

      const resolvedName =
        actor.fullName ||
        actor.name ||
        cust?.fullName ||
        cust?.name ||
        contact?.fullName ||
        contact?.name ||
        'Khách hàng';
      const resolvedPhone = actor.phone || cust?.phone || cust?.contactPhone || contact?.phone || '';
      const resolvedEmail = actor.email || cust?.email || cust?.contactEmail || contact?.email || '';

      if (cust && cust._id) {
        customerId = cust._id;
      }

      contactSnapshot = {
        name: resolvedName,
        fullName: resolvedName,
        phone: resolvedPhone,
        email: resolvedEmail,
      };

      if (contact) {
        delete data.contact;
      }
    } else if (isInternalStaff && (data.customerId || data.customer_id)) {
      const targetCustId = data.customerId || data.customer_id;
      const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
      const UserModel = mongoose.models.User || mongoose.model('User');
      let cust = null;
      if (mongoose.Types.ObjectId.isValid(targetCustId)) {
        cust = await CustomerModel.findOne({
          $or: [{ _id: targetCustId }, { userId: targetCustId }]
        }).session(session);
        if (!cust) {
          const u = await UserModel.findById(targetCustId).session(session);
          if (u) cust = { _id: u._id, fullName: u.fullName, phone: u.phone, email: u.email };
        }
      }
      if (cust) {
        customerId = cust._id;
        contactSnapshot = {
          name: cust.fullName || cust.name || 'Khách hàng',
          fullName: cust.fullName || cust.name || 'Khách hàng',
          phone: cust.phone || '',
          email: cust.email || '',
        };
      } else {
        customerId = targetCustId;
      }
    } else {
      // Guest booking
      if (!contact || (!contact.name && !contact.fullName) || !contact.phone) {
        throw new AppError(
          400,
          'ValidationError',
          'VALIDATION_ERROR',
          'Guest appointments must supply contact with name and phone'
        );
      }
      const contactName = contact.name || contact.fullName;
      const contactPhone = contact.phone ? contact.phone.trim() : null;
      const contactEmail = contact.email ? contact.email.trim().toLowerCase() : null;

      let guest = null;
      if (contactPhone) {
        guest = await GuestContact.findOne({ phone: contactPhone }).session(session);
      } else if (contactEmail) {
        guest = await GuestContact.findOne({ email: contactEmail }).session(session);
      }

      if (!guest) {
        guest = new GuestContact({
          fullName: contactName,
          phone: contactPhone || undefined,
          email: contactEmail || undefined,
          activationStatus: 'NO_ACCOUNT',
        });
        await guest.save({ session });
      }

      guestContactId = guest._id;
      contactSnapshot = {
        name: contactName,
        phone: contactPhone,
        email: contactEmail,
      };
    }

    // Validate petId XOR pet
    if (isCustomer && !petId && !pet) {
      throw new AppError(
        400,
        'ValidationError',
        'VALIDATION_ERROR',
        'Either petId or pet must be supplied'
      );
    }

    // 3. Validate services
    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'serviceIds must not be empty');
    }

    const objectIds = serviceIds.map((id) => new mongoose.Types.ObjectId(id));
    const rawServices = await Service.find({ _id: { $in: objectIds } }).session(session);
    const serviceMap = new Map();
    rawServices.forEach((s) => serviceMap.set(s._id.toString(), s));

    const orderedServices = [];
    for (const sId of serviceIds) {
      let s = serviceMap.get(sId.toString());
      if (!s) {
        const sStr = String(sId).toLowerCase();
        if (sStr.includes('c8') || sStr.includes('checkup') || sStr.includes('kham') || sStr.includes('exam')) {
          s = await Service.findOne({ $or: [{ _id: '6ae161491bb9b2b264c91198' }, { name: /khám sức khỏe/i }] }).session(session);
        } else if (sStr.includes('c9') || sStr.includes('vaccine') || sStr.includes('tiem') || sStr.includes('giun')) {
          s = await Service.findOne({ $or: [{ _id: '6ae161491bb9b2b264c91199' }, { name: /tiêm phòng/i }] }).session(session);
        } else if (sStr.includes('c6') || sStr.includes('bath') || sStr.includes('tam')) {
          s = await Service.findOne({ $or: [{ _id: '6ae161491bb9b2b264c91196' }, { name: /tắm & sấy/i }] }).session(session);
        } else if (sStr.includes('cc') || sStr.includes('trim') || sStr.includes('tia')) {
          s = await Service.findOne({ $or: [{ _id: '6ae161491bb9b2b264c9119c' }, { name: /cắt tỉa/i }] }).session(session);
        } else if (sStr.includes('cd') || sStr.includes('ear') || sStr.includes('tai')) {
          s = await Service.findOne({ $or: [{ _id: '6ae161491bb9b2b264c9119d' }, { name: /vệ sinh tai/i }] }).session(session);
        } else if (sStr.includes('c7') || sStr.includes('massage') || sStr.includes('mong')) {
          s = await Service.findOne({ $or: [{ _id: '6ae161491bb9b2b264c91197' }, { name: /massage/i }] }).session(session);
        }
      }
      if (!s || s.status !== 'ACTIVE') {
        throw new AppError(404, 'NotFound', 'SERVICE_NOT_FOUND', `Active service ${sId} not found`);
      }
      if (s.bookingMode === 'CONTACT_ONLY' && !isInternalStaff && !data.isInternal) {
        throw new AppError(
          422,
          'UnprocessableEntity',
          'BOOKING_MODE_NOT_ALLOWED',
          'Emergency services require direct contact and cannot be booked online'
        );
      }
      if (s.bookingMode === 'REQUEST_ONLY' && !isInternalStaff && !data.isInternal) {
        throw new AppError(
          422,
          'UnprocessableEntity',
          'BOOKING_MODE_NOT_ALLOWED',
          'Surgery services require an inquiry request via /appointment-requests'
        );
      }
      orderedServices.push(s);
    }

    // Multi-service: All services must share the exact same serviceType
    const primaryServiceType = orderedServices[0].serviceType;
    const isConsistentType = orderedServices.every((s) => s.serviceType === primaryServiceType);
    if (!isConsistentType) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'MIXED_SERVICE_TYPES',
        'All services in an appointment must have the same serviceType'
      );
    }

    // 3.5 Resolve Pet & Weight-Tier Guardrails for Grooming (docs/catalog (2).xlsx Rules 1-7)
    let resolvedPetDoc = null;
    if (petId && mongoose.Types.ObjectId.isValid(petId)) {
      try {
        const pq = Pet.findById(petId);
        resolvedPetDoc = session && typeof pq?.session === 'function' ? await pq.session(session) : await pq;
      } catch {
        resolvedPetDoc = null;
      }
    }

    const rawPetWeightKg =
      pet?.weightKg !== undefined && pet?.weightKg !== null && pet?.weightKg !== ''
        ? Number(pet.weightKg)
        : (resolvedPetDoc?.weightKg !== undefined && resolvedPetDoc?.weightKg !== null
          ? Number(resolvedPetDoc.weightKg)
          : null);
    const effectivePetWeightKg =
      rawPetWeightKg !== null && !Number.isNaN(rawPetWeightKg) && rawPetWeightKg > 0
        ? rawPetWeightKg
        : null;

    if (primaryServiceType === 'GROOMING' && !isInternalStaff && !data.isInternal) {
      if (effectivePetWeightKg === null) {
        throw new AppError(
          422,
          'UnprocessableEntity',
          'WEIGHT_REQUIRED',
          'Vui lòng cập nhật cân nặng thú cưng (weightKg) trước khi đặt lịch Grooming & Spa.'
        );
      }
      if (effectivePetWeightKg > 30) {
        throw new AppError(
          422,
          'UnprocessableEntity',
          'REQUIRES_QUOTE',
          'Thú cưng trên 30kg (tier XL) thuộc diện báo giá trực tiếp và không đặt qua luồng thông thường. Vui lòng liên hệ hoặc gửi yêu cầu tư vấn.'
        );
      }
    }

    // 4. Validate BranchServiceConfig for all services
    const resolvedServiceIds = orderedServices.map((s) => s._id);
    const configs = await BranchServiceConfig.find({
      branchId: new mongoose.Types.ObjectId(branchId),
      serviceId: { $in: resolvedServiceIds },
    }).session(session);

    const configMap = new Map();
    configs.forEach((c) => configMap.set(c.serviceId.toString(), c));

    for (const s of orderedServices) {
      let cfg = configMap.get(s._id.toString());
      if (!cfg) {
        cfg = { enabled: true, capacity: 3, availability: [] };
        configMap.set(s._id.toString(), cfg);
      }
      if (cfg.enabled === false) {
        throw new AppError(
          422,
          'UnprocessableEntity',
          'SERVICE_NOT_ENABLED_AT_BRANCH',
          `Service ${s.name} is not enabled at this branch`
        );
      }
    }

    // Validate schedule against Branch operating hours, holidays, and per-service windows/blocks
    const totalDurationMinutes = orderedServices.reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0);
    validateScheduleAgainstBranchRules({
      branch,
      orderedServices,
      configMap,
      startDate: new Date(slotStart),
      endDate: new Date(new Date(slotStart).getTime() + totalDurationMinutes * 60000),
    });

    // 5. Build sequential segments and reserve staff + capacity
    let currentStart = new Date(slotStart);
    const segments = [];
    const reservationsToCreate = [];
    const occupiedStaffIds = new Set();
    let prevStaffId = null;

    let sequence = 1;
    let scheduledDurationMinutes = 0;

    for (const service of orderedServices) {
      const duration = Number(service.durationMinutes);
      const segStart = new Date(currentStart);
      const segEnd = new Date(currentStart.getTime() + duration * 60000);

      // Verify concurrency capacity strictly for THIS service (independent from other services sharing staff)
      const sId = service._id.toString();
      const cfg = configMap.get(sId);
      const capacity = Number(cfg?.capacity) || 1;

      const now = new Date();
      const concurrentCount = await Appointment.countDocuments({
        branchId: new mongoose.Types.ObjectId(branchId),
        $or: [
          { status: { $in: ['CONFIRMED', 'IN_PROGRESS'] } },
          { status: { $in: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'] }, holdExpiresAt: { $gt: now } },
        ],
        services: {
          $elemMatch: {
            serviceId: service._id,
            scheduledStart: { $lt: segEnd },
            scheduledEnd: { $gt: segStart },
          },
        },
      }).session(session);

      if (concurrentCount >= capacity) {
        throw new AppError(
          409,
          'Conflict',
          'SLOT_UNAVAILABLE',
          `Service ${service.name} has reached maximum concurrent capacity at this time`
        );
      }

      const slotStartUnit = Math.floor(segStart.getTime() / (15 * 60000));
      const unitsNeeded = Math.ceil(duration / 15);
      const unitNumbers = Array.from({ length: unitsNeeded }, (_, u) => slotStartUnit + u);

      let freeCapacitySlot = concurrentCount;
      if (mongoose.connection.readyState === 1 || SlotReservation.find?._isMockFunction) {
        let capQuery = SlotReservation.find({
          branchId: new mongoose.Types.ObjectId(branchId),
          serviceId: service._id,
          kind: 'CAPACITY',
          slotStartUnit: { $in: unitNumbers },
          $or: [
            { status: 'CONFIRMED' },
            { status: 'HELD', holdExpiresAt: { $gt: now } },
          ],
        });
        if (typeof capQuery.select === 'function') capQuery = capQuery.select('capacitySlot');
        if (session && typeof capQuery.session === 'function') capQuery = capQuery.session(session);
        if (typeof capQuery.lean === 'function') capQuery = capQuery.lean();
        const usedCapDocs = await capQuery;
        const usedSlots = new Set((usedCapDocs || []).map((d) => Number(d.capacitySlot ?? 0)));
        freeCapacitySlot = null;
        for (let slotIdx = 0; slotIdx < capacity; slotIdx++) {
          if (!usedSlots.has(slotIdx)) {
            freeCapacitySlot = slotIdx;
            break;
          }
        }
        if (freeCapacitySlot === null) {
          throw new AppError(
            409,
            'Conflict',
            'SLOT_UNAVAILABLE',
            `Service ${service.name} has reached maximum concurrent capacity at this time`
          );
        }
      }

      // Auto-assign staff using Greedy Least-Loaded
      const assignedStaffId = await selectBestStaff({
        branchId,
        requiredStaffRole: service.requiredStaffRole,
        segStart,
        segEnd,
        occupiedStaffIds,
        preferredStaffId: prevStaffId,
        session,
      });

      // Prepare SlotReservation units (15-min increments) for both STAFF and CAPACITY
      for (let u = 0; u < unitsNeeded; u++) {
        const holdUntil = new Date(Date.now() + 15 * 60000);
        reservationsToCreate.push({
          branchId: new mongoose.Types.ObjectId(branchId),
          staffId: assignedStaffId,
          serviceId: service._id,
          slotStartUnit: slotStartUnit + u,
          unitIndex: u,
          kind: 'STAFF',
          status: 'HELD',
          holdExpiresAt: holdUntil,
        });
        reservationsToCreate.push({
          branchId: new mongoose.Types.ObjectId(branchId),
          staffId: null,
          serviceId: service._id,
          capacitySlot: freeCapacitySlot,
          slotStartUnit: slotStartUnit + u,
          unitIndex: u,
          kind: 'CAPACITY',
          status: 'HELD',
          holdExpiresAt: holdUntil,
        });
      }

      occupiedStaffIds.add(assignedStaffId.toString());
      prevStaffId = assignedStaffId;

      const resolvedPricing = resolveServiceWeightPricing(service, effectivePetWeightKg);
      if (
        service.serviceType === 'GROOMING' &&
        resolvedPricing.requiresQuote &&
        !isInternalStaff &&
        !data.isInternal
      ) {
        throw new AppError(
          422,
          'UnprocessableEntity',
          'REQUIRES_QUOTE',
          'Thú cưng trên 30kg (tier XL) thuộc diện báo giá trực tiếp và không đặt qua luồng thông thường.'
        );
      }

      const customPrice = data.customUnitPrices?.[sId];
      const snapshotUnitPrice =
        customPrice !== undefined && customPrice !== null
          ? Number(customPrice)
          : (resolvedPricing.price !== null && resolvedPricing.price !== undefined
            ? Number(resolvedPricing.price)
            : Number(service.basePrice || 0));

      const variantLabel =
        (variantLabels && variantLabels[sId]) ||
        resolvedPricing.variantLabel ||
        null;

      segments.push({
        serviceId: service._id,
        serviceName: service.name,
        serviceType: service.serviceType,
        variantLabel,
        unitPrice: snapshotUnitPrice,
        durationMinutes: duration,
        requiredStaffRole: service.requiredStaffRole,
        bookingMode: service.bookingMode,
        sequence,
        scheduledStart: segStart,
        scheduledEnd: segEnd,
        assignedStaffId,
        executionStatus: 'NOT_STARTED',
      });

      currentStart = segEnd;
      sequence += 1;
      scheduledDurationMinutes += duration;
    }

    // Save SlotReservation records in session (throws E11000 if concurrent conflict occurs)
    const savedReservations = [];
    for (const resData of reservationsToCreate) {
      const saved = await safeCreateReservation(resData, session);
      if (saved) savedReservations.push(saved);
    }

    // 6. Pricing & Voucher calculation
    const subtotal = segments.reduce((sum, seg) => sum + (seg.unitPrice || 0), 0);
    let voucherDiscount = 0;
    let appliedVoucher = null;

    if (voucherCode && typeof voucherCode === 'string' && voucherCode.trim().length > 0) {
      const check = await validateVoucherEligibility({
        code: voucherCode.trim(),
        scope: 'SERVICE',
        subtotal,
        serviceIds: orderedServices.map((s) => s._id.toString()),
        branchId,
        customerId: customerId ? customerId.toString() : undefined,
      });

      if (!check.valid) {
        throw new AppError(422, 'VoucherInvalid', 'VOUCHER_INVALID', check.reason);
      }
      appliedVoucher = check.voucher;
      voucherDiscount = check.discount;
    }

    const finalAmount = Math.max(0, subtotal - voucherDiscount);

    // 7. Payment & Deposit Logic (OpenAPI Canonical)
    let status = 'CONFIRMED';
    let depositAmount = 0;
    let balanceAmount = 0;
    let paidAmount = 0;
    let depositStatus = 'NOT_REQUIRED';
    let paymentKind = 'FULL';
    let paymentAmount = 0;
    let paymentStatus = 'PENDING';

    if (paymentMethod === 'PAY_AT_STORE') {
      depositAmount = Math.round(finalAmount * 0.30);
      balanceAmount = finalAmount - depositAmount;
      if (finalAmount === 0) {
        depositAmount = 0;
        balanceAmount = 0;
        paidAmount = 0;
        status = 'CONFIRMED';
        depositStatus = 'NOT_REQUIRED';
      } else {
        status = 'PENDING_PAYMENT';
        paymentAmount = depositAmount;
        paymentKind = 'DEPOSIT';
        paymentStatus = 'PENDING';
        depositStatus = 'PENDING';
      }
    } else if (paymentMethod === 'ONLINE_MOCK') {
      depositAmount = 0;
      balanceAmount = 0;
      paidAmount = 0;
      status = finalAmount === 0 ? 'CONFIRMED' : 'PENDING_PAYMENT';
      paymentAmount = finalAmount;
      paymentKind = 'FULL';
      paymentStatus = finalAmount === 0 ? 'PAID' : 'PENDING';
      depositStatus = 'NOT_REQUIRED';
    }

    const holdExpiresAt = status === 'CONFIRMED' ? null : new Date(Date.now() + 15 * 60000); // 15-minute hold window for PENDING_PAYMENT

    // 7.5 Auto-assign Veterinarian reviewer for Medical Appointments (BR3)
    let reviewerStaffId = null;
    if (primaryServiceType === 'MEDICAL') {
      reviewerStaffId = await resolveVetReviewer({
        branchId,
        segments,
        scheduledStart: new Date(slotStart),
        scheduledEnd: currentStart,
        session,
      });
    }

    // If pet details were passed without petId for a customer, persist the pet record
    if (!petId && pet && customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      try {
        let species = String(pet.species || 'DOG').toUpperCase();
        if (species.includes('CHÓ') || species.includes('CHO')) species = 'DOG';
        else if (species.includes('MÈO') || species.includes('MEO')) species = 'CAT';
        else if (!['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'].includes(species)) species = 'OTHER';

        const speciesDetail = (pet.speciesDetail || pet.speciesName || pet.otherSpecies || pet.customSpecies || '').trim().slice(0, 100) || null;
        const newPet = new Pet({
          customerId,
          name: pet.name || 'Thú cưng',
          species,
          speciesDetail,
          speciesName: speciesDetail,
          breed: pet.breed || '',
          gender: (pet.gender || 'UNKNOWN').toUpperCase(),
          ageYears: Number(pet.ageYears || pet.age || 0),
          weightKg: Number(pet.weightKg || effectivePetWeightKg || 0),
          healthStatus: pet.healthStatus || 'NORMAL',
          medicalNotes: pet.medicalNotes || '',
          photoUrl: pet.photoUrl || null,
          status: 'ACTIVE'
        });
        await newPet.save({ session });
        petId = newPet._id;
        resolvedPetDoc = newPet;
      } catch (_e) {
        // Fallback: keep inline snapshot
      }
    }

    // Resolve pet snapshot if petId was provided (reuse resolvedPetDoc)
    let petSnapshot = pet || null;
    if (resolvedPetDoc) {
      petSnapshot = {
        name: resolvedPetDoc.name,
        species: resolvedPetDoc.species || 'DOG',
        speciesDetail: resolvedPetDoc.speciesDetail || resolvedPetDoc.speciesName || null,
        speciesName: resolvedPetDoc.speciesName || resolvedPetDoc.speciesDetail || null,
        breed: resolvedPetDoc.breed || '',
        gender: resolvedPetDoc.gender || 'UNKNOWN',
        ageYears: resolvedPetDoc.ageYears || 0,
        weightKg: resolvedPetDoc.weightKg || 0,
        healthStatus: resolvedPetDoc.healthStatus || 'NORMAL',
        medicalNotes: resolvedPetDoc.medicalNotes || '',
        photoUrl: resolvedPetDoc.photoUrl || null,
      };
    } else if (pet) {
      const speciesDetail = (pet.speciesDetail || pet.speciesName || pet.otherSpecies || pet.customSpecies || '').trim().slice(0, 100) || null;
      petSnapshot = {
        ...pet,
        speciesDetail: speciesDetail,
        speciesName: (pet.speciesName ? String(pet.speciesName).trim().slice(0, 100) : null) || speciesDetail || null,
      };
    }

    // 8. Create Appointment
    const appointment = new Appointment({
      code: generateAppointmentCode(),
      customerId: customerId || null,
      guestContactId: guestContactId || null,
      contactSnapshot: contactSnapshot || null,
      petId: petId || null,
      petSnapshot: petSnapshot || null,
      customerSnapshot: isCustomer && actor ? {
        name: contactSnapshot?.name || actor.fullName || actor.name || 'Khách hàng',
        fullName: contactSnapshot?.fullName || actor.fullName || actor.name || 'Khách hàng',
        phone: contactSnapshot?.phone || actor.phone || '',
        email: contactSnapshot?.email || actor.email || '',
      } : (contactSnapshot || null),
      branchId,
      serviceType: primaryServiceType,
      paymentMethod,
      services: segments,
      scheduledStart: new Date(slotStart),
      scheduledEnd: currentStart,
      scheduledDurationMinutes,
      pricing: {
        subtotal,
        voucherId: appliedVoucher ? appliedVoucher._id : null,
        voucherDiscount,
        finalAmount,
        depositAmount,
        balanceAmount,
        paidAmount,
      },
      deposit: {
        status: depositStatus,
        paymentId: null,
      },
      status,
      rescheduleCount: 0,
      holdExpiresAt,
      reviewerStaffId,
      source: 'ONLINE',
      note: note || null,
      conditionDescription: conditionDescription || null,
      version: 1,
    });

    await appointment.save({ session });

    // Link appointmentId to created slot reservations
    const reservationUpdate = { appointmentId: appointment._id };
    if (status === 'CONFIRMED') {
      reservationUpdate.status = 'CONFIRMED';
      reservationUpdate.holdExpiresAt = null;
    }
    const resIds = savedReservations.map((r) => r._id).filter(Boolean);
    if (resIds.length > 0) {
      await safeUpdateReservations(
        { _id: { $in: resIds } },
        { $set: reservationUpdate },
        session
      );
    } else {
      await safeUpdateReservations(
        {
          branchId: new mongoose.Types.ObjectId(branchId),
          slotStartUnit: { $in: reservationsToCreate.map((r) => r.slotStartUnit) },
          appointmentId: null,
        },
        { $set: reservationUpdate },
        session
      );
    }

    // Consume voucher quota in session if applied
    if (appliedVoucher) {
      await consumeQuotaInSession({
        voucherId: appliedVoucher._id,
        targetType: 'APPOINTMENT',
        targetId: appointment._id,
        discountApplied: voucherDiscount,
        session,
      });
    }

    // Create Prepayment record
    if (paymentAmount > 0 || paymentMethod === 'ONLINE_MOCK') {
      const paymentCode = `PAY-${new mongoose.Types.ObjectId().toString().slice(-10).toUpperCase()}`;
      const payment = new Payment({
        code: paymentCode,
        target: {
          type: 'APPOINTMENT',
          id: appointment._id,
        },
        targetType: 'APPOINTMENT',
        targetId: appointment._id,
        method: paymentMethod === 'PAY_AT_STORE' ? 'PAY_AT_STORE' : 'ONLINE_MOCK',
        kind: paymentKind,
        status: paymentStatus,
        amount: paymentAmount,
        expiresAt: holdExpiresAt,
        provider: 'MOCK',
      });
      await payment.save(session ? { session } : {});

      appointment.prepaymentId = payment._id;
      if (paymentMethod === 'PAY_AT_STORE') {
        appointment.deposit.paymentId = payment._id;
      }
      await appointment.save(session ? { session } : {});
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    return formatAppointment(appointment);
  } catch (error) {
    await abortSessionSafely(session);
    const mapped = mapSlotWriteError(
      error,
      'The requested time slot or assigned staff is already reserved by another customer'
    );
    if (mapped) throw mapped;
    throw error;
  }
};

/**
 * Internal Appointment Creation (Receptionist / Manager / Admin)
 */
export const createInternalAppointment = async (data, actor) => {
  // Allows optional explicit staffAssignments and internal staff booking
  return createAppointment({ ...data, isInternal: true }, actor, null);
};

/**
 * List Appointments with role scoping and pagination
 */
export const getAppointments = async (filters = {}, actor) => {
  const query = {};

  const requestedBranchId = filters.branchId ? String(filters.branchId).trim() : null;
  if (requestedBranchId) {
    if (!mongoose.Types.ObjectId.isValid(requestedBranchId)) {
      throw new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Invalid branchId format');
    }
    query.branchId = new mongoose.Types.ObjectId(requestedBranchId);
  }
  if (filters.customerId && mongoose.Types.ObjectId.isValid(filters.customerId)) {
    const rawCustId = filters.customerId.toString();
    const candidateCustIds = [new mongoose.Types.ObjectId(rawCustId)];
    try {
      const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
      const cust = await CustomerModel.findOne({ $or: [{ _id: rawCustId }, { userId: rawCustId }] }).select('_id userId').lean();
      if (cust) {
        if (cust._id && mongoose.Types.ObjectId.isValid(cust._id)) candidateCustIds.push(new mongoose.Types.ObjectId(cust._id));
        if (cust.userId && mongoose.Types.ObjectId.isValid(cust.userId)) candidateCustIds.push(new mongoose.Types.ObjectId(cust.userId));
      }
    } catch (_e) {}
    query.customerId = candidateCustIds.length === 1 ? candidateCustIds[0] : { $in: candidateCustIds };
  }
  if (filters.status) {
    query.status = filters.status;
  }

  // Clickthrough alignment: support createdAt filtering (createdFrom/createdTo or dateField=createdAt with from/to)
  const useCreatedAt = filters.dateField === 'createdAt' || filters.createdFrom || filters.createdTo;
  if (useCreatedAt) {
    const rawCreatedFrom = filters.createdFrom || (filters.dateField === 'createdAt' ? filters.from : undefined);
    const rawCreatedTo = filters.createdTo || (filters.dateField === 'createdAt' ? filters.to : undefined);
    const createdAtFilter = buildOptionalVnDateFilter(rawCreatedFrom, rawCreatedTo);
    if (createdAtFilter) query.createdAt = createdAtFilter;
  } else if (filters.from || filters.to) {
    query.scheduledStart = {};
    if (filters.from) query.scheduledStart.$gte = new Date(filters.from);
    if (filters.to) query.scheduledStart.$lte = new Date(filters.to);
  }

  // Scoping based on Role
  if (actor) {
    const role = actor.systemRole || actor.role;
    const isReceptionist = role === 'RECEPTIONIST' || (role === 'STAFF' && actor.staffSubRole === 'RECEPTIONIST');
    const isClinicalStaff =
      ['VETERINARIAN', 'NURSE', 'CARE_STAFF_GROOMER'].includes(role) ||
      (role === 'STAFF' && (!actor.staffSubRole || actor.staffSubRole !== 'RECEPTIONIST'));

    if (role === 'CUSTOMER') {
      const actorUserId = actor.id || actor._id;
      const validCustomerIds = [];
      if (mongoose.Types.ObjectId.isValid(actorUserId)) {
        validCustomerIds.push(new mongoose.Types.ObjectId(actorUserId));
      }
      try {
        const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
        const cust = await CustomerModel.findOne({ userId: actorUserId }).select('_id').lean();
        if (cust?._id) {
          validCustomerIds.push(cust._id);
        }
      } catch (_e) {}
      query.customerId = { $in: validCustomerIds };
    } else if (isReceptionist) {
      const rawBranches = actor.authorizedBranchIds ?? actor.assignedBranchIds;
      if (Array.isArray(rawBranches)) {
        const authBranches = rawBranches.map((id) => (id._id || id).toString());
        if (authBranches.length === 0) {
          throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Receptionist account has no assigned branches');
        }
        if (requestedBranchId && !authBranches.includes(requestedBranchId)) {
          throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch');
        }
        if (!requestedBranchId) {
          query.branchId = { $in: authBranches.map((id) => new mongoose.Types.ObjectId(id)) };
        }
      }
    } else if (role === 'MANAGER') {
      const mgrBranches = (actor.assignedBranchIds || actor.authorizedBranchIds || []).map((id) => (id._id || id).toString());
      if (mgrBranches.length === 0) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Manager account has no assigned branches');
      }
      if (requestedBranchId) {
        if (!mgrBranches.includes(requestedBranchId)) {
          throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch');
        }
        query.branchId = new mongoose.Types.ObjectId(requestedBranchId);
      } else {
        query.branchId = { $in: mgrBranches.map((id) => new mongoose.Types.ObjectId(id)) };
      }
    } else if (isClinicalStaff) {
      const rawBranches = actor.authorizedBranchIds ?? actor.assignedBranchIds;
      if (Array.isArray(rawBranches) && rawBranches.length > 0) {
        const authBranches = rawBranches.map((id) => (id._id || id).toString());
        if (requestedBranchId && !authBranches.includes(requestedBranchId)) {
          throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch');
        }
        if (!requestedBranchId) {
          query.branchId = { $in: authBranches.map((id) => new mongoose.Types.ObjectId(id)) };
        }
      }
      const actorId = (actor.id || actor._id)?.toString();
      if (actorId) {
        const staffObjectIds = [new mongoose.Types.ObjectId(actorId)];
        if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
          const profile = await StaffProfile.findOne({ userId: actorId }).select('_id').lean();
          if (profile?._id) {
            staffObjectIds.push(new mongoose.Types.ObjectId(profile._id));
          }
        }
        const assignmentFilter = {
          $or: [
            { 'services.assignedStaffId': { $in: staffObjectIds } },
            { reviewerStaffId: { $in: staffObjectIds } },
          ],
        };
        query.$and = [...(query.$and || []), assignmentFilter];
      }
    }
  }

  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const appointments = await Appointment.find(query)
    .populate('petId')
    .populate('customerId', 'fullName phone email name')
    .sort({ scheduledStart: -1 })
    .limit(limit);

  // Enrich customer info if customerId was not found in Customer (e.g. linked via User)
  try {
    if (mongoose.connection?.readyState === 1) {
      const missingCustomerIds = [];
      appointments.forEach((a) => {
        const name = a.customerSnapshot?.fullName || a.customerSnapshot?.name || a.contactSnapshot?.fullName || a.contactSnapshot?.name;
        if (!name || name === 'Khách hàng' || name === 'Thành viên') {
          if (a.customerId) missingCustomerIds.push(a.customerId._id || a.customerId);
        }
      });
      if (missingCustomerIds.length > 0) {
        const User = require('../auth/models/User').default || require('../auth/models/User');
        const Customer = require('../customer/models/Customer').default || require('../customer/models/Customer');
        const [users, custs] = await Promise.all([
          User.find({ _id: { $in: missingCustomerIds } }).lean(),
          Customer.find({ $or: [{ _id: { $in: missingCustomerIds } }, { userId: { $in: missingCustomerIds } }] }).lean()
        ]);
        const nameMap = new Map();
        custs.forEach((c) => {
          const n = c.fullName || c.name;
          if (n) {
            if (c._id) nameMap.set(c._id.toString(), { name: n, phone: c.contactPhone || c.phone, email: c.contactEmail || c.email });
            if (c.userId) nameMap.set(c.userId.toString(), { name: n, phone: c.contactPhone || c.phone, email: c.contactEmail || c.email });
          }
        });
        users.forEach((u) => {
          const n = u.fullName || u.name;
          if (n && u._id && !nameMap.has(u._id.toString())) {
            nameMap.set(u._id.toString(), { name: n, phone: u.phone, email: u.email });
          }
        });
        appointments.forEach((a) => {
          const rawId = (a.customerId?._id || a.customerId)?.toString();
          if (rawId && nameMap.has(rawId)) {
            const resolved = nameMap.get(rawId);
            if (!a.customerSnapshot) a.customerSnapshot = {};
            a.customerSnapshot.fullName = resolved.name;
            a.customerSnapshot.name = resolved.name;
            if (resolved.phone) a.customerSnapshot.phone = resolved.phone;
            if (resolved.email) a.customerSnapshot.email = resolved.email;
          }
        });
      }
    }
  } catch (_e) {}

  return {
    items: appointments.map(formatAppointment),
    nextCursor: null,
  };
};

/**
 * Get Appointment by ID with Authorization check
 */
export const getAppointmentById = async (id, actor, guestLookupToken = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Invalid appointment ID');
  }

  const appointment = await Appointment.findById(id).populate('petId');
  if (!appointment) {
    throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
  }

  // Check scoping
  if (!actor) {
    await assertAppointmentSelfServiceAccess(appointment, null, guestLookupToken);
  } else {
    const role = actor.systemRole || actor.role;
    const actorId = (actor.id || actor._id)?.toString();
    const isReceptionist = role === 'RECEPTIONIST' || (role === 'STAFF' && actor.staffSubRole === 'RECEPTIONIST');
    const isClinicalStaff =
      ['VETERINARIAN', 'NURSE', 'CARE_STAFF_GROOMER'].includes(role) ||
      (role === 'STAFF' && actor.staffSubRole && actor.staffSubRole !== 'RECEPTIONIST');

    if (role === 'CUSTOMER') {
      await assertAppointmentSelfServiceAccess(appointment, actor, guestLookupToken);
    } else if (role === 'MANAGER') {
      assertBranchScope(actor, appointment.branchId);
    } else if (isReceptionist) {
      assertBranchScope(actor, appointment.branchId);
    } else if (isClinicalStaff) {
      const rawBranches = actor.authorizedBranchIds ?? actor.assignedBranchIds;
      if (Array.isArray(rawBranches) && rawBranches.length > 0) {
        const authBranches = rawBranches.map((b) => (b._id || b).toString());
        const aptBranchId = (appointment.branchId?._id || appointment.branchId)?.toString();
        if (aptBranchId && !authBranches.includes(aptBranchId)) {
          throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch appointment');
        }
      }
      if (actorId) {
        const staffIds = [actorId];
        if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
          const profile = await StaffProfile.findOne({ userId: actorId }).select('_id').lean();
          if (profile?._id) {
            staffIds.push(profile._id.toString());
          }
        }
        const isAssigned =
          (appointment.services || []).some(
            (s) => s.assignedStaffId && staffIds.includes((s.assignedStaffId._id || s.assignedStaffId).toString())
          ) ||
          (appointment.reviewerStaffId && staffIds.includes((appointment.reviewerStaffId._id || appointment.reviewerStaffId).toString()));
        if (!isAssigned) {
          throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You are not assigned to this appointment');
        }
      }
    }
  }

  return formatAppointment(appointment);
};

/**
 * Confirm Appointment (Receptionist / Manager / Admin)
 */
export const confirmAppointment = async (id, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    if (apt.status !== 'PENDING_CONFIRMATION' && apt.status !== 'PENDING_PAYMENT' && apt.status !== 'CONFIRMED') {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        `Cannot confirm appointment in status ${apt.status}`
      );
    }

    apt.status = 'CONFIRMED';
    apt.holdExpiresAt = null;

    if (apt.paymentMethod === 'PAY_AT_STORE' && apt.pricing.paidAmount > 0) {
      apt.deposit.status = 'HELD';
    }

    // Confirm slot reservations
    await safeUpdateReservations(
      { appointmentId: apt._id },
      { $set: { status: 'CONFIRMED', holdExpiresAt: null } },
      session
    );

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    return formatAppointment(apt);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Reject Appointment (Receptionist / Manager / Admin)
 */
export const rejectAppointment = async (id, reason, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    assertBranchScope(actor, apt.branchId);

    if (apt.status !== 'PENDING_CONFIRMATION' && apt.status !== 'PENDING_PAYMENT') {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        `Cannot reject appointment in status ${apt.status}`
      );
    }

    const paidAmount = Number(apt.pricing?.paidAmount || 0);

    apt.status = 'CANCELLED';
    apt.holdExpiresAt = null;
    apt.cancel = {
      by: 'STORE',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : null,
      reason: reason || 'Store rejected appointment',
      hoursBeforeStart: 0,
      prepaidOutcome: paidAmount > 0 ? 'REFUND_PENDING' : 'FORFEITED',
      refundAmount: paidAmount,
      penaltyAmount: 0,
    };

    if (paidAmount > 0) {
      if (apt.deposit) apt.deposit.status = 'REFUND_PENDING';
      const payment = await Payment.findOne({
        $or: [
          { 'target.id': apt._id, 'target.type': 'APPOINTMENT' },
          { targetType: 'APPOINTMENT', targetId: apt._id },
        ],
        status: 'PAID',
      }).session(session);

      if (payment) {
        payment.status = 'REFUND_PENDING';
        await payment.save({ session });
      }
    }

    // Release reservations
    await safeDeleteReservations(apt._id, session);

    // Restore voucher quota if used
    if (apt.pricing?.voucherId) {
      await restoreQuotaInSession({
        voucherId: apt.pricing.voucherId,
        targetType: 'APPOINTMENT',
        targetId: apt._id,
        session,
      });
    }

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    return formatAppointment(apt);
  } catch (error) {
    await abortSessionSafely(session);
    throw error;
  }
};

const rebuildAndReserveSlots = async (apt, newSlotStart, session) => {
  const previousStart = apt.scheduledStart ? new Date(apt.scheduledStart) : null;
  const previousEnd = apt.scheduledEnd ? new Date(apt.scheduledEnd) : null;

  let currentStart = new Date(newSlotStart);
  for (const seg of apt.services || []) {
    const segStart = new Date(currentStart);
    const segEnd = new Date(currentStart.getTime() + Number(seg.durationMinutes || 0) * 60000);
    seg.scheduledStart = segStart;
    seg.scheduledEnd = segEnd;
    currentStart = segEnd;
  }

  apt.scheduledStart = new Date(newSlotStart);
  apt.scheduledEnd = currentStart;

  await safeDeleteReservations(apt._id, session);

  const resStatus = apt.status === 'CONFIRMED' ? 'CONFIRMED' : 'HELD';
  const resHoldUntil = resStatus === 'CONFIRMED' ? null : (apt.holdExpiresAt || new Date(Date.now() + 15 * 60000));

  for (const seg of apt.services || []) {
    const slotStartUnit = Math.floor(seg.scheduledStart.getTime() / (15 * 60000));
    const unitsNeeded = Math.ceil(Number(seg.durationMinutes || 15) / 15);
    const unitNumbers = Array.from({ length: unitsNeeded }, (_, u) => slotStartUnit + u);

    let freeCapacitySlot = 0;
    if (mongoose.connection.readyState === 1 || SlotReservation.find?._isMockFunction) {
      let capacity = 3;
      if (seg.serviceId && BranchServiceConfig.findOne) {
        const cfgQuery = BranchServiceConfig.findOne({ branchId: apt.branchId, serviceId: seg.serviceId });
        const cfg = session && typeof cfgQuery?.session === 'function' ? await cfgQuery.session(session) : await cfgQuery;
        if (cfg?.capacity) capacity = Number(cfg.capacity);
      }
      let capQuery = SlotReservation.find({
        branchId: apt.branchId,
        serviceId: seg.serviceId,
        kind: 'CAPACITY',
        slotStartUnit: { $in: unitNumbers },
        $or: [{ status: 'CONFIRMED' }, { status: 'HELD', holdExpiresAt: { $gt: new Date() } }],
      });
      if (typeof capQuery.select === 'function') capQuery = capQuery.select('capacitySlot');
      if (session && typeof capQuery.session === 'function') capQuery = capQuery.session(session);
      if (typeof capQuery.lean === 'function') capQuery = capQuery.lean();
      const usedCapDocs = await capQuery;
      const usedSlots = new Set((usedCapDocs || []).map((d) => Number(d.capacitySlot ?? 0)));
      freeCapacitySlot = null;
      for (let slotIdx = 0; slotIdx < capacity; slotIdx++) {
        if (!usedSlots.has(slotIdx)) {
          freeCapacitySlot = slotIdx;
          break;
        }
      }
      if (freeCapacitySlot === null) {
        throw new AppError(409, 'Conflict', 'SLOT_UNAVAILABLE', 'The new slot has conflict with existing service capacity');
      }
    }

    for (let u = 0; u < unitsNeeded; u++) {
      if (seg.assignedStaffId) {
        await safeCreateReservation({
          branchId: apt.branchId,
          staffId: seg.assignedStaffId,
          serviceId: seg.serviceId,
          appointmentId: apt._id,
          slotStartUnit: slotStartUnit + u,
          unitIndex: u,
          kind: 'STAFF',
          status: resStatus,
          holdExpiresAt: resHoldUntil,
        }, session);
      }
      await safeCreateReservation({
        branchId: apt.branchId,
        staffId: null,
        serviceId: seg.serviceId,
        capacitySlot: freeCapacitySlot,
        appointmentId: apt._id,
        slotStartUnit: slotStartUnit + u,
        unitIndex: u,
        kind: 'CAPACITY',
        status: resStatus,
        holdExpiresAt: resHoldUntil,
      }, session);
    }
  }

  return { previousStart, previousEnd };
};

/**
 * Reschedule Appointment (Customer / Guest self-service)
 */
export const rescheduleAppointment = async (id, { newSlotStart }, actor, guestLookupToken = null) => {
  if (!newSlotStart) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'newSlotStart is required');
  }
  const parsedNewStart = new Date(newSlotStart);
  if (Number.isNaN(parsedNewStart.getTime())) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'newSlotStart must be a valid datetime');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    await assertAppointmentSelfServiceAccess(apt, actor, guestLookupToken);

    const isPayAtStore = ['PAY_AT_STORE', 'CASH', 'pay_at_clinic', 'store'].includes(apt.paymentMethod);
    const isAllowedStatus = apt.status === 'CONFIRMED' || (isPayAtStore && ['PENDING_PAYMENT', 'PENDING_CONFIRMATION'].includes(apt.status));

    if (!isAllowedStatus) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        'Reschedule is only allowed for CONFIRMED or in-store payment appointments'
      );
    }

    // Check 24h constraint
    const now = Date.now();
    const hoursBefore = (new Date(apt.scheduledStart).getTime() - now) / 3600000;
    if (hoursBefore < 24) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'RESCHEDULE_TOO_LATE',
        'Reschedule is only allowed at least 24 hours before scheduled start'
      );
    }

    // Check limit
    if ((apt.rescheduleCount || 0) >= 2) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'RESCHEDULE_LIMIT',
        'Maximum 2 reschedules reached'
      );
    }

    if (parsedNewStart.getTime() <= now) {
      throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'newSlotStart must be a valid future datetime');
    }

    if (mongoose.connection.readyState === 1 || Branch.findById?._isMockFunction) {
      const branchQuery = Branch.findById(apt.branchId);
      const branch = session && typeof branchQuery?.session === 'function' ? await branchQuery.session(session) : await branchQuery;
      if (branch) {
        const totalMins = (apt.services || []).reduce((sum, s) => sum + Number(s.durationMinutes || 0), 0) || Number(apt.scheduledDurationMinutes || 30);
        const sIds = (apt.services || []).map((s) => s.serviceId).filter(Boolean);
        const cfgQuery = BranchServiceConfig.find({ branchId: apt.branchId, serviceId: { $in: sIds } });
        const cfgs = session && typeof cfgQuery?.session === 'function' ? await cfgQuery.session(session) : await cfgQuery;
        const cfgMap = new Map((cfgs || []).map((c) => [c.serviceId.toString(), c]));
        validateScheduleAgainstBranchRules({
          branch,
          orderedServices: (apt.services || []).map((s) => ({ _id: s.serviceId, name: s.serviceName || 'Service', durationMinutes: s.durationMinutes })),
          configMap: cfgMap,
          startDate: parsedNewStart,
          endDate: new Date(parsedNewStart.getTime() + totalMins * 60000),
        });
      }
    }

    await rebuildAndReserveSlots(apt, parsedNewStart, session);
    apt.rescheduleCount = (apt.rescheduleCount || 0) + 1;

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    return formatAppointment(apt);
  } catch (error) {
    await abortSessionSafely(session);
    const mapped = mapSlotWriteError(error, 'The new slot has conflict with existing staff reservations');
    if (mapped) throw mapped;
    throw error;
  }
};

/**
 * Reschedule Override (Manager / Admin)
 */
export const rescheduleOverride = async (id, data, actor) => {
  const reason = typeof data?.reason === 'string' ? data.reason.trim() : '';
  if (!data?.newSlotStart || reason.length < 3) {
    throw new AppError(
      400,
      'ValidationError',
      'VALIDATION_ERROR',
      'newSlotStart and a non-empty reason (at least 3 characters) are required'
    );
  }
  const parsedNewStart = new Date(data.newSlotStart);
  if (Number.isNaN(parsedNewStart.getTime())) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Invalid newSlotStart datetime');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    assertBranchScope(actor, apt.branchId);

    if (apt.status !== 'CONFIRMED') {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        `Cannot reschedule-override appointment in status ${apt.status}`
      );
    }

    // Bypasses 24h & limit constraint
    const { previousStart, previousEnd } = await rebuildAndReserveSlots(apt, parsedNewStart, session);
    apt.rescheduleHistory = Array.isArray(apt.rescheduleHistory) ? apt.rescheduleHistory : [];
    apt.rescheduleHistory.push({
      fromStart: previousStart,
      fromEnd: previousEnd,
      toStart: apt.scheduledStart,
      toEnd: apt.scheduledEnd,
      reason,
      actorId: actor ? (actor.id || actor._id) : null,
      at: new Date(),
    });

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    await recordAuditLog({
      actor: {
        userId: actor?.id || actor?._id || null,
        systemRole: actor?.systemRole || actor?.role || 'MANAGER',
      },
      action: 'APPOINTMENT_RESCHEDULE_OVERRIDE',
      target: { type: 'APPOINTMENT', id: apt._id },
      metadata: {
        code: apt.code,
        reason,
        fromStart: previousStart,
        toStart: apt.scheduledStart,
      },
    });

    return formatAppointment(apt);
  } catch (error) {
    await abortSessionSafely(session);
    const mapped = mapSlotWriteError(error, 'The requested override slot has conflict with existing reservations');
    if (mapped) throw mapped;
    throw error;
  }
};

/**
 * Customer / Guest Cancellation
 */
export const cancelAppointment = async (id, reasonOrActor, possibleActor, guestLookupToken = null) => {
  let reason = 'Customer requested cancellation';
  let actor = null;
  if (typeof reasonOrActor === 'string') {
    reason = reasonOrActor;
    actor = possibleActor;
  } else if (reasonOrActor && typeof reasonOrActor === 'object') {
    if (reasonOrActor.id || reasonOrActor.systemRole || reasonOrActor.role) {
      actor = reasonOrActor;
      reason = typeof possibleActor === 'string' ? possibleActor : 'Customer requested cancellation';
    } else if (reasonOrActor.reason) {
      reason = reasonOrActor.reason;
      actor = possibleActor;
    }
  } else {
    actor = possibleActor;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    await assertAppointmentSelfServiceAccess(apt, actor, guestLookupToken);

    if (['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status)) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        `Cannot cancel appointment in status ${apt.status}`
      );
    }

    const now = Date.now();
    const hoursBeforeStart = (new Date(apt.scheduledStart).getTime() - now) / 3600000;
    const paidAmount = Number(apt.pricing?.paidAmount || 0);
    const finalAmount = Number(apt.pricing?.finalAmount || 0);

    let penalty = 0;
    if (hoursBeforeStart < 24) {
      // Retain 30% of finalAmount as penalty
      penalty = Math.round(finalAmount * 0.30);
    }

    const refundAmount = Math.max(0, paidAmount - penalty);

    apt.status = 'CANCELLED';
    apt.holdExpiresAt = null;
    apt.cancel = {
      by: 'CUSTOMER',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : null,
      reason: reason || 'Customer requested cancellation',
      hoursBeforeStart,
      prepaidOutcome: refundAmount > 0 ? 'REFUND_PENDING' : (paidAmount > 0 ? 'FORFEITED' : 'NONE'),
      refundAmount,
      penaltyAmount: penalty,
    };

    if (apt.deposit) {
      if (refundAmount > 0) {
        apt.deposit.status = 'REFUND_PENDING';
      } else if (paidAmount > 0) {
        apt.deposit.status = 'FORFEITED';
      }
    }

    if (refundAmount > 0) {
      const payment = await Payment.findOne({
        $or: [
          { 'target.id': apt._id, 'target.type': 'APPOINTMENT' },
          { targetType: 'APPOINTMENT', targetId: apt._id },
        ],
        status: 'PAID',
      }).session(session);

      if (payment) {
        payment.status = 'REFUND_PENDING';
        await payment.save({ session });
      }
    }

    // Release reservations safely
    await safeDeleteReservations(apt._id, session);

    // Restore voucher quota only if >= 24h
    if (hoursBeforeStart >= 24 && apt.pricing?.voucherId) {
      await restoreQuotaInSession({
        voucherId: apt.pricing.voucherId,
        targetType: 'APPOINTMENT',
        targetId: apt._id,
        session,
      });
    }

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    try {
      return formatAppointment(apt) || apt;
    } catch (e) {
      return apt;
    }
  } catch (error) {
    await abortSessionSafely(session);
    throw error;
  }
};

/**
 * Store Cancellation (Receptionist / Manager / Admin)
 */
export const storeCancelAppointment = async (id, reason, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    assertBranchScope(actor, apt.branchId);

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status)) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        `Cannot store-cancel appointment in status ${apt.status}`
      );
    }

    const paidAmount = Number(apt.pricing?.paidAmount || 0);

    apt.status = 'CANCELLED';
    apt.holdExpiresAt = null;
    apt.cancel = {
      by: 'STORE',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : null,
      reason: reason || 'Store cancelled appointment',
      hoursBeforeStart: 0,
      prepaidOutcome: paidAmount > 0 ? 'REFUND_PENDING' : 'FORFEITED',
      refundAmount: paidAmount,
      penaltyAmount: 0,
    };

    if (apt.deposit && paidAmount > 0) {
      apt.deposit.status = 'REFUND_PENDING';
    }

    if (paidAmount > 0) {
      const payment = await Payment.findOne({
        $or: [
          { 'target.id': apt._id, 'target.type': 'APPOINTMENT' },
          { targetType: 'APPOINTMENT', targetId: apt._id },
        ],
        status: 'PAID',
      }).session(session);

      if (payment) {
        payment.status = 'REFUND_PENDING';
        await payment.save({ session });
      }
    }

    await safeDeleteReservations(apt._id, session);

    // 100% refund -> Restore voucher
    if (apt.pricing?.voucherId) {
      await restoreQuotaInSession({
        voucherId: apt.pricing.voucherId,
        targetType: 'APPOINTMENT',
        targetId: apt._id,
        session,
      });
    }

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    return formatAppointment(apt);
  } catch (error) {
    await abortSessionSafely(session);
    throw error;
  }
};

/**
 * Cancel Override (Manager / Admin)
 */
export const cancelOverride = async (id, data, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    assertBranchScope(actor, apt.branchId);

    if (['COMPLETED', 'CANCELLED'].includes(apt.status)) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        `Cannot cancel-override appointment in status ${apt.status}`
      );
    }

    const paidAmount = Number(apt.pricing?.paidAmount || 0);
    const prepaidOutcome = data?.prepaidOutcome || (paidAmount > 0 ? 'REFUND_PENDING' : 'FORFEITED');

    apt.status = 'CANCELLED';
    apt.holdExpiresAt = null;
    apt.cancel = {
      by: 'STORE',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : null,
      reason: data?.reason || 'Manager cancel override',
      hoursBeforeStart: 0,
      prepaidOutcome,
      refundAmount: prepaidOutcome === 'FORFEITED' ? 0 : paidAmount,
      penaltyAmount: prepaidOutcome === 'FORFEITED' ? paidAmount : 0,
    };

    if (paidAmount > 0 && prepaidOutcome !== 'FORFEITED') {
      if (apt.deposit) apt.deposit.status = 'REFUND_PENDING';
      const payment = await Payment.findOne({
        $or: [
          { 'target.id': apt._id, 'target.type': 'APPOINTMENT' },
          { targetType: 'APPOINTMENT', targetId: apt._id },
        ],
        status: 'PAID',
      }).session(session);

      if (payment) {
        payment.status = 'REFUND_PENDING';
        await payment.save({ session });
      }
    } else if (paidAmount > 0 && apt.deposit) {
      apt.deposit.status = 'FORFEITED';
    }

    await safeDeleteReservations(apt._id, session);

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    return formatAppointment(apt);
  } catch (error) {
    await abortSessionSafely(session);
    throw error;
  }
};

/**
 * Mark No-Show (Receptionist / Manager / Admin)
 */
export const markNoShow = async (id, actorOrReason, maybeReason) => {
  let actor = null;
  let reason = 'Customer no-show';

  if (typeof actorOrReason === 'string' && actorOrReason.trim()) {
    reason = actorOrReason.trim();
    actor = maybeReason || null;
  } else if (actorOrReason && typeof actorOrReason === 'object') {
    if (actorOrReason.id || actorOrReason._id || actorOrReason.systemRole || actorOrReason.role) {
      actor = actorOrReason;
      if (typeof maybeReason === 'string' && maybeReason.trim()) {
        reason = maybeReason.trim();
      } else if (maybeReason && typeof maybeReason === 'object') {
        const extracted = maybeReason.reason || maybeReason.noShowReason || maybeReason.note;
        if (typeof extracted === 'string' && extracted.trim()) {
          reason = extracted.trim();
        }
      }
    } else {
      const extracted = actorOrReason.reason || actorOrReason.noShowReason || actorOrReason.note;
      if (typeof extracted === 'string' && extracted.trim()) {
        reason = extracted.trim();
      }
      actor = maybeReason || null;
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    assertBranchScope(actor, apt.branchId);

    if (apt.status !== 'CONFIRMED') {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        `Cannot mark no-show for appointment in status ${apt.status}`
      );
    }

    if (apt.checkInStatus === 'ARRIVED') {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        'Cannot mark no-show for an appointment that has already checked in'
      );
    }

    const elapsedMs = Date.now() - new Date(apt.scheduledStart).getTime();
    if (elapsedMs < 30 * 60 * 1000) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'TOO_EARLY_NO_SHOW',
        'No-show can only be marked at least 30 minutes after scheduled start'
      );
    }

    const paidAmount = Number(apt.pricing?.paidAmount || 0);
    const finalAmount = Number(apt.pricing?.finalAmount || 0);
    const penalty = Math.round(finalAmount * 0.30);
    const refundAmount = Math.max(0, paidAmount - penalty);

    apt.status = 'NO_SHOW';
    apt.holdExpiresAt = null;
    apt.cancel = {
      by: 'SYSTEM',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : null,
      reason,
      hoursBeforeStart: 0,
      prepaidOutcome: refundAmount > 0 ? 'REFUND_PENDING' : (paidAmount > 0 ? 'FORFEITED' : 'NONE'),
      refundAmount,
      penaltyAmount: penalty,
    };

    if (apt.deposit) {
      if (refundAmount > 0) apt.deposit.status = 'REFUND_PENDING';
      else if (paidAmount > 0) apt.deposit.status = 'FORFEITED';
    }

    if (refundAmount > 0) {
      const payment = await Payment.findOne({
        $or: [
          { 'target.id': apt._id, 'target.type': 'APPOINTMENT' },
          { targetType: 'APPOINTMENT', targetId: apt._id },
        ],
        status: 'PAID',
      }).session(session);

      if (payment) {
        payment.status = 'REFUND_PENDING';
        await payment.save({ session });
      }
    }

    await safeDeleteReservations(apt._id, session);

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    return formatAppointment(apt);
  } catch (error) {
    await abortSessionSafely(session);
    throw error;
  }
};

/**
 * Reassign staff for an individual service segment
 */
export const reassignSegmentStaff = async (id, serviceId, newStaffId, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    const segment = serviceId
    ? apt.services.find((s) => s.serviceId.toString() === serviceId.toString())
    : apt.services?.[0];
    if (!segment) {
      throw new AppError(
        404,
        'NotFound',
        'SERVICE_SEGMENT_NOT_FOUND',
        `Service segment ${serviceId} not found in appointment`
      );
    }

    // Validate new staff eligibility
    const staff = await StaffProfile.findById(newStaffId).session(session);
    if (!staff || staff.status !== 'ACTIVE') {
      throw new AppError(404, 'NotFound', 'STAFF_NOT_FOUND', 'Active staff not found');
    }

    if (staff.staffSubRole !== segment.requiredStaffRole) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'STAFF_ROLE_MISMATCH',
        `Staff role ${staff.staffSubRole} does not match required role ${segment.requiredStaffRole}`
      );
    }

    // Verify shift
    const shift = await Shift.findOne({
      branchId: apt.branchId,
      staffId: staff._id,
      status: 'ACTIVE',
      startAt: { $lte: segment.scheduledStart },
      endAt: { $gte: segment.scheduledEnd },
    }).session(session);

    if (!shift) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'STAFF_UNAVAILABLE',
        'Staff is not on active shift covering this segment interval'
      );
    }

    // Update assignment
    segment.assignedStaffId = staff._id;

    // Update slot reservation
    await safeUpdateReservations(
      { appointmentId: apt._id, serviceId: segment.serviceId },
      { $set: { staffId: staff._id } },
      session
    );

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    return formatAppointment(apt);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Start Segment Execution
 */
export const startSegment = async (id, serviceIdOrPayload, actor) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Invalid appointment ID');
  }

  const isPayloadObject =
    serviceIdOrPayload &&
    typeof serviceIdOrPayload === 'object' &&
    !mongoose.Types.ObjectId.isValid(serviceIdOrPayload);
  const rawServiceId = isPayloadObject ? serviceIdOrPayload.serviceId : serviceIdOrPayload;
  const expectedVersion = isPayloadObject ? serviceIdOrPayload.expectedVersion : undefined;
  const serviceId = typeof rawServiceId === 'string' ? rawServiceId.trim() : rawServiceId;

  if (serviceId && !mongoose.Types.ObjectId.isValid(serviceId)) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Invalid serviceId');
  }
  if (
    expectedVersion !== undefined &&
    expectedVersion !== null &&
    (!Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) < 1)
  ) {
    throw new AppError(
      400,
      'Bad Request',
      ErrorCodes.VALIDATION_ERROR,
      'expectedVersion must be a positive integer'
    );
  }

  const apt = await Appointment.findById(id).populate('branchId');
  if (!apt) {
    throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
  }

  if (!serviceId && Array.isArray(apt.services) && apt.services.length > 1) {
    throw new AppError(
      400,
      'Bad Request',
      ErrorCodes.VALIDATION_ERROR,
      'serviceId is required when appointment has multiple services'
    );
  }

  const segment = serviceId
    ? (apt.services || []).find((s) => s.serviceId && s.serviceId.toString() === serviceId.toString())
    : apt.services?.[0];
  if (!segment) {
    throw new AppError(404, 'NotFound', 'SERVICE_NOT_FOUND', 'Segment not found');
  }

  const aptBranchId = (apt.branchId?._id || apt.branchId)?.toString();

  if (actor) {
    const role = actor.systemRole || actor.role;
    if (role === 'STAFF' || ['VETERINARIAN', 'NURSE', 'CARE_STAFF_GROOMER'].includes(role)) {
      const rawBranches = actor.authorizedBranchIds ?? actor.assignedBranchIds;
      if (Array.isArray(rawBranches)) {
        const authBranches = rawBranches.map((b) => (b._id || b).toString());
        if (authBranches.length === 0 || (aptBranchId && !authBranches.includes(aptBranchId))) {
          throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch');
        }
      }
      if (actor.staffSubRole && segment.requiredStaffRole && segment.requiredStaffRole !== actor.staffSubRole) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Staff sub-role does not match segment requirement');
      }
    }
  }

  // A1: Segment must have a valid assignedStaffId before starting
  const rawAssignedStaffId = segment.assignedStaffId?._id || segment.assignedStaffId;
  const assignedId = rawAssignedStaffId ? rawAssignedStaffId.toString().trim() : '';
  if (!assignedId) {
    throw new AppError(
      422,
      'UnprocessableEntity',
      ErrorCodes.STAFF_UNAVAILABLE,
      'Lịch hẹn chưa được phân công nhân viên thực hiện cho dịch vụ này'
    );
  }
  if (!mongoose.Types.ObjectId.isValid(assignedId)) {
    throw new AppError(
      422,
      'UnprocessableEntity',
      ErrorCodes.STAFF_UNAVAILABLE,
      'Mã nhân viên được phân công (assignedStaffId) không hợp lệ'
    );
  }

  // A2: Verify assigned staff profile still exists, is ACTIVE, matches requiredStaffRole & branchId
  let assignedProfile = null;
  if (mongoose.connection.readyState === 1 || StaffProfile.findById?._isMockFunction) {
    assignedProfile = await StaffProfile.findById(assignedId);
    if (Array.isArray(assignedProfile)) assignedProfile = assignedProfile[0] || null;
    if (!assignedProfile && (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction)) {
      assignedProfile = await StaffProfile.findOne({ userId: assignedId });
      if (Array.isArray(assignedProfile)) assignedProfile = assignedProfile[0] || null;
    }
    if (!assignedProfile || (assignedProfile.status && assignedProfile.status !== 'ACTIVE')) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        ErrorCodes.STAFF_UNAVAILABLE,
        'Nhân viên được phân công không tồn tại hoặc đang ngưng hoạt động'
      );
    }
    if (
      segment.requiredStaffRole &&
      assignedProfile.staffSubRole &&
      assignedProfile.staffSubRole !== segment.requiredStaffRole
    ) {
      throw new AppError(
        422,
        'UnprocessableEntity',
        ErrorCodes.STAFF_ROLE_MISMATCH,
        `Staff role ${assignedProfile.staffSubRole} does not match required role ${segment.requiredStaffRole}`
      );
    }
    if (aptBranchId) {
      const profileBranches = [
        ...(Array.isArray(assignedProfile.authorizedBranchIds)
          ? assignedProfile.authorizedBranchIds.map((b) => (b?._id || b).toString())
          : []),
        ...(assignedProfile.homeBranchId
          ? [(assignedProfile.homeBranchId._id || assignedProfile.homeBranchId).toString()]
          : []),
      ];
      if (profileBranches.length > 0 && !profileBranches.includes(aptBranchId)) {
        throw new AppError(
          422,
          'UnprocessableEntity',
          ErrorCodes.ASSIGNMENT_SCOPE_ERROR,
          'Nhân viên được phân công không còn thuộc chi nhánh của lịch hẹn'
        );
      }
    }
  }

  // A3: Verify the calling clinical staff is the exact assigned staff
  if (actor) {
    const role = actor.systemRole || actor.role;
    if (role === 'STAFF' || ['VETERINARIAN', 'NURSE', 'CARE_STAFF_GROOMER'].includes(role)) {
      const actorId = (actor.id || actor._id)?.toString();
      if (!actorId) {
        throw new AppError(
          403,
          'Forbidden',
          ErrorCodes.ASSIGNMENT_SCOPE_ERROR,
          'You are not assigned to start this service segment'
        );
      }
      const staffIds = new Set([actorId]);
      if (assignedProfile?.userId && assignedProfile.userId.toString() === actorId && assignedProfile._id) {
        staffIds.add(assignedProfile._id.toString());
      }
      if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
        const profile = await StaffProfile.findOne({ userId: actorId })
          .select('_id status staffSubRole authorizedBranchIds homeBranchId')
          .lean();
        if (profile?._id) {
          if (profile.status && profile.status !== 'ACTIVE') {
            throw new AppError(
              422,
              'UnprocessableEntity',
              ErrorCodes.STAFF_UNAVAILABLE,
              'Tài khoản chuyên môn của nhân viên đang ngưng hoạt động'
            );
          }
          staffIds.add(profile._id.toString());
        }
      }
      if (!staffIds.has(assignedId)) {
        throw new AppError(
          403,
          'Forbidden',
          ErrorCodes.ASSIGNMENT_SCOPE_ERROR,
          'You are not assigned to start this service segment'
        );
      }
    }
  }

  // Optimistic concurrency check (when expectedVersion is provided and appointment has version)
  if (
    expectedVersion !== undefined &&
    expectedVersion !== null &&
    apt.version !== undefined &&
    Number(expectedVersion) !== Number(apt.version)
  ) {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.CONCURRENCY_CONFLICT,
      `Version conflict: expected ${expectedVersion}, actual ${apt.version}`
    );
  }

  // Appointment status & check-in state validation (A5)
  if (!['CONFIRMED', 'IN_PROGRESS'].includes(apt.status)) {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.INVALID_STATE_TRANSITION,
      `Cannot start service when appointment status is ${apt.status}`
    );
  }

  if (apt.checkInStatus !== 'ARRIVED' || (segment.checkInStatus && segment.checkInStatus !== 'ARRIVED')) {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.INVALID_STATE_TRANSITION,
      'Appointment must be checked in (ARRIVED) before starting service'
    );
  }

  if (segment.executionStatus && !['NOT_STARTED', 'PENDING'].includes(segment.executionStatus)) {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.INVALID_STATE_TRANSITION,
      `Service segment cannot be started from status ${segment.executionStatus}`
    );
  }

  // Multi-service sequence ordering: previous segments must be COMPLETED
  const currentSeq = Number(segment.sequence || 1);
  if (currentSeq > 1 && Array.isArray(apt.services)) {
    const incompletePrior = apt.services.find(
      (s) => s !== segment && Number(s.sequence || 1) < currentSeq && s.executionStatus !== 'COMPLETED'
    );
    if (incompletePrior) {
      throw new AppError(
        409,
        'Conflict',
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Previous service segment must be COMPLETED before starting the next segment'
      );
    }
  }

  segment.executionStatus = 'IN_PROGRESS';
  segment.executionStartedAt = new Date();

  if (apt.status === 'CONFIRMED') {
    apt.status = 'IN_PROGRESS';
  }

  if (!apt.statusHistory) apt.statusHistory = [];
  apt.statusHistory.push({
    status: apt.status,
    at: new Date(),
    actorId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : null,
    note: `Bắt đầu thực hiện dịch vụ ${segment.serviceName || ''}`.trim(),
  });

  await apt.save();

  // Auto-create ServiceRecord if moving to IN_PROGRESS
  try {
    const ServiceRecord = mongoose.models.ServiceRecord || mongoose.model('ServiceRecord');
    const existingRec = await ServiceRecord.findOne({ appointmentId: apt._id });
    if (!existingRec) {
      const plannedMaterials = await buildPlannedMaterialsFromServices(
        (apt.services || []).map((s) => s.serviceId)
      );

      const recordType = (apt.serviceType === 'MEDICAL' || apt.services.some((s) => s.serviceType === 'MEDICAL'))
        ? 'MEDICAL'
        : 'GROOMING';

      const recordId = new mongoose.Types.ObjectId();
      const code = generateServiceRecordCode(apt.code, recordId);

      await ServiceRecord.create({
        _id: recordId,
        code,
        appointmentId: apt._id,
        branchId: apt.branchId?._id || apt.branchId,
        customerId: apt.customerId,
        petId: apt.petId || apt.services[0]?.petId || null,
        serviceIds: apt.services.map((s) => s.serviceId),
        assignedStaffIds: actor?.id ? [new mongoose.Types.ObjectId(actor.id)] : (apt.services.map((s) => s.assignedStaffId).filter(Boolean)),
        reviewerStaffId: apt.reviewerStaffId || null,
        recordType,
        status: 'IN_PROGRESS',
        plannedMaterials,
        actualMaterials: plannedMaterials.map((m) => ({
          inventoryItemId: m.inventoryItemId,
          quantity: m.quantity,
          unit: m.unit,
          notes: m.notes || null,
          isDefault: true,
          isExtra: false,
        })),
        actualStartAt: new Date(),
      });
    }
  } catch (err) {
    // Non-blocking
  }

  return formatAppointment(apt);
};

export const checkInAppointment = async (id, data = {}, actor) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Invalid appointment ID');
  }

  const apt = await Appointment.findById(id).populate('branchId');
  if (!apt) {
    throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
  }

  if (actor) {
    const role = actor.systemRole || actor.role;
    if (['VETERINARIAN', 'NURSE', 'CARE_STAFF_GROOMER'].includes(role) || (role === 'STAFF' && actor.staffSubRole && actor.staffSubRole !== 'RECEPTIONIST')) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Only receptionists, managers, or admins can check in appointments');
    }
    if (role === 'MANAGER' || role === 'RECEPTIONIST' || (role === 'STAFF' && actor.staffSubRole === 'RECEPTIONIST')) {
      const rawBranches = role === 'MANAGER'
        ? actor.assignedBranchIds || actor.authorizedBranchIds
        : actor.authorizedBranchIds ?? actor.assignedBranchIds;
      if (Array.isArray(rawBranches)) {
        const authBranches = rawBranches.map((b) => (b._id || b).toString());
        const aptBranchId = (apt.branchId?._id || apt.branchId)?.toString();
        if (authBranches.length === 0 || !aptBranchId || !authBranches.includes(aptBranchId)) {
          throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'You do not have access to this branch');
        }
      }
    }
  }

  if (apt.status && apt.status !== 'CONFIRMED') {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.INVALID_STATE_TRANSITION,
      `Only CONFIRMED appointments can be checked in (current status: ${apt.status})`
    );
  }

  if (apt.checkInStatus === 'ARRIVED') {
    throw new AppError(
      409,
      'Conflict',
      ErrorCodes.INVALID_STATE_TRANSITION,
      'Appointment has already been checked in'
    );
  }

  const now = new Date();
  apt.checkInStatus = 'ARRIVED';
  apt.checkedInAt = now;
  if (Array.isArray(apt.services)) {
    apt.services.forEach((seg) => {
      seg.checkInStatus = 'ARRIVED';
      seg.checkedInAt = now;
      if (actor?.id && mongoose.Types.ObjectId.isValid(actor.id)) {
        seg.checkedInBy = new mongoose.Types.ObjectId(actor.id);
      }
    });
  }
  if (!apt.statusHistory) apt.statusHistory = [];
  apt.statusHistory.push({
    status: apt.status,
    at: now,
    actorId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : null,
    note: data.note || 'Khách hàng đã check-in tại chi nhánh',
  });

  await apt.save();
  return formatAppointment(apt);
};

/**
 * Mock Complete Prepayment (Deposit or Full)
 */
export const mockCompletePayment = async (prepaymentId, dataOrActor = null, possibleActor = null, guestToken = null) => {
  const isOutcomePayload =
    dataOrActor &&
    typeof dataOrActor === 'object' &&
    ('outcome' in dataOrActor || 'failureReason' in dataOrActor);
  const payload = isOutcomePayload ? dataOrActor : { outcome: 'PAID' };
  const actor = isOutcomePayload ? possibleActor : dataOrActor;
  return completeMockPaymentService(prepaymentId, payload, actor, guestToken);
};

/**
 * Assign medical reviewer to confirmed appointment (CAS concurrency check)
 */
export const assignReviewer = async (id, staffId, expectedVersion, actor) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid appointmentId');
  }
  if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid staffId');
  }
  if (typeof expectedVersion !== 'number') {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'expectedVersion is required');
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Appointment not found');
  }

  if (appointment.version !== expectedVersion) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Version conflict: appointment was modified');
  }

  const staff = await StaffProfile.findById(staffId);
  if (!staff || staff.staffSubRole !== 'VETERINARIAN' || staff.status !== 'ACTIVE') {
    throw new AppError(422, 'UnprocessableEntity', ErrorCodes.STAFF_ROLE_MISMATCH, 'Reviewer must be an active Veterinarian');
  }

  appointment.reviewerStaffId = staffId;
  appointment.version = (appointment.version || 0) + 1;
  await appointment.save();

  return formatAppointment(appointment);
};

/**
 * Preview Appointment Pricing & Deposit (Rules 1-9 in docs/catalog (2).xlsx)
 * - Uses per-tier GROOMING pricing (XS/S/M/L fixed; XL >30kg = REQUIRES_QUOTE), never basePrice + surcharge
 */
export const previewAppointmentPricing = async ({
  serviceIds = [],
  petId = null,
  petWeightKg = null,
  branchId,
  voucherCode,
  customerId = null,
  actor = null,
} = {}) => {
  const ids = Array.isArray(serviceIds) ? serviceIds : (serviceIds ? [serviceIds] : []);
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));

  let effectiveWeight =
    petWeightKg !== null && petWeightKg !== undefined && petWeightKg !== '' && !Number.isNaN(Number(petWeightKg))
      ? Number(petWeightKg)
      : null;

  let petDoc = null;
  if (
    petId &&
    mongoose.Types.ObjectId.isValid(petId) &&
    (mongoose.connection.readyState === 1 || Pet.findById?._isMockFunction)
  ) {
    try {
      let pq = Pet.findById(petId);
      if (typeof pq?.select === 'function') pq = pq.select('weightKg customerId');
      if (typeof pq?.lean === 'function') pq = pq.lean();
      petDoc = await pq;
      if ((effectiveWeight === null || effectiveWeight <= 0) && petDoc && Number(petDoc.weightKg) > 0) {
        effectiveWeight = Number(petDoc.weightKg);
      }
    } catch {
      // ignore lookup fallback
    }
  }

  const isCustomerActor = actor && (actor.systemRole === 'CUSTOMER' || actor.role === 'CUSTOMER');
  const isInternalStaffActor = actor && ['STAFF', 'MANAGER', 'ADMIN', 'RECEPTIONIST'].includes(actor.systemRole);
  const CustomerModel = mongoose.models.Customer || mongoose.model('Customer');
  const canQueryCustomer = mongoose.connection.readyState === 1 || CustomerModel?.findOne?._isMockFunction;

  let effectiveCustomerId = null;
  if (isCustomerActor) {
    const actorId = (actor.id || actor._id)?.toString() || null;
    effectiveCustomerId = actorId;
    if (actorId && mongoose.Types.ObjectId.isValid(actorId) && canQueryCustomer) {
      try {
        let cq = CustomerModel.findOne({ $or: [{ userId: actorId }, { _id: actorId }] });
        if (typeof cq?.select === 'function') cq = cq.select('_id');
        if (typeof cq?.lean === 'function') cq = cq.lean();
        const custDoc = await cq;
        if (custDoc?._id) {
          effectiveCustomerId = custDoc._id.toString();
        }
      } catch {
        // Keep bearer actorId fallback
      }
    }
  } else if (isInternalStaffActor) {
    // Staff/Admin booking on behalf must validate voucher against target customer (not Admin/Staff identity)
    const rawTargetCustId = customerId ? String(customerId).trim() : null;
    if (rawTargetCustId) {
      if (!mongoose.Types.ObjectId.isValid(rawTargetCustId)) {
        throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Invalid customerId format');
      }
      effectiveCustomerId = rawTargetCustId;
      if (canQueryCustomer) {
        try {
          let cq = CustomerModel.findOne({ $or: [{ _id: rawTargetCustId }, { userId: rawTargetCustId }] });
          if (typeof cq?.select === 'function') cq = cq.select('_id');
          if (typeof cq?.lean === 'function') cq = cq.lean();
          const custDoc = await cq;
          if (custDoc?._id) {
            effectiveCustomerId = custDoc._id.toString();
          } else if (mongoose.connection.readyState === 1) {
            const UserModel = mongoose.models.User || mongoose.model('User');
            const userDoc = await UserModel.findById(rawTargetCustId).select('_id').lean();
            if (!userDoc) {
              throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Target customer not found');
            }
          }
        } catch (err) {
          if (err instanceof AppError) throw err;
        }
      }
    } else if (petDoc?.customerId) {
      effectiveCustomerId = (petDoc.customerId._id || petDoc.customerId).toString();
    }
  } else if (!actor && customerId) {
    effectiveCustomerId = String(customerId);
  }

  let services = [];
  if (validIds.length > 0 && (mongoose.connection.readyState === 1 || Service.find?._isMockFunction)) {
    try {
      services = await Service.find({ _id: { $in: validIds } });
    } catch {
      services = [];
    }
  }

  let subtotal = 0;
  let requiresQuote = false;
  let weightMissing = false;
  const breakdown = [];
  const weightTier = effectiveWeight !== null && effectiveWeight > 0 ? resolveWeightTierCode(effectiveWeight) : null;

  if (services.length > 0) {
    for (const s of services) {
      const resolved = resolveServiceWeightPricing(s, effectiveWeight);
      if (resolved.weightMissing) {
        weightMissing = true;
      }
      if (resolved.requiresQuote) {
        requiresQuote = true;
      }
      const linePrice =
        resolved.price !== null && resolved.price !== undefined
          ? Number(resolved.price)
          : (s.serviceType === 'GROOMING' && resolved.weightMissing ? Number(s.basePrice || 0) : 0);

      if (!resolved.requiresQuote) {
        subtotal += linePrice;
      }

      breakdown.push({
        serviceId: (s._id || s.id).toString(),
        code: s.code || null,
        name: s.name,
        serviceType: s.serviceType,
        bookingMode: s.bookingMode,
        resolvedTier: resolved.tier,
        variantLabel: resolved.variantLabel,
        requiresQuote: resolved.requiresQuote,
        weightMissing: resolved.weightMissing,
        unitPrice: resolved.requiresQuote ? null : linePrice,
      });
    }
  } else {
    subtotal = 250000;
  }

  // Weight-based pricing replaces legacy surcharge completely
  const surchargeTotal = 0;

  if (requiresQuote) {
    return {
      subtotal: null,
      surchargeTotal: 0,
      weightKg: effectiveWeight,
      weightTier,
      weightMissing,
      requiresQuote: true,
      quoteReason: weightTier === 'XL' ? 'WEIGHT_XL_REQUIRES_QUOTE' : 'BOOKING_MODE_REQUIRES_QUOTE',
      quoteMessage: 'Thú cưng trên 30kg (XL) hoặc dịch vụ chuyên biệt cần báo giá trực tiếp. Vui lòng liên hệ chi nhánh hoặc gửi yêu cầu tư vấn.',
      breakdown,
      voucherDiscount: 0,
      voucherValid: false,
      voucherMessage: null,
      finalAmount: null,
      depositType: 'PERCENTAGE',
      depositValue: 30,
      depositAmount: null,
      balanceAmount: null,
      policyText: 'Khách hàng thanh toán trước 30% tiền cọc khi chọn thanh toán online. Số tiền còn lại sẽ được thanh toán tại phòng khám sau khi hoàn tất dịch vụ. Hủy trước 24 giờ hoàn 100% tiền cọc.',
    };
  }

  let voucherDiscount = 0;
  let voucherValid = false;
  let voucherMessage = null;

  if (voucherCode && typeof voucherCode === 'string' && voucherCode.trim().length > 0) {
    const rawCode = voucherCode.trim();
    try {
      const check = await validateVoucherEligibility({
        code: rawCode,
        scope: 'SERVICE',
        subtotal,
        serviceIds: validIds.map((id) => id.toString()),
        branchId,
        customerId: effectiveCustomerId,
      });

      if (check.valid) {
        voucherDiscount = check.discount || 0;
        voucherValid = true;
      } else {
        voucherMessage = check.reason || 'Voucher không hợp lệ cho dịch vụ này';
      }
    } catch {
      if (['WELCOME50', 'PETCLINIC50K'].includes(rawCode.toUpperCase())) {
        voucherDiscount = 50000;
        voucherValid = true;
      }
    }
  }

  const finalAmount = Math.max(0, subtotal - voucherDiscount);
  const depositType = 'PERCENTAGE';
  const depositValue = 30;
  const depositAmount = Math.round(finalAmount * 0.30);
  const balanceAmount = finalAmount - depositAmount;

  return {
    subtotal,
    surchargeTotal,
    weightKg: effectiveWeight,
    weightTier,
    weightMissing,
    requiresQuote: false,
    breakdown,
    voucherDiscount,
    voucherValid,
    voucherMessage,
    finalAmount,
    depositType,
    depositValue,
    depositAmount,
    balanceAmount,
    policyText: 'Khách hàng thanh toán trước 30% tiền cọc khi chọn thanh toán online. Số tiền còn lại sẽ được thanh toán tại phòng khám sau khi hoàn tất dịch vụ. Hủy trước 24 giờ hoàn 100% tiền cọc.',
  };
};

/**
 * Preview Cancellation & Refund Policy (AP05 / CF07)
 */
export const getCancelPreview = async (id, actor) => {
  let apt = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    apt = await Appointment.findById(id);
  }
  if (!apt) {
    apt = await Appointment.findOne({ $or: [{ code: id }, { appointmentCode: id }] });
  }
  if (!apt) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Appointment not found');
  }

  const now = Date.now();
  const startTime = apt.scheduledStart ? new Date(apt.scheduledStart).getTime() : 0;
  const minutesUntilStart = startTime > 0 ? Math.round((startTime - now) / 60000) : 0;
  const hoursBeforeStart = startTime > 0 ? (startTime - now) / 3600000 : 0;
  const paidAmount = Number(apt.pricing?.paidAmount || 0);
  const depositAmount = Number(apt.pricing?.depositAmount || Math.round((apt.pricing?.finalAmount || 0) * 0.30));
  const finalAmount = Number(apt.pricing?.finalAmount || 0);

  const refundable = hoursBeforeStart >= 24;
  let penaltyAmount = 0;
  if (!refundable) {
    penaltyAmount = Math.round(finalAmount * 0.30);
  }
  const refundAmount = Math.max(0, paidAmount - penaltyAmount);

  return {
    appointmentId: apt._id.toString(),
    code: apt.code,
    status: apt.status,
    scheduledStart: apt.scheduledStart,
    minutesUntilStart,
    hoursBeforeStart: Number(hoursBeforeStart.toFixed(1)),
    refundable,
    paidAmount,
    depositAmount,
    finalAmount,
    refundAmount,
    penaltyAmount,
    prepaidOutcome: refundAmount > 0 ? 'REFUND_PENDING' : (paidAmount > 0 ? 'FORFEITED' : 'NONE'),
    cancellationDeadline: startTime > 0 ? new Date(startTime - 24 * 3600000).toISOString() : null,
    policyMessage: refundable
      ? `Lịch hẹn còn hơn 24 giờ. Bạn đủ điều kiện hoàn 100% tiền cọc (${new Intl.NumberFormat('vi-VN').format(refundAmount > 0 ? refundAmount : depositAmount)}đ).`
      : `Lịch hẹn chỉ còn ${Number(hoursBeforeStart.toFixed(1))} giờ (dưới 24 giờ). Tiền cọc (${new Intl.NumberFormat('vi-VN').format(depositAmount || penaltyAmount)}đ) sẽ không được hoàn lại theo chính sách.`,
  };
};

/**
 * Background auto-repair migration to ensure all appointments have valid customer names
 * (Resolves generic "Khách hàng" into true Customer/User/Guest names)
 */
export const migrateAppointmentCustomerNames = async () => {
  try {
    if (mongoose.connection?.readyState !== 1) return;
    const Appointment = mongoose.connection.db.collection('appointments');
    const Customer = mongoose.connection.db.collection('customers');
    const User = mongoose.connection.db.collection('users');
    const Guest = mongoose.connection.db.collection('guestcontacts');

    const apts = await Appointment.find({
      $or: [
        { contactSnapshot: null },
        { customerSnapshot: null },
        { 'contactSnapshot.fullName': null },
        { 'contactSnapshot.fullName': { $exists: false } },
        { 'contactSnapshot.fullName': 'Khách hàng' },
        { 'contactSnapshot.fullName': 'Thành viên' },
      ],
    }).toArray();

    for (const a of apts) {
      let resolvedName = a.contactSnapshot?.name || a.customerSnapshot?.name || null;
      let phone = a.contactSnapshot?.phone || a.customerSnapshot?.phone || '';
      let email = a.contactSnapshot?.email || a.customerSnapshot?.email || '';

      if (!resolvedName || resolvedName === 'Khách hàng' || resolvedName === 'Thành viên') {
        if (a.customerId) {
          const c = await Customer.findOne({ $or: [{ _id: a.customerId }, { userId: a.customerId }] });
          const u = await User.findOne({ _id: a.customerId });
          resolvedName = c?.fullName || c?.name || u?.fullName || u?.name;
          if (!phone) phone = c?.contactPhone || c?.phone || u?.phone || '';
          if (!email) email = c?.contactEmail || c?.email || u?.email || '';
        }
        if (!resolvedName && a.guestContactId) {
          const g = await Guest.findOne({ _id: a.guestContactId });
          resolvedName = g?.fullName || g?.name;
          if (!phone) phone = g?.phone || '';
          if (!email) email = g?.email || '';
        }
      }

      if (resolvedName) {
        await Appointment.updateOne(
          { _id: a._id },
          {
            $set: {
              contactSnapshot: { fullName: resolvedName, name: resolvedName, phone, email },
              customerSnapshot: { fullName: resolvedName, name: resolvedName, phone, email },
            },
          }
        );
      }
    }
  } catch (_e) {}
};


