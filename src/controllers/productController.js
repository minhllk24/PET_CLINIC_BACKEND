import productAPIService from '../services/productAPIService';
import { sendResponse } from '../utils/responseHelpers';

// Categories
const handleGetAllCategories = async (req, res) => {
  try {
    let data = await productAPIService.getAllCategories();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateCategory = async (req, res) => {
  try {
    let data = await productAPIService.createCategory(req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateCategory = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await productAPIService.updateCategory(id, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteCategory = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await productAPIService.deleteCategory(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

// Products
const handleGetAllProducts = async (req, res) => {
  try {
    let data = await productAPIService.getAllProducts(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetDetailProduct = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await productAPIService.getDetailProduct(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateProduct = async (req, res) => {
  try {
    let data = await productAPIService.createProduct(req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdateProduct = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await productAPIService.updateProduct(id, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await productAPIService.deleteProduct(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetRelatedProducts = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await productAPIService.getRelatedProducts(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetReviewStats = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await productAPIService.getReviewStats(id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetAllCategories,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleGetAllProducts,
  handleGetDetailProduct,
  handleCreateProduct,
  handleUpdateProduct,
  handleDeleteProduct,
  handleGetRelatedProducts,
  handleGetReviewStats
};
