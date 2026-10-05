import paymentAPIService from '../services/paymentAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetPayments = async (req, res) => {
  try {
    let data = await paymentAPIService.getAllPayments(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdatePaymentStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    let data = await paymentAPIService.updatePaymentStatus(id, status);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetPayments,
  handleUpdatePaymentStatus
};
