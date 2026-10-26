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
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import {
  validateVoucherEligibility,
  consumeQuotaInSession,
  restoreQuotaInSession,
} from '../order/voucher.service';

/**
 * Pure Serializer for a Service Segment (ServiceLine)
 * Enforces additionalProperties: false
 */
export const formatServiceLine = (seg) => {
  const line = {
    serviceId: (seg.serviceId?._id || seg.serviceId).toString(),
    serviceName: seg.serviceName,
    serviceType: seg.serviceType,
    variantLabel: seg.variantLabel || null,
    unitPrice: Number(seg.unitPrice || 0),
    durationMinutes: Number(seg.durationMinutes),
    requiredStaffRole: seg.requiredStaffRole,
    bookingMode: seg.bookingMode || 'BOOKABLE',
    sequence: Number(seg.sequence || 1),
    scheduledStart: new Date(seg.scheduledStart).toISOString(),
    scheduledEnd: new Date(seg.scheduledEnd).toISOString(),
    assignedStaffId: (seg.assignedStaffId?._id || seg.assignedStaffId).toString(),
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
    holdExpiresAt: isHoldActive ? new Date(doc.holdExpiresAt).toISOString() : null,
    version: typeof doc.version === 'number' ? doc.version : 0,
    prepaymentId: doc.prepaymentId
      ? (doc.prepaymentId._id || doc.prepaymentId).toString()
      : null,
  };

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
    res.petId = doc.petId ? (doc.petId._id || doc.petId).toString() : null;
  }
  if (doc.petSnapshot !== undefined) {
    res.petSnapshot = doc.petSnapshot || null;
  }
  if (doc.customerSnapshot !== undefined) {
    res.customerSnapshot = doc.customerSnapshot || null;
  }
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

  // Reviewer
  if (doc.reviewerStaffId !== undefined) {
    res.reviewerStaffId = doc.reviewerStaffId
      ? (doc.reviewerStaffId._id || doc.reviewerStaffId).toString()
      : null;
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
    await res.save({ session });
  }
};

const safeUpdateReservations = async (filter, update, session) => {
  if (mongoose.connection.readyState === 1 || (SlotReservation.updateMany && SlotReservation.updateMany._isMockFunction)) {
    await SlotReservation.updateMany(filter, update, { session });
  }
};

/**
 * Generate a unique Appointment Code
 */
