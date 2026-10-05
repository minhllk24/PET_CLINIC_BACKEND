import notificationAPIService from '../services/notificationAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id; // Từ JWT token qua verifyToken
    const { status, search } = req.query;
    
    let data = await notificationAPIService.getNotifications(userId, status, search);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -1);
  }
};

const handleMarkAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const notificationId = req.params.id;

    let data = await notificationAPIService.markAsRead(notificationId, userId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -1);
  }
};

const handleMarkAllAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;

    let data = await notificationAPIService.markAllAsRead(userId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -1);
  }
};

module.exports = {
  handleGetNotifications,
  handleMarkAsRead,
  handleMarkAllAsRead
};
