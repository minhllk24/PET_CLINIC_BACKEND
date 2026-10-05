import rescueAPIService from '../services/rescueAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetStations = async (req, res) => {
  try {
    let data = await rescueAPIService.getStations();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetRescuePosts = async (req, res) => {
  try {
    let data = await rescueAPIService.getRescuePosts();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetAdoptionPets = async (req, res) => {
  try {
    let data = await rescueAPIService.getAdoptionPets();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateAdoptionRequest = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await rescueAPIService.createAdoptionRequest(userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetMyRequests = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await rescueAPIService.getMyAdoptionRequests(userId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;
    let data = await rescueAPIService.updateAdoptionRequestStatus(id, status);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetStations,
  handleGetRescuePosts,
  handleGetAdoptionPets,
  handleCreateAdoptionRequest,
  handleGetMyRequests,
  handleUpdateStatus
};
