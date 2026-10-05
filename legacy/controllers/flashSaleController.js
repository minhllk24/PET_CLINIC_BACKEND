import flashSaleAPIService from '../services/flashSaleAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetActiveFlashSale = async (req, res) => {
  try {
    let data = await flashSaleAPIService.getActiveFlashSale();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateFlashSale = async (req, res) => {
  try {
    let data = await flashSaleAPIService.createFlashSale(req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateFlashSale = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await flashSaleAPIService.updateFlashSale(id, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteFlashSale = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await flashSaleAPIService.deleteFlashSale(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetActiveFlashSale,
  handleCreateFlashSale,
  handleUpdateFlashSale,
  handleDeleteFlashSale
};
