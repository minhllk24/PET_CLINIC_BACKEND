import contactAPIService from '../services/contactAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleCreateContactMessage = async (req, res) => {
  try {
    let data = await contactAPIService.createContactMessage(req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetContactMessages = async (req, res) => {
  try {
    let data = await contactAPIService.getContactMessages();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleCreateContactMessage,
  handleGetContactMessages
};
