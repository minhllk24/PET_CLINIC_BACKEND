import * as flashSaleService from './flashSale.service';

export const listFlashSales = async (req, res, next) => {
  try {
    const result = await flashSaleService.listFlashSales(req.query, req.actor);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getFlashSaleById = async (req, res, next) => {
  try {
    const result = await flashSaleService.getFlashSaleById(req.params.id, req.actor);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createFlashSale = async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      idempotencyKey: req.headers['idempotency-key'] || req.body?.idempotencyKey,
    };
    const result = await flashSaleService.createFlashSale(payload, req.actor);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateFlashSale = async (req, res, next) => {
  try {
    const ifMatch = req.headers['if-match'];
    let parsedVersion = req.body?.expectedVersion ?? req.body?.version;
    if (ifMatch) {
      const cleaned = ifMatch.replace(/["\s]/g, '');
      const parsed = parseInt(cleaned, 10);
      if (!isNaN(parsed)) parsedVersion = parsed;
    }

    const payload = {
      ...req.body,
      expectedVersion: parsedVersion,
    };
    const result = await flashSaleService.updateFlashSale(req.params.id, payload, req.actor);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const publishFlashSale = async (req, res, next) => {
  try {
    const result = await flashSaleService.publishFlashSale(req.params.id, req.actor);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const togglePauseFlashSale = async (req, res, next) => {
  try {
    const isPaused = req.body?.isPaused;
    const result = await flashSaleService.togglePauseFlashSale(req.params.id, isPaused, req.actor);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getActiveFlashSale = async (req, res, next) => {
  try {
    const result = await flashSaleService.getActiveFlashSale();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

