import * as executionService from './execution.service';

export const createRecord = async (req, res, next) => {
  try {
    const record = await executionService.createRecord(req.body, req.actor);
    res.status(201).json(record);
  } catch (error) { next(error); }
};

export const listRecords = async (req, res, next) => {
  try {
    const result = await executionService.listRecords(req.query, req.actor);
    res.json(result);
  } catch (error) { next(error); }
};

export const getRecordById = async (req, res, next) => {
  try {
    const record = await executionService.getRecordById(req.params.id, req.actor);
    res.json(record);
  } catch (error) { next(error); }
};

export const updateMaterials = async (req, res, next) => {
  try {
    const record = await executionService.updateMaterials(req.params.id, req.body, req.actor);
    res.json(record);
  } catch (error) { next(error); }
};

export const updateProfessional = async (req, res, next) => {
  try {
    const record = await executionService.updateProfessional(req.params.id, req.body, req.actor);
    res.json(record);
  } catch (error) { next(error); }
};

export const reopenRecord = async (req, res, next) => {
  try {
    const record = await executionService.reopenRecord(req.params.id, req.body, req.actor);
    res.json(record);
  } catch (error) { next(error); }
};

export const getRevisions = async (req, res, next) => {
  try {
    const revisions = await executionService.getRevisions(req.params.id, req.actor);
    res.json(revisions);
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
