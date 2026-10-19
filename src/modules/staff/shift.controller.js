import * as shiftService from './shift.service';
import { sendSuccess, sendCreated } from '../../shared/responseHelpers';

export const listShifts = async (req, res, next) => {
  try {
    const { staffId, branchId, dateFrom, dateTo, status, limit, cursor } = req.query;
    const result = await shiftService.listShifts({
      staffId,
      branchId,
      dateFrom,
      dateTo,
      status,
      limit,
      cursor,
      actor: req.actor,
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const createShift = async (req, res, next) => {
  try {
    const result = await shiftService.createShift(req.body, req.actor);
    return sendCreated(res, result);
  } catch (error) {
    next(error);
  }
};

export const updateShift = async (req, res, next) => {
  try {
    const result = await shiftService.updateShift(req.params.id, req.body, req.actor);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

export const cancelShift = async (req, res, next) => {
  try {
    const result = await shiftService.cancelShift(req.params.id, req.actor);
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};
