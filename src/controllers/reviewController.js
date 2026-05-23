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

module.exports = {
  handleGetReviews,
  handleCreateReview,
  handleRejectReview,
  handleDeleteReview
};
