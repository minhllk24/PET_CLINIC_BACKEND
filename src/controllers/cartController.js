import cartAPIService from '../services/cartAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetCart = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await cartAPIService.getCartByUserId(userId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleAddToCart = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await cartAPIService.addToCart(userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateCartItem = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const itemId = req.params.item_id;
    let data = await cartAPIService.updateCartItem(userId, itemId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteCartItem = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const itemId = req.params.item_id;
    let data = await cartAPIService.deleteCartItem(userId, itemId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetCart,
  handleAddToCart,
  handleUpdateCartItem,
  handleDeleteCartItem
};
