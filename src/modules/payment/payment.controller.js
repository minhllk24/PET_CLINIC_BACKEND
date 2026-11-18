import * as paymentService from './payment.service';

const resolveVerifiedGuestToken = (req) => req.guest || req.headers['x-guest-lookup-token'] || null;

export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id, req.actor, resolveVerifiedGuestToken(req));
    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};

export const mockCompletePayment = async (req, res, next) => {
  try {
    const payment = await paymentService.mockCompletePayment(
      req.params.id,
      req.body,
      req.actor,
      resolveVerifiedGuestToken(req)
    );
    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};

export const cancelPendingPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.cancelPendingPayment(
      req.params.id,
      req.actor,
      resolveVerifiedGuestToken(req)
    );
    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};

export const recordPaymentAtStore = async (req, res, next) => {
  try {
    const payment = await paymentService.recordPaymentAtStore(req.params.id, req.actor);
    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};

export const createAndPayBookingBalance = async (req, res, next) => {
  try {
    const payment = await paymentService.createAndPayBookingBalance(req.params.appointmentId, req.actor);
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
};

