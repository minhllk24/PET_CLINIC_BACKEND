import * as branchServiceConfigService from './branchServiceConfig.service';
import { sendSuccess } from '../../shared/responseHelpers';

export const listBranchServiceConfigs = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { enabled, serviceType, limit, cursor } = req.query;

    const result = await branchServiceConfigService.listBranchServiceConfigs({
      branchId,
      enabled,
      serviceType,
      limit,
      cursor,
      actor: req.actor,
    });

    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const upsertBranchServiceConfig = async (req, res, next) => {
  try {
    const { branchId, serviceId } = req.params;

    const config = await branchServiceConfigService.upsertBranchServiceConfig({
      branchId,
      serviceId,
      data: req.body,
      actor: req.actor,
    });

    return sendSuccess(res, config);
  } catch (error) {
    next(error);
  }
};

export const listBlockedWindows = async (req, res, next) => {
  try {
    const { branchId, serviceId } = req.params;
    const result = await branchServiceConfigService.listBlockedWindows(branchId, serviceId, req.query, req.actor);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const createBlockedWindow = async (req, res, next) => {
  try {
    const { branchId, serviceId } = req.params;
    const result = await branchServiceConfigService.createBlockedWindow(branchId, serviceId, req.body, req.actor);
    return sendSuccess(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const deleteBlockedWindow = async (req, res, next) => {
  try {
    const { branchId, serviceId, blockId } = req.params;
    const result = await branchServiceConfigService.deleteBlockedWindow(branchId, serviceId, blockId, req.actor);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
