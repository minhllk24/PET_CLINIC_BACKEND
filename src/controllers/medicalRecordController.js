import medicalRecordAPIService from '../services/medicalRecordAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetRecordsByPet = async (req, res) => {
  try {
    const petId = req.params.petId;
    let data = await medicalRecordAPIService.getRecordsByPet(petId, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetDetailRecord = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await medicalRecordAPIService.getRecordById(id, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateRecord = async (req, res) => {
  try {
    let data = await medicalRecordAPIService.createRecord(req.body, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateRecord = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await medicalRecordAPIService.updateRecord(id, req.body, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteRecord = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await medicalRecordAPIService.deleteRecord(id, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetRecordsByPet,
  handleGetDetailRecord,
  handleCreateRecord,
  handleUpdateRecord,
  handleDeleteRecord
};
