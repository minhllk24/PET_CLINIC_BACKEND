import orderAPIService from '../services/orderAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetOrders = async (req, res) => {
  try {
    let data = await orderAPIService.getOrders(req.user, req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetDetailOrder = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await orderAPIService.getOrderById(id, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCheckout = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await orderAPIService.checkoutCart(userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateOrderStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    let data = await orderAPIService.updateOrderStatus(id, status);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetOrders,
  handleGetDetailOrder,
  handleCheckout,
  handleUpdateOrderStatus
};
