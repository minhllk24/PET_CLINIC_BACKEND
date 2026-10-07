import * as bookingService from './booking.service';

export const createAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.createAppointment(req.body, req.actor, req.headers['x-guest-lookup-token']);
    res.status(201).json(appointment);
  } catch (error) { next(error); }
};

export const listAppointments = async (req, res, next) => {
  try {
    // simplified
    const appointments = await bookingService.getAppointments();
    res.json(appointments);
  } catch (error) { next(error); }
};

export const confirmAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.confirmAppointment(req.params.id, req.actor);
    res.json(appointment);
  } catch (error) { next(error); }
};

export const rescheduleAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.rescheduleAppointment(req.params.id, req.body, req.actor);
    res.json(appointment);
  } catch (error) { next(error); }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const appointment = await bookingService.cancelAppointment(req.params.id, req.actor);
    res.json(appointment);
  } catch (error) { next(error); }
};

export const markNoShow = async (req, res, next) => {
  try {
    const appointment = await bookingService.markNoShow(req.params.id, req.actor);
    res.json(appointment);
  } catch (error) { next(error); }
};

export const startSegment = async (req, res, next) => {
  try {
    const appointment = await bookingService.startSegment(req.params.id, req.body.serviceId, req.actor);
    res.json(appointment);
  } catch (error) { next(error); }
};
