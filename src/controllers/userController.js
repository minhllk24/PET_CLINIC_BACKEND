import userAPIService from '../services/userAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    let data = await userAPIService.getAllUsers(limit, page);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetDetailUser = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await userAPIService.getUserById(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateUser = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await userAPIService.updateUser(id, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteUser = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await userAPIService.deleteUser(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetUserAddresses = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await userAPIService.getUserAddresses(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateAddress = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await userAPIService.createAddress(id, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    let data = await userAPIService.updateAddress(addressId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteAddress = async (req, res) => {
  try {
    const addressId = req.params.addressId;
    let data = await userAPIService.deleteAddress(addressId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetDoctors = async (req, res) => {
  try {
    let data = await userAPIService.getDoctors();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetAllUsers,
  handleGetDetailUser,
  handleUpdateUser,
  handleDeleteUser,
  handleGetUserAddresses,
  handleCreateAddress,
  handleUpdateAddress,
  handleDeleteAddress,
  handleGetDoctors
};
