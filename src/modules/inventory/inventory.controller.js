import * as inventoryService from './inventory.service';

export const createTransaction = async (req, res, next) => {
  try {
    const result = await inventoryService.recordTransaction(req.body, req.actor);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getStocks = async (req, res, next) => {
  try {
    const { branchId, productId } = req.query;
    const query = {};
    if (branchId) query.branchId = branchId;
    if (productId) query.inventoryItemId = productId;
    
    const stocks = await inventoryService.getStocks(query);
    res.json(stocks);
  } catch (error) {
    next(error);
  }
};
