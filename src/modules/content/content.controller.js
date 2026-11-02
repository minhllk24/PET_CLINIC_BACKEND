import { contentService } from './content.service.js';

// =========================================================================
// 1. POSTS (BLOG & FIRST AID) CONTROLLERS
// =========================================================================

export const createPost = async (req, res, next) => {
  try {
    const post = await contentService.createPost(req.body, req.actor?.id);
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

export const getPostsAdmin = async (req, res, next) => {
  try {
    const data = await contentService.getPostsAdmin(req.query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getPostById = async (req, res, next) => {
  try {
    const post = await contentService.getPostById(req.params.id);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

export const updatePost = async (req, res, next) => {
  try {
    const post = await contentService.updatePost(req.params.id, req.body);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

export const updatePostStatus = async (req, res, next) => {
  try {
    const post = await contentService.updatePostStatus(req.params.id, req.body.status);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

export const deletePost = async (req, res, next) => {
  try {
    const result = await contentService.deletePost(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getPostsPublic = async (req, res, next) => {
  try {
    const data = await contentService.getPostsPublic(req.query);
    if ((!data || !data.items || data.items.length === 0) && req.query.postType === 'FIRST_AID') {
      return next();
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (req.query.postType === 'FIRST_AID') {
      return next();
    }
    next(err);
  }
};

export const getPostBySlugPublic = async (req, res, next) => {
  try {
    const post = await contentService.getPostBySlugPublic(req.params.slug);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

export const getFeaturedPosts = async (req, res, next) => {
  try {
    const data = await contentService.getFeaturedPosts();
    if (!data || data.length === 0) {
      return next();
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    next();
  }
};

export const getTrendingPosts = async (req, res, next) => {
  try {
    const data = await contentService.getTrendingPosts();
    if (!data || data.length === 0) {
      return next();
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    next();
  }
};

export const getPostCategories = async (req, res, next) => {
  try {
    const data = await contentService.getPostCategories();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// =========================================================================
// 2. COMMUNITY POSTS CONTROLLERS
// =========================================================================

export const createCommunityPost = async (req, res, next) => {
  try {
    const post = await contentService.createCommunityPost(req.body, req.actor);
    res.status(201).json({ success: true, data: post, message: 'Đăng bài thành công, bài viết đang chờ quản trị viên phê duyệt.' });
  } catch (err) {
    next(err);
  }
};

export const getCommunityPostsAdmin = async (req, res, next) => {
  try {
    const data = await contentService.getCommunityPostsAdmin(req.query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const moderateCommunityPost = async (req, res, next) => {
  try {
    const post = await contentService.moderateCommunityPost(req.params.id, req.body, req.actor?.id);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
};

export const deleteCommunityPost = async (req, res, next) => {
  try {
    const result = await contentService.deleteCommunityPost(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getCommunityPostsPublic = async (req, res, next) => {
  try {
    const data = await contentService.getCommunityPostsPublic(req.query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// =========================================================================
// 3. RESCUE PETS CONTROLLERS
// =========================================================================

export const createRescuePet = async (req, res, next) => {
  try {
    const pet = await contentService.createRescuePet(req.body);
    res.status(201).json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
};

export const getRescuePetsAdmin = async (req, res, next) => {
  try {
    const data = await contentService.getRescuePetsAdmin(req.query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getRescuePetById = async (req, res, next) => {
  try {
    const pet = await contentService.getRescuePetById(req.params.id);
    res.status(200).json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
};

export const updateRescuePet = async (req, res, next) => {
  try {
    const pet = await contentService.updateRescuePet(req.params.id, req.body);
    res.status(200).json({ success: true, data: pet });
  } catch (err) {
    next(err);
  }
};

export const deleteRescuePet = async (req, res, next) => {
  try {
    const result = await contentService.deleteRescuePet(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const getRescuePetsPublic = async (req, res, next) => {
  try {
    const data = await contentService.getRescuePetsPublic(req.query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// =========================================================================
// 4. ADOPTION REQUESTS CONTROLLERS
// =========================================================================

export const createAdoptionRequest = async (req, res, next) => {
  try {
    const request = await contentService.createAdoptionRequest(req.body, req.actor);
    res.status(201).json({
      success: true,
      data: request,
      message: 'Gửi đơn đăng ký nhận nuôi thành công. Phụ trách trạm cứu hộ sẽ liên hệ sớm nhất!',
    });
  } catch (err) {
    next(err);
  }
};

export const getAdoptionRequestsAdmin = async (req, res, next) => {
  try {
    const data = await contentService.getAdoptionRequestsAdmin(req.query);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const reviewAdoptionRequest = async (req, res, next) => {
  try {
    const request = await contentService.reviewAdoptionRequest(req.params.id, req.body, req.actor?.id);
    res.status(200).json({ success: true, data: request });
  } catch (err) {
    next(err);
  }
};

export const getMyAdoptionRequests = async (req, res, next) => {
  try {
    const requests = await contentService.getMyAdoptionRequests(req.actor);
    res.status(200).json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};
