import * as identityService from './identity.service';
import { successResponse } from '../../shared/responseHelpers';

export const login = async (req, res, next) => {
  try {
    const tokens = await identityService.login(req.body);
    res.json(tokens);
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const tokens = await identityService.refresh(req.body);
    res.json(tokens);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    await identityService.logout(req.actor.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const register = async (req, res, next) => {
  try {
    const tokens = await identityService.register(req.body);
    res.status(201).json(tokens);
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    await identityService.forgotPassword(req.body);
    res.status(202).send();
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    await identityService.resetPassword(req.body);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req, res, next) => {
  try {
    await identityService.resendOtp(req.body);
    res.status(202).send();
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const me = await identityService.getMe(req.actor.id);
    res.json(me);
  } catch (error) {
    next(error);
  }
};
