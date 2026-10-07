import * as orderService from './order.service';

export const checkoutCreateOrder = async (req, res, next) => {
  try {
    const order = await orderService.checkoutCreateOrder(req.body, req.actor, req.headers['x-guest-cart-token']);
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

export const listOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getOrders(req.query, req.actor);
    res.json(orders);
  } catch (error) { next(error); }
};

export const confirmOrder = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, 'CONFIRMED', req.actor);
    res.json(order);
  } catch (error) { next(error); }
};

export const processOrder = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, 'PROCESSING', req.actor);
    res.json(order);
  } catch (error) { next(error); }
};

export const shipOrder = async (req, res, next) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, 'SHIPPED', req.actor);
    res.json(order);
  } catch (error) { next(error); }
};

export const markDelivered = async (req, res, next) => {
  try {
    const order = await orderService.markDelivered(req.params.id, req.actor);
    res.json(order);
  } catch (error) { next(error); }
};

export const staffCancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.actor, req.body.reason);
    res.json(order);
  } catch (error) { next(error); }
};

export const customerCancelOrder = async (req, res, next) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.actor, 'Customer requested cancellation', true);
    res.json(order);
  } catch (error) { next(error); }
};
