import healthDiaryAPIService from '../services/healthDiaryAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetDiaries = async (req, res) => {
  try {
    const petId = req.params.petId;
    let data = await healthDiaryAPIService.getDiariesByPet(petId, req.query, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateDiary = async (req, res) => {
  try {
    let data = await healthDiaryAPIService.createDiary(req.body, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetReminders = async (req, res) => {
  try {
    const petId = req.params.petId;
    let data = await healthDiaryAPIService.getRemindersByPet(petId, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateReminder = async (req, res) => {
  try {
    let data = await healthDiaryAPIService.createReminder(req.body, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCompleteReminder = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await healthDiaryAPIService.completeReminder(id, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteReminder = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await healthDiaryAPIService.deleteReminder(id, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetDiaries,
  handleCreateDiary,
  handleGetReminders,
  handleCreateReminder,
  handleCompleteReminder,
  handleDeleteReminder
};
