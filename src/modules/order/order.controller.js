import * as orderService from './order.service';

export const checkoutCreateOrder = async (req, res, next) => {
  try {
    const order = await orderService.checkoutCreateOrder(req.body, req.actor, req.headers['x-guest-cart-token']);
    res.status(201).json(orderService.formatOrder(order));
  } catch (error) {
    next(error);
  }
};

export const listOrders = async (req, res, next) => {
  try {
    const result = await orderService.listOrders(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getOrderStats = async (req, res, next) => {
  try {
    const result = await orderService.getOrderStats(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.actor, req.headers['x-guest-lookup-token']);
    res.json(orderService.formatOrder(order));
  } catch (error) {
    next(error);
  }
};

export const confirmOrder = async (req, res, next) => {
  try {
    const order = await orderService.confirmOrder(req.params.id, req.actor);
    res.json(orderService.formatOrder(order));
  } catch (error) {
    next(error);
  }
};

export const processOrder = async (req, res, next) => {
  try {
    const order = await orderService.processOrder(req.params.id, req.actor);
    res.json(orderService.formatOrder(order));
  } catch (error) {
    next(error);
  }
};

export const shipOrder = async (req, res, next) => {
  try {
    const order = await orderService.shipOrder(req.params.id, req.body, req.actor);
    res.json(orderService.formatOrder(order));
  } catch (error) {
    next(error);
  }
};

export const markDelivered = async (req, res, next) => {
  try {
    const order = await orderService.markDelivered(req.params.id, req.actor);
    res.json(orderService.formatOrder(order));
  } catch (error) {
    next(error);
  }
};

export const staffCancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.actor, req.body && req.body.reason ? req.body.reason : 'Staff cancelled', false);
    res.json(orderService.formatOrder(order));
  } catch (error) {
    next(error);
  }
};

export const customerCancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.actor, req.body && req.body.reason ? req.body.reason : 'Customer requested cancellation', true);
    res.json(orderService.formatOrder(order));
  } catch (error) {
    next(error);
  }
};

export const getReturnableItems = async (req, res, next) => {
  try {
    const result = await orderService.getReturnableItems(req.params.id, req.actor, req.headers['x-guest-lookup-token']);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getReturnQuote = async (req, res, next) => {
  try {
    const result = await orderService.getReturnQuote(req.params.id, req.body.items, req.actor, req.headers['x-guest-lookup-token']);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const quoteAdminOrder = async (req, res, next) => {
  try {
    const result = await orderService.quoteAdminOrder(req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createAdminOrder = async (req, res, next) => {
  try {
    const result = await orderService.createAdminOrder(req.body, req.actor);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

