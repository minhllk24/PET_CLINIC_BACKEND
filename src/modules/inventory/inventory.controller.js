import * as inventoryService from './inventory.service';

const actorWithRequestContext = (req) => ({
  ...req.actor,
  idempotencyKey: req.headers['idempotency-key'] || null
});

export const receiveStock = async (req, res, next) => {
  try {
    res.status(201).json(await inventoryService.receiveStock(req.body, actorWithRequestContext(req)));
  } catch (error) {
    next(error);
  }
};

export const issueStock = async (req, res, next) => {
  try {
    res.status(201).json(await inventoryService.issueStock(req.body, actorWithRequestContext(req)));
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req, res, next) => {
  try {
    res.status(201).json(await inventoryService.adjustStock(req.body, actorWithRequestContext(req)));
  } catch (error) {
    next(error);
  }
};

export const transferStock = async (req, res, next) => {
  try {
    res.status(201).json(await inventoryService.createTransfer(req.body, actorWithRequestContext(req)));
  } catch (error) {
    next(error);
  }
};

export const getStocks = async (req, res, next) => {
  try {
    res.json(await inventoryService.listStocks(req.query, req.actor));
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    res.json(await inventoryService.listTransactions(req.query, req.actor));
  } catch (error) {
    next(error);
  }
};

export const getItems = async (req, res, next) => {
  try {
    res.json(await inventoryService.listInventoryItems(req.query, req.actor));
  } catch (error) {
    next(error);
  }
};

export const updateThreshold = async (req, res, next) => {
  try {
    const { branchId, inventoryItemId } = req.params;
    res.json(await inventoryService.updateThreshold(
      branchId,
      inventoryItemId,
      req.body,
      actorWithRequestContext(req)
    ));
  } catch (error) {
    next(error);
  }
};

export const getBranchInventorySummary = async (req, res, next) => {
  try {
    const { branchId } = req.params;
    res.json(await inventoryService.getBranchInventorySummary(branchId, req.actor));
  } catch (error) {
    next(error);
  }
};
