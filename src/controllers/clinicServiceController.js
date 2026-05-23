import clinicServiceAPIService from '../services/clinicServiceAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetAllCategories = async (req, res) => {
  try {
    let data = await clinicServiceAPIService.getAllCategories();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetAllServices = async (req, res) => {
  try {
    let data = await clinicServiceAPIService.getAllServices(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetServiceById = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await clinicServiceAPIService.getServiceById(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateService = async (req, res) => {
  try {
    let data = await clinicServiceAPIService.createService(req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateService = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await clinicServiceAPIService.updateService(id, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteService = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await clinicServiceAPIService.deleteService(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetAllCategories,
  handleGetAllServices,
  handleGetServiceById,
  handleCreateService,
  handleUpdateService,
  handleDeleteService
};
