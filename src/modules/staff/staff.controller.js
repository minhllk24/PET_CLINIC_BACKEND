import * as staffService from './staff.service';

export const listStaff = async (req, res, next) => {
  try {
    const result = await staffService.listStaff(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getStaffById = async (req, res, next) => {
  try {
    const result = await staffService.getStaffById(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createStaff = async (req, res, next) => {
  try {
    const result = await staffService.createStaff(req.body, req.actor);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const result = await staffService.updateStaff(req.params.id, req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const updateStaffBranches = async (req, res, next) => {
  try {
    const result = await staffService.updateStaffBranches(req.params.id, req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const resetStaffPassword = async (req, res, next) => {
  try {
    const result = await staffService.resetStaffPassword(req.params.id, req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
