import * as returnService from './return.service';

export const createReturn = async (req, res, next) => {
  try {
    const ret = await returnService.createReturn(req.body, req.actor, req.headers['x-guest-lookup-token']);
    res.status(201).json(returnService.formatOrderReturn(ret));
  } catch (error) {
    next(error);
  }
};

export const listReturns = async (req, res, next) => {
  try {
    const result = await returnService.listReturns(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getReturn = async (req, res, next) => {
  try {
    const ret = await returnService.getReturnById(req.params.id, req.actor);
    res.json(returnService.formatOrderReturn(ret));
  } catch (error) {
    next(error);
  }
};

export const processReturn = async (req, res, next) => {
  try {
    const ret = await returnService.processReturn(req.params.id, req.actor);
    res.json(returnService.formatOrderReturn(ret));
  } catch (error) {
    next(error);
  }
};

export const receiveReturn = async (req, res, next) => {
  try {
    const ret = await returnService.receiveReturn(req.params.id, req.actor);
    res.json(returnService.formatOrderReturn(ret));
  } catch (error) {
    next(error);
  }
};

export const approveReturn = async (req, res, next) => {
  try {
    const ret = await returnService.approveReturn(req.params.id, req.body, req.actor);
    res.json(returnService.formatOrderReturn(ret));
  } catch (error) {
    next(error);
  }
};

export const rejectReturn = async (req, res, next) => {
  try {
    const ret = await returnService.rejectReturn(req.params.id, req.body, req.actor);
    res.json(returnService.formatOrderReturn(ret));
  } catch (error) {
    next(error);
  }
};

export const cancelReturn = async (req, res, next) => {
  try {
    const ret = await returnService.cancelReturn(req.params.id, req.actor);
    res.json(returnService.formatOrderReturn(ret));
  } catch (error) {
    next(error);
  }
};

export const getOrderRefund = async (req, res, next) => {
  try {
    const refund = await returnService.getOrderRefundById(req.params.id, req.actor);
    res.json(returnService.formatOrderRefund(refund));
  } catch (error) {
    next(error);
  }
};

export const processOrderRefund = async (req, res, next) => {
  try {
    const refund = await returnService.processOrderRefund(req.params.id, req.actor);
    res.json(returnService.formatOrderRefund(refund));
  } catch (error) {
    next(error);
  }
};
