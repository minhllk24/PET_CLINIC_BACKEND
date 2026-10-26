import * as bookingService from './booking.service';
import * as availabilityService from './availability.service';

export const getAvailability = async (req, res, next) => {
  try {
    const { serviceIds, branchId, date, includeFull } = req.query;
    const isIncludeFull =
      includeFull === 'true' ||
      includeFull === true ||
      ['ADMIN', 'MANAGER', 'STAFF'].includes(req.actor?.systemRole);

    const result = await availabilityService.getAvailability({
      serviceIds,
      branchId,
      date,
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
      req.headers['x-guest-lookup-token']
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
      req.headers['x-guest-lookup-token']
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
      req.actor
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
      req.actor
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
    const appointment = await bookingService.markNoShow(req.params.id, req.actor);
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const startSegment = async (req, res, next) => {
  try {
    const appointment = await bookingService.startSegment(
      req.params.id,
      req.body.serviceId,
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
    const result = await bookingService.mockCompletePayment(
      req.params.prepaymentId,
      req.actor
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
