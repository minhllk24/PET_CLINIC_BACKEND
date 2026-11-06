import * as branchService from './branch.service';
import { sendSuccess, sendCreated } from '../../shared/responseHelpers';

export const listBranches = async (req, res, next) => {
  try {
    const { limit, cursor } = req.query;
    const result = await branchService.listBranches({
      limit,
      cursor,
      actor: req.actor,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const getBranchById = async (req, res, next) => {
  try {
    const branch = await branchService.getBranchById(req.params.id, req.actor);
    return sendSuccess(res, branch);
  } catch (error) {
    next(error);
  }
};

export const createBranch = async (req, res, next) => {
  try {
    const branch = await branchService.createBranch(req.body, req.actor);
    return sendCreated(res, branch);
  } catch (error) {
    next(error);
  }
};

export const updateBranch = async (req, res, next) => {
  try {
    const branch = await branchService.updateBranch(req.params.id, req.body, req.actor);
    return sendSuccess(res, branch);
  } catch (error) {
    next(error);
  }
};

export const deactivateBranch = async (req, res, next) => {
  try {
    const branch = await branchService.deactivateBranch(req.params.id, req.body?.reason, req.actor);
    return sendSuccess(res, branch);
  } catch (error) {
    next(error);
  }
};

export const activateBranch = async (req, res, next) => {
  try {
    const branch = await branchService.activateBranch(req.params.id, req.actor);
    return sendSuccess(res, branch);
  } catch (error) {
    next(error);
  }
};

// ================= SHIFT TEMPLATES (OPS-03) =================

export const listShiftTemplates = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.query.branchId;
    const result = await branchService.listShiftTemplates(branchId, req.query, req.actor);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const createShiftTemplate = async (req, res, next) => {
  try {
    const branchId = req.params.branchId || req.body.branchId;
    const result = await branchService.createShiftTemplate(branchId, req.body, req.actor);
    return sendCreated(res, result);
  } catch (error) {
    next(error);
  }
};

export const getShiftTemplateById = async (req, res, next) => {
  try {
    const result = await branchService.getShiftTemplateById(req.params.id, req.actor);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const updateShiftTemplate = async (req, res, next) => {
  try {
    const result = await branchService.updateShiftTemplate(req.params.id, req.body, req.actor);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const deleteShiftTemplate = async (req, res, next) => {
  try {
    const result = await branchService.deleteShiftTemplate(req.params.id, req.actor);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
