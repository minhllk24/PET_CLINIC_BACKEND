import mongoose from 'mongoose';
import * as bookingService from './booking.service';
import * as availabilityService from './availability.service';

export const getAvailability = async (req, res, next) => {
  try {
    const rawServiceIds = req.query.serviceIds || req.query.serviceId || req.query.service_id;
    const rawBranchId = req.query.branchId || req.query.branch_id || req.query.branch;
    const rawDate = req.query.date || req.query.bookingDate || req.query.appointmentDate || new Date().toISOString().slice(0, 10);
    const { includeFull } = req.query;
    const isIncludeFull =
      includeFull === 'true' ||
      includeFull === true ||
      ['ADMIN', 'MANAGER', 'STAFF'].includes(req.actor?.systemRole);

    const result = await availabilityService.getAvailability({
      serviceIds: rawServiceIds,
      branchId: rawBranchId,
      date: rawDate,
      includeFull: isIncludeFull,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getBranchOperationSlots = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { date, serviceId, includeFull } = req.query;
    const result = await availabilityService.getBranchOperationSlots(
      {
        branchId,
        date: date || new Date().toISOString().slice(0, 10),
        serviceId,
        includeFull: includeFull !== 'false',
      },
      req.actor
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getServiceOccupancy = async (req, res, next) => {
  try {
    const { branchId, serviceId } = req.params;
    const { date } = req.query;
    const result = await availabilityService.getAvailability({
      serviceIds: [serviceId],
      branchId,
      date: date || new Date().toISOString().slice(0, 10),
      includeFull: true,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.createAppointment(
      req.body,
      req.actor,
      req.guest || req.headers['x-guest-lookup-token']
    );
    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};

export const createInternalAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.createInternalAppointment(req.body, req.actor);
    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};

export const listAppointments = async (req, res, next) => {
  try {
    const isMyHistory = req.path.includes('my-history') || req.baseUrl.includes('my-history') || req.originalUrl?.includes('my-history');
    if (isMyHistory && !req.actor) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'Vui lòng đăng nhập để xem lịch sử đặt lịch',
      });
    }
    const result = await bookingService.getAppointments(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getAppointmentById = async (req, res, next) => {
  try {
    const appointment = await bookingService.getAppointmentById(
      req.params.id,
      req.actor,
      req.guest || req.headers['x-guest-lookup-token']
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const confirmAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.confirmAppointment(req.params.id, req.actor);
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const rejectAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.rejectAppointment(
      req.params.id,
      req.body?.reason,
      req.actor
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const rescheduleAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.rescheduleAppointment(
      req.params.id,
      req.body,
      req.actor,
      req.guest || req.headers['x-guest-lookup-token']
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const rescheduleOverride = async (req, res, next) => {
  try {
    const appointment = await bookingService.rescheduleOverride(
      req.params.id,
      req.body,
      req.actor
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.cancelAppointment(
      req.params.id,
      req.body?.reason,
      req.actor,
      req.guest || req.headers['x-guest-lookup-token']
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const storeCancelAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.storeCancelAppointment(
      req.params.id,
      req.body?.reason,
      req.actor
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const cancelOverride = async (req, res, next) => {
  try {
    const appointment = await bookingService.cancelOverride(
      req.params.id,
      req.body,
      req.actor
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const markNoShow = async (req, res, next) => {
  try {
    const appointment = await bookingService.markNoShow(
      req.params.id,
      req.actor,
      req.body
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const checkInAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.checkInAppointment(
      req.params.id,
      req.body || {},
      req.actor
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const startSegment = async (req, res, next) => {
  try {
    const appointment = await bookingService.startSegment(
      req.params.id,
      {
        serviceId: req.body?.serviceId,
        expectedVersion: req.body?.expectedVersion,
      },
      req.actor
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const reassignSegmentStaff = async (req, res, next) => {
  try {
    const appointment = await bookingService.reassignSegmentStaff(
      req.params.id,
      req.params.serviceId,
      req.body.staffId,
      req.actor
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const mockCompletePayment = async (req, res, next) => {
  try {
    const payload = req.body && Object.keys(req.body).length > 0 ? req.body : { outcome: 'PAID' };
    const result = await bookingService.mockCompletePayment(
      req.params.prepaymentId,
      payload,
      req.actor,
      req.guest || req.headers['x-guest-lookup-token']
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const assignReviewer = async (req, res, next) => {
  try {
    const { staffId, expectedVersion } = req.body;
    const appointment = await bookingService.assignReviewer(
      req.params.id,
      staffId,
      expectedVersion,
      req.actor
    );
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};


export const checkoutAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payment_method, paymentMethod } = req.body || {};
    const rawMethod = payment_method || paymentMethod;
    const normalizedMethod =
      rawMethod === 'store' || rawMethod === 'PAY_AT_STORE'
        ? 'PAY_AT_STORE'
        : rawMethod === 'online' || rawMethod === 'ONLINE_MOCK'
          ? 'ONLINE_MOCK'
          : rawMethod;

    const Appointment = require('./models/Appointment').default || require('./models/Appointment');
    let appointment = null;
    if (id && mongoose.isValidObjectId(id)) {
      appointment = await Appointment.findById(id);
    }
    if (!appointment && id) {
      appointment = await Appointment.findOne({ $or: [{ code: id }, { appointmentCode: id }] });
    }
    if (!appointment) {
      return res.status(404).json({
        success: false,
        code: 'APPOINTMENT_NOT_FOUND',
        message: 'Appointment not found',
      });
    }

    if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(appointment.status)) {
      return res.status(422).json({
        success: false,
        code: 'INVALID_STATE',
        message: `Cannot checkout appointment in status ${appointment.status}`,
      });
    }

    if (normalizedMethod) {
      appointment.paymentMethod = normalizedMethod;
      await appointment.save();
    }

    const isPaidConfirmed = appointment.status === 'CONFIRMED' || Number(appointment.pricing?.paidAmount || 0) >= Number(appointment.pricing?.finalAmount || 0);
    const prepaymentId = appointment.prepaymentId ? appointment.prepaymentId.toString() : null;

    return res.status(200).json({
      success: true,
      data: {
        id: appointment._id.toString(),
        appointmentId: appointment._id.toString(),
        prepaymentId,
        paymentId: prepaymentId,
        status: appointment.status,
        paymentMethod: appointment.paymentMethod,
        paymentStatus: isPaidConfirmed ? 'PAID' : 'PENDING',
        message: isPaidConfirmed
          ? 'Lịch hẹn đã được xác nhận thanh toán'
          : 'Khởi tạo thanh toán lịch hẹn, vui lòng hoàn tất qua cổng thanh toán',
      },
      status: appointment.status,
      message: isPaidConfirmed
        ? 'Lịch hẹn đã được xác nhận thanh toán'
        : 'Khởi tạo thanh toán lịch hẹn, vui lòng hoàn tất qua cổng thanh toán',
    });
  } catch (error) {
    next(error);
  }
};

export const previewPricing = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const isInternalStaff = req.actor && ['STAFF', 'MANAGER', 'ADMIN', 'RECEPTIONIST'].includes(req.actor.systemRole);
    const result = await bookingService.previewAppointmentPricing({
      serviceIds: payload.serviceIds || (payload.serviceId ? [payload.serviceId] : []),
      petId: payload.petId || payload.pet_id || null,
      petWeightKg: payload.petWeightKg ?? payload.petWeight ?? payload.weightKg ?? null,
      branchId: payload.branchId,
      voucherCode: payload.voucherCode || payload.voucher_code,
      customerId: isInternalStaff ? (payload.customerId || payload.customer_id || null) : null,
      actor: req.actor || null,
    });
    res.json({
      success: true,
      data: result,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCancelPreview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await bookingService.getCancelPreview(id, req.actor);
    res.json({
      success: true,
      data: result,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
