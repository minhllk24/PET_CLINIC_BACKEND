import reviewAPIService from '../services/reviewAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetReviews = async (req, res) => {
  try {
    const { targetType, targetId } = req.params;
    let data = await reviewAPIService.getReviewsByTarget(targetType, targetId, req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateReview = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await reviewAPIService.createReview(userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleRejectReview = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await reviewAPIService.updateReviewStatus(id, 'rejected');
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeleteReview = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await reviewAPIService.updateReviewStatus(id, 'deleted');
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetAllReviews = async (req, res) => {
  try {
    let data = await reviewAPIService.getAllReviews(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleLikeReview = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const reviewId = req.params.id;
    let data = await reviewAPIService.likeReview(userId, reviewId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleReplyReview = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const parentId = req.params.id;
    let data = await reviewAPIService.replyReview(userId, parentId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCheckCanReview = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { targetType, targetId } = req.params;
    let data = await reviewAPIService.checkCanReview(userId, targetType, targetId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetReviews,
  handleGetAllReviews,
  handleCreateReview,
  handleRejectReview,
  handleDeleteReview,
  handleLikeReview,
  handleReplyReview,
  handleCheckCanReview
};
