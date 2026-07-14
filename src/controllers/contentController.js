import contentAPIService from '../services/contentAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetPosts = async (req, res) => {
  try {
    let data = await contentAPIService.getPosts(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetPostBySlug = async (req, res) => {
  try {
    let data = await contentAPIService.getPostBySlug(req.params.slug);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreatePost = async (req, res) => {
  try {
    let data = await contentAPIService.createPost(req.user, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetFirstAidGuides = async (req, res) => {
  try {
    let data = await contentAPIService.getFirstAidGuides(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetFirstAidGuideBySlug = async (req, res) => {
  try {
    let data = await contentAPIService.getFirstAidGuideBySlug(req.params.slug);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetFirstAidCategories = async (req, res) => {
  try {
    let data = await contentAPIService.getFirstAidCategories();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateFirstAidGuide = async (req, res) => {
  try {
    let data = await contentAPIService.createFirstAidGuide(req.user, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetAiChatSessions = async (req, res) => {
  try {
    let data = await contentAPIService.getAiChatSessions(req.user.user_id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreateAiChatSession = async (req, res) => {
  try {
    let data = await contentAPIService.createAiChatSession(req.user.user_id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetPostCategories = async (req, res) => {
  try {
    let data = await contentAPIService.getPostCategories();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetFeaturedPost = async (req, res) => {
  try {
    let data = await contentAPIService.getFeaturedPost();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetTrendingPosts = async (req, res) => {
  try {
    let data = await contentAPIService.getTrendingPosts(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetPostComments = async (req, res) => {
  try {
    let data = await contentAPIService.getPostComments(req.params.id, req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreatePostComment = async (req, res) => {
  try {
    let data = await contentAPIService.createPostComment(req.user, req.params.id, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleReplyPostComment = async (req, res) => {
  try {
    let data = await contentAPIService.replyPostComment(req.user, req.params.commentId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeletePostComment = async (req, res) => {
  try {
    let data = await contentAPIService.deletePostComment(req.user, req.params.commentId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleTogglePostLike = async (req, res) => {
  try {
    let data = await contentAPIService.togglePostLike(req.user, req.params.id);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetPosts,
  handleGetPostBySlug,
  handleCreatePost,
  handleGetFeaturedPost,
  handleGetTrendingPosts,
  handleGetPostCategories,
  handleGetFirstAidGuides,
  handleGetFirstAidGuideBySlug,
  handleGetFirstAidCategories,
  handleCreateFirstAidGuide,
  handleGetAiChatSessions,
  handleCreateAiChatSession,
  handleGetPostComments,
  handleCreatePostComment,
  handleReplyPostComment,
  handleDeletePostComment,
  handleTogglePostLike
};
