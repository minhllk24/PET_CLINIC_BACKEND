import loyaltyAPIService from '../services/loyaltyAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetVouchers = async (req, res) => {
  try {
    let data = await loyaltyAPIService.getAllVouchers();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateVoucher = async (req, res) => {
  try {
    let data = await loyaltyAPIService.createVoucher(req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleApplyVoucher = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await loyaltyAPIService.applyVoucher(userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetMyPoints = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await loyaltyAPIService.getMyPoints(userId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetMyTransactions = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await loyaltyAPIService.getMyTransactions(userId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetVouchers,
  handleCreateVoucher,
  handleApplyVoucher,
  handleGetMyPoints,
  handleGetMyTransactions
};
