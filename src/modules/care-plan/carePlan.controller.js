import * as carePlanService from './carePlan.service';
import { sendSuccess } from '../../shared/responseHelpers';

export const getCarePlan = async (req, res, next) => {
  try {
    const plan = await carePlanService.getCarePlan(req.params.petId, req.actor);
    return sendSuccess(res, plan);
  } catch (error) {
    next(error);
  }
};

export const updateTaskState = async (req, res, next) => {
  try {
    const updated = await carePlanService.updateTaskState(
      req.params.petId,
      req.params.taskKey,
      req.body,
      req.actor
    );
    return sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
};

export const sendCarePlanReminder = async (req, res, next) => {
  try {
    const result = await carePlanService.sendCarePlanReminder(
      req.params.petId,
      req.body,
      req.actor
    );
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