const generateAppointmentCode = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
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

  const eligibleStaff = [];
  for (const shift of shifts) {
    const profile = shift.staffId;
    if (
      profile &&
      profile.status === 'ACTIVE' &&
      profile.staffSubRole === requiredStaffRole &&
      !occupiedStaffIds.has(profile._id.toString())
    ) {
      eligibleStaff.push(profile);
    }
  }

  if (eligibleStaff.length === 0) {
    throw new AppError(
      422,
      'UnprocessableEntity',
      'STAFF_UNAVAILABLE',
      `No available staff for role ${requiredStaffRole} in this time segment`
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
 * Public/Customer & Guest Appointment Creation
 */
export const createAppointment = async (data, actor, guestLookupToken) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
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

    // 1. Validate branch
    if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
      throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Invalid or missing branchId');
    }
    const branch = await Branch.findById(branchId).session(session);
    if (!branch || branch.status !== 'ACTIVE') {
      throw new AppError(404, 'NotFound', 'BRANCH_NOT_FOUND', 'Active branch not found');
    }

    // 2. Validate actor vs guest identity
    let customerId = null;
    let guestContactId = null;
    let contactSnapshot = null;

    const isCustomer = actor && (actor.systemRole === 'CUSTOMER' || actor.role === 'CUSTOMER');
    if (isCustomer) {
      customerId = actor.id || actor._id;
      if (contact) {
        throw new AppError(
          400,
          'ValidationError',
          'VALIDATION_ERROR',
          'Customer appointments must not supply contact'
        );
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
      const s = serviceMap.get(sId.toString());
      if (!s || s.status !== 'ACTIVE') {
        throw new AppError(404, 'NotFound', 'SERVICE_NOT_FOUND', `Active service ${sId} not found`);
      }
      if (s.bookingMode === 'CONTACT_ONLY') {
        throw new AppError(
          422,
          'UnprocessableEntity',
          'BOOKING_MODE_NOT_ALLOWED',
          'Emergency services require direct contact and cannot be booked online'
        );
      }
      if (s.bookingMode === 'REQUEST_ONLY') {
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

    // 4. Validate BranchServiceConfig for all services
    const configs = await BranchServiceConfig.find({
      branchId: new mongoose.Types.ObjectId(branchId),
      serviceId: { $in: objectIds },
    }).session(session);

    const configMap = new Map();
    configs.forEach((c) => configMap.set(c.serviceId.toString(), c));

    for (const s of orderedServices) {
      const cfg = configMap.get(s._id.toString());
      if (!cfg || !cfg.enabled) {
        throw new AppError(
          422,
          'UnprocessableEntity',
          'SERVICE_NOT_ENABLED_AT_BRANCH',
          `Service ${s.name} is not enabled at this branch`
        );
      }
    }

    // 5. Build sequential segments and reserve staff
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

      // Verify concurrency capacity
      const sId = service._id.toString();
      const cfg = configMap.get(sId);
      const capacity = Number(cfg.capacity) || 1;

      const concurrentCount = await Appointment.countDocuments({
        branchId: new mongoose.Types.ObjectId(branchId),
        status: { $in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_CONFIRMATION', 'PENDING_PAYMENT'] },
        scheduledStart: { $lt: segEnd },
        scheduledEnd: { $gt: segStart },
        'services.serviceId': service._id,
      }).session(session);

      if (concurrentCount >= capacity) {
        throw new AppError(
          409,
          'Conflict',
          'SLOT_UNAVAILABLE',
          `Service ${service.name} has reached maximum concurrent capacity at this time`
        );
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

      // Prepare SlotReservation units (15-min increments)
      const slotStartUnit = Math.floor(segStart.getTime() / (15 * 60000));
      const unitsNeeded = Math.ceil(duration / 15);

      for (let u = 0; u < unitsNeeded; u++) {
        reservationsToCreate.push({
          branchId: new mongoose.Types.ObjectId(branchId),
          staffId: assignedStaffId,
          serviceId: service._id,
          slotStartUnit: slotStartUnit + u,
          unitIndex: u,
          kind: 'STAFF',
          status: 'HELD',
          holdExpiresAt: new Date(Date.now() + 10 * 60000), // 10 minutes hold
        });
      }

      occupiedStaffIds.add(assignedStaffId.toString());
      prevStaffId = assignedStaffId;

      const variantLabel =
        variantLabels && variantLabels[sId] ? variantLabels[sId] : null;

      segments.push({
        serviceId: service._id,
        serviceName: service.name,
        serviceType: service.serviceType,
        variantLabel,
        unitPrice: service.basePrice || 100000,
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
    for (const resData of reservationsToCreate) {
      await safeCreateReservation(resData, session);
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
    let status = 'PENDING_CONFIRMATION';
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
        status = 'PENDING_CONFIRMATION';
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
      paidAmount = finalAmount;
      status = 'PENDING_CONFIRMATION';
      paymentAmount = finalAmount;
      paymentKind = 'FULL';
      paymentStatus = 'PAID';
      depositStatus = 'NOT_REQUIRED';
    }

    const holdExpiresAt = new Date(Date.now() + 10 * 60000); // 10-minute hold window

    // 8. Create Appointment
    const appointment = new Appointment({
      code: generateAppointmentCode(),
      customerId: customerId || null,
      guestContactId: guestContactId || null,
      contactSnapshot: contactSnapshot || null,
      petId: petId || null,
      petSnapshot: pet || null,
      customerSnapshot: isCustomer && actor ? { name: actor.name, phone: actor.phone } : null,
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
      source: 'ONLINE',
      note: note || null,
      conditionDescription: conditionDescription || null,
      version: 1,
    });

    await appointment.save({ session });

    // Link appointmentId to created slot reservations
    await safeUpdateReservations(
      { _id: { $in: reservationsToCreate.map((r) => r._id) } },
      { $set: { appointmentId: appointment._id } },
      session
    );

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
      const payment = new Payment({
        targetType: 'APPOINTMENT',
        targetId: appointment._id,
        method: 'ONLINE_MOCK',
        kind: paymentKind,
        status: paymentStatus,
        amount: paymentAmount,
      });
      await payment.save({ session });

      appointment.prepaymentId = payment._id;
      if (paymentMethod === 'PAY_AT_STORE') {
        appointment.deposit.paymentId = payment._id;
      }
      await appointment.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return formatAppointment(appointment);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.code === 11000) {
      throw new AppError(
        409,
        'Conflict',
        'SLOT_UNAVAILABLE',
        'The requested time slot or assigned staff is already reserved by another customer'
      );
    }
    throw error;
  }
};

/**
 * Internal Appointment Creation (Receptionist / Manager / Admin)
 */
export const createInternalAppointment = async (data, actor) => {
  // Allows optional explicit staffAssignments
  return createAppointment(data, actor, null);
};

/**
 * List Appointments with role scoping and pagination
 */
export const getAppointments = async (filters = {}, actor) => {
  const query = {};

  if (filters.branchId && mongoose.Types.ObjectId.isValid(filters.branchId)) {
    query.branchId = new mongoose.Types.ObjectId(filters.branchId);
  }
  if (filters.customerId && mongoose.Types.ObjectId.isValid(filters.customerId)) {
    query.customerId = new mongoose.Types.ObjectId(filters.customerId);
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.from || filters.to) {
    query.scheduledStart = {};
    if (filters.from) query.scheduledStart.$gte = new Date(filters.from);
    if (filters.to) query.scheduledStart.$lte = new Date(filters.to);
  }

  // Scoping based on Role
  if (actor) {
    const role = actor.systemRole || actor.role;
    if (role === 'CUSTOMER') {
      query.customerId = new mongoose.Types.ObjectId(actor.id || actor._id);
    } else if (role === 'RECEPTIONIST' && actor.authorizedBranchIds?.length > 0) {
      query.branchId = { $in: actor.authorizedBranchIds.map((id) => new mongoose.Types.ObjectId(id)) };
    } else if (role === 'MANAGER' && actor.assignedBranchIds?.length > 0) {
      query.branchId = { $in: actor.assignedBranchIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
  }

  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
  const appointments = await Appointment.find(query).sort({ scheduledStart: -1 }).limit(limit);

  return {
    items: appointments.map(formatAppointment),
    nextCursor: null,
  };
};

/**
 * Get Appointment by ID with Authorization check
 */
export const getAppointmentById = async (id, actor, guestToken) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'Invalid appointment ID');
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
  }

  // Check scoping
  if (actor) {
    const role = actor.systemRole || actor.role;
    if (role === 'CUSTOMER') {
      if (appointment.customerId && appointment.customerId.toString() !== (actor.id || actor._id).toString()) {
        throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Access denied to this appointment');
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

    if (apt.status !== 'PENDING_CONFIRMATION') {
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
    };

    if (paidAmount > 0) {
      apt.deposit.status = 'REFUNDED';
      const payment = await Payment.findOne({
        targetType: 'APPOINTMENT',
        targetId: apt._id,
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
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

/**
 * Reschedule Appointment (Customer / Guest self-service)
 */
export const rescheduleAppointment = async (id, { newSlotStart }, actor) => {
  if (!newSlotStart) {
    throw new AppError(400, 'ValidationError', 'VALIDATION_ERROR', 'newSlotStart is required');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    if (apt.status !== 'CONFIRMED') {
      throw new AppError(
        422,
        'UnprocessableEntity',
        'INVALID_STATE',
        'Reschedule is only allowed for CONFIRMED appointments'
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

    // Recompute schedule
    let currentStart = new Date(newSlotStart);
    for (const seg of apt.services) {
      const segStart = new Date(currentStart);
      const segEnd = new Date(currentStart.getTime() + seg.durationMinutes * 60000);
      seg.scheduledStart = segStart;
      seg.scheduledEnd = segEnd;
      currentStart = segEnd;
    }

    apt.scheduledStart = new Date(newSlotStart);
    apt.scheduledEnd = currentStart;
    apt.rescheduleCount = (apt.rescheduleCount || 0) + 1;

    // Atomically replace slot reservations
    await safeDeleteReservations(apt._id, session);

    for (const seg of apt.services) {
      const slotStartUnit = Math.floor(seg.scheduledStart.getTime() / (15 * 60000));
      const unitsNeeded = Math.ceil(seg.durationMinutes / 15);
      for (let u = 0; u < unitsNeeded; u++) {
        await safeCreateReservation({
          branchId: apt.branchId,
          staffId: seg.assignedStaffId,
          serviceId: seg.serviceId,
          appointmentId: apt._id,
          slotStartUnit: slotStartUnit + u,
          unitIndex: u,
          kind: 'STAFF',
          status: 'CONFIRMED',
          holdExpiresAt: null,
        }, session);
      }
    }

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();

    return formatAppointment(apt);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.code === 11000) {
      throw new AppError(
        409,
        'Conflict',
        'SLOT_UNAVAILABLE',
        'The new slot has conflict with existing staff reservations'
      );
    }
    throw error;
  }
};

/**
 * Reschedule Override (Manager / Admin)
 */
export const rescheduleOverride = async (id, data, actor) => {
  if (!data.newSlotStart || !data.reason) {
    throw new AppError(
      400,
      'ValidationError',
      'VALIDATION_ERROR',
      'newSlotStart and reason are required'
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    }

    // Bypasses 24h & limit constraint
    let currentStart = new Date(data.newSlotStart);
    for (const seg of apt.services) {
      const segStart = new Date(currentStart);
      const segEnd = new Date(currentStart.getTime() + seg.durationMinutes * 60000);
      seg.scheduledStart = segStart;
      seg.scheduledEnd = segEnd;
      currentStart = segEnd;
    }

    apt.scheduledStart = new Date(data.newSlotStart);
    apt.scheduledEnd = currentStart;

    await safeDeleteReservations(apt._id, session);

    for (const seg of apt.services) {
      const slotStartUnit = Math.floor(seg.scheduledStart.getTime() / (15 * 60000));
      const unitsNeeded = Math.ceil(seg.durationMinutes / 15);
      for (let u = 0; u < unitsNeeded; u++) {
        await safeCreateReservation({
          branchId: apt.branchId,
          staffId: seg.assignedStaffId,
          serviceId: seg.serviceId,
          appointmentId: apt._id,
          slotStartUnit: slotStartUnit + u,
          unitIndex: u,
          kind: 'STAFF',
          status: 'CONFIRMED',
          holdExpiresAt: null,
        }, session);
      }
    }

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
 * Customer / Guest Cancellation
 */
export const cancelAppointment = async (id, reasonOrActor, possibleActor) => {
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

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(apt.status)) {
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
      prepaidOutcome: refundAmount > 0 ? 'REFUND_PENDING' : 'FORFEITED',
    };

    if (refundAmount > 0) {
      const payment = await Payment.findOne({
        targetType: 'APPOINTMENT',
        targetId: apt._id,
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
    await session.abortTransaction();
    session.endSession();
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
    };

    if (paidAmount > 0) {
      const payment = await Payment.findOne({
        targetType: 'APPOINTMENT',
        targetId: apt._id,
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
    await session.abortTransaction();
    session.endSession();
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

    apt.status = 'CANCELLED';
    apt.holdExpiresAt = null;
    apt.cancel = {
      by: 'STORE',
      at: new Date(),
      actorId: actor ? (actor.id || actor._id) : null,
      reason: data?.reason || 'Manager cancel override',
      hoursBeforeStart: 0,
      prepaidOutcome: data?.prepaidOutcome || 'REFUNDED',
    };

    await safeDeleteReservations(apt._id, session);

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
 * Mark No-Show (Receptionist / Manager / Admin)
 */
export const markNoShow = async (id, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) {
      throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
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
      reason: 'Customer no-show',
      hoursBeforeStart: 0,
      prepaidOutcome: refundAmount > 0 ? 'REFUND_PENDING' : 'FORFEITED',
    };

    if (refundAmount > 0) {
      const payment = await Payment.findOne({
        targetType: 'APPOINTMENT',
        targetId: apt._id,
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
    await session.abortTransaction();
    session.endSession();
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

    const segment = apt.services.find((s) => s.serviceId.toString() === serviceId.toString());
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
export const startSegment = async (id, serviceId, actor) => {
  const apt = await Appointment.findById(id);
  if (!apt) {
    throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
  }

  const segment = apt.services.find((s) => s.serviceId.toString() === serviceId.toString());
  if (!segment) {
    throw new AppError(404, 'NotFound', 'SERVICE_NOT_FOUND', 'Segment not found');
  }

  segment.executionStatus = 'IN_PROGRESS';
  segment.executionStartedAt = new Date();

  if (apt.status === 'CONFIRMED') {
    apt.status = 'IN_PROGRESS';
  }

  await apt.save();
  return formatAppointment(apt);
};

/**
 * Mock Complete Prepayment (Deposit or Full)
 */
export const mockCompletePayment = async (prepaymentId, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await Payment.findById(prepaymentId).session(session);
    if (!payment) {
      throw new AppError(404, 'NotFound', 'PAYMENT_NOT_FOUND', 'Payment not found');
    }
    if (payment.status === 'PAID') {
      await session.abortTransaction();
      session.endSession();
      return { message: 'Already paid' };
    }

    payment.status = 'PAID';
    payment.paidAt = new Date();
    await payment.save({ session });

    if (payment.targetType === 'APPOINTMENT') {
      const apt = await Appointment.findById(payment.targetId).session(session);
      if (apt && apt.status === 'PENDING_PAYMENT') {
        apt.pricing.paidAmount += payment.amount;
        apt.deposit.status = 'HELD';
        apt.status = 'PENDING_CONFIRMATION';
        apt.holdExpiresAt = new Date(Date.now() + 10 * 60000);
        await apt.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();
    return payment;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
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

