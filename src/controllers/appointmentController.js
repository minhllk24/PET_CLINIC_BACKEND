import appointmentAPIService from '../services/appointmentAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetMyHistory = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await appointmentAPIService.getMyHistory(userId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetDetailAppointment = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await appointmentAPIService.getAppointmentById(id, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetSlots = async (req, res) => {
  try {
    let data = await appointmentAPIService.getAvailableSlots(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateAppointment = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await appointmentAPIService.createAppointment(userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCancelAppointment = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await appointmentAPIService.updateAppointmentStatus(id, 'cancelled', req.user, 'Cancelled via API');
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const { status, note } = req.body;
    let data = await appointmentAPIService.updateAppointmentStatus(id, status, req.user, note);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetPricing = async (req, res) => {
  try {
    const id = req.params.id;
    const voucher_code = req.query.voucher_code || null;
    let data = await appointmentAPIService.getAppointmentPricing(id, req.user, voucher_code);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCheckout = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.user_id;
    let data = await appointmentAPIService.checkoutAppointment(id, userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handlePreviewPricing = async (req, res) => {
  try {
    let data = await appointmentAPIService.previewPricing(req.body, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleBookAndCheckout = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await appointmentAPIService.bookAndCheckoutAppointment(userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetMyHistory,
  handleGetDetailAppointment,
  handleGetSlots,
  handleCreateAppointment,
  handleCancelAppointment,
  handleUpdateStatus,
  handleGetPricing,
  handleCheckout,
  handlePreviewPricing,
  handleBookAndCheckout
};
