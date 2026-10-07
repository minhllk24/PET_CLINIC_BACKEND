import * as executionService from './execution.service';

export const createRecord = async (req, res, next) => {
  try {
    const record = await executionService.createRecord(req.body, req.actor);
    res.status(201).json(record);
  } catch (error) { next(error); }
};

export const submitReview = async (req, res, next) => {
  try {
    const record = await executionService.submitReview(req.params.id, req.body, req.actor);
    res.json(record);
  } catch (error) { next(error); }
};

export const finalizeRecord = async (req, res, next) => {
  try {
    const record = await executionService.finalizeRecord(req.params.id, req.body, req.actor);
    res.json(record);
  } catch (error) { next(error); }
};
