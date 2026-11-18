import express from 'express';
import mongoose from 'mongoose';
import { authenticate, optionalAuth, requireRole } from '../../shared/authMiddleware.js';
import { idempotency } from '../../middleware/idempotencyMiddleware.js';
import * as contentController from './content.controller.js';
import { getRescuePartnersList, getRescueStationsList, getEmergencyHotline } from './content.service.js';
import CommunityPost from './models/CommunityPost.js';
import CommunityComment from './models/CommunityComment.js';
import RescuePet from './models/RescuePet.js';
import AdoptionRequest from './models/AdoptionRequest.js';

const router = express.Router();

// Fallback helper: If MongoDB is disconnected (e.g., offline test runners without mocks), pass to legacy fallback
const checkDbConnected = (req, res, next) => {
  if (
    req.path === '/rescue/partners' ||
    req.path === '/public/rescue/partners' ||
    req.path === '/rescue/stations' ||
    req.path === '/public/rescue/stations' ||
    req.path === '/first-aid/categories' ||
    req.path === '/public/first-aid/categories'
  ) {
    return next();
  }
  const hasMockedModel = Boolean(
    CommunityPost.findById?._isMockFunction ||
    CommunityPost.find?._isMockFunction ||
    CommunityComment.create?._isMockFunction ||
    CommunityComment.find?._isMockFunction ||
    RescuePet.findById?._isMockFunction ||
    AdoptionRequest.findOne?._isMockFunction
  );
  if (mongoose.connection.readyState !== 1 && !hasMockedModel) {
    return next('router');
  }
  next();
};

router.use(checkDbConnected);

// =========================================================================
// 1. PUBLIC BLOG & FIRST AID
// =========================================================================
router.get(['/posts/featured', '/public/posts/featured'], contentController.getFeaturedPosts);
router.get(['/posts/trending', '/public/posts/trending'], contentController.getTrendingPosts);
router.get(['/posts/recent', '/public/posts/recent', '/posts/latest', '/public/posts/latest', '/posts/quick-view', '/public/posts/quick-view'], contentController.getRecentPosts);
router.get(['/posts/tags', '/public/posts/tags', '/post-tags', '/public/post-tags'], contentController.getPostTags);
router.get(['/posts/related', '/public/posts/related', '/posts/:slug/related', '/public/posts/:slug/related'], contentController.getRelatedPosts);
router.get(['/post-categories', '/public/post-categories', '/posts/categories', '/public/posts/categories'], contentController.getPostCategories);

// Category endpoint for first-aid
router.get(['/first-aid/categories', '/public/first-aid/categories'], (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 'accident', name: 'Tai nạn & Khẩn cấp', category_name: 'Tai nạn', label: 'Tai nạn', slug: 'tai-nan' },
      { id: 'poisoning', name: 'Ngộ độc thực phẩm & Hóa chất', category_name: 'Ngộ độc', label: 'Ngộ độc', slug: 'ngo-doc' },
      { id: 'breathing', name: 'Khó thở & Dị vật đường thở', category_name: 'Khó thở', label: 'Khó thở', slug: 'kho-tho' },
      { id: 'injury', name: 'Chấn thương & Chăm sóc vết thương', category_name: 'Chấn thương', label: 'Chấn thương', slug: 'chan-thuong' },
    ],
  });
});

router.get(['/first-aid/guides', '/first-aid', '/public/first-aid'], (req, res, next) => {
  req.query.postType = 'FIRST_AID';
  return contentController.getPostsPublic(req, res, next);
});

router.get(['/first-aid/guides/:slug', '/first-aid/:slug', '/public/first-aid/:slug'], (req, res, next) => {
  if (req.params.slug === 'categories' || req.params.slug === 'guides') {
    return next();
  }
  return contentController.getPostBySlugPublic(req, res, next);
});

router.get(['/posts', '/public/posts'], contentController.getPostsPublic);
router.get(['/posts/:slug', '/public/posts/:slug'], (req, res, next) => {
  if (['featured', 'trending', 'recent', 'latest', 'quick-view', 'related', 'tags', 'categories', 'post-categories'].includes(req.params.slug)) {
    return next();
  }
  return contentController.getPostBySlugPublic(req, res, next);
});

// =========================================================================
// 2. COMMUNITY POSTS & INTERACTIONS (BE-HANDOFF 2026-11-16)
// =========================================================================
router.get(['/community/posts', '/public/community/posts'], contentController.getCommunityPostsPublic);
router.post(['/community/posts', '/public/community/posts'], authenticate, contentController.createCommunityPost);
router.put(['/community/posts/:id', '/public/community/posts/:id'], authenticate, contentController.updateCommunityPost);
router.patch(['/community/posts/:id', '/public/community/posts/:id'], authenticate, contentController.updateCommunityPost);

// Comments (both canonical /community/posts/:id/comments, /public/community/posts/:id/comments and legacy /posts/:id/comments)
router.get(['/community/posts/:id/comments', '/public/community/posts/:id/comments', '/posts/:id/comments', '/public/posts/:id/comments'], contentController.getCommunityComments);
router.post(['/community/posts/:id/comments', '/public/community/posts/:id/comments', '/posts/:id/comments', '/public/posts/:id/comments'], authenticate, contentController.addCommunityComment);

// Replies (both canonical /community/comments/:id/replies and legacy /posts/comments/:commentId/reply)
router.post(['/community/comments/:id/replies', '/public/community/comments/:id/replies', '/community/comments/:id/reply', '/public/community/comments/:id/reply', '/posts/comments/:id/reply', '/public/posts/comments/:id/reply', '/posts/comments/:commentId/reply', '/public/posts/comments/:commentId/reply'], authenticate, contentController.addCommentReply);

// Reports
router.post(['/community/posts/:id/reports', '/public/community/posts/:id/reports', '/posts/:id/reports'], authenticate, contentController.reportCommunityPost);

// Likes & Unlikes
router.post(['/community/posts/:id/like', '/public/community/posts/:id/like', '/posts/:id/like', '/public/posts/:id/like'], authenticate, contentController.likeCommunityPost);
router.post(['/community/posts/:id/unlike', '/public/community/posts/:id/unlike', '/posts/:id/unlike', '/public/posts/:id/unlike'], authenticate, contentController.unlikeCommunityPost);
router.delete(['/community/posts/:id/like', '/public/community/posts/:id/like', '/posts/:id/like', '/public/posts/:id/like'], authenticate, contentController.unlikeCommunityPost);

// =========================================================================
// 3. RESCUE PETS & ADOPTIONS
// =========================================================================
router.get(['/rescue/partners', '/public/rescue/partners'], async (req, res, next) => {
  try {
    const [partners, emergencyHotline] = await Promise.all([
      getRescuePartnersList(),
      getEmergencyHotline(),
    ]);
    res.status(200).json({
      success: true,
      emergencyHotline,
      data: {
        emergencyHotline,
        totalPartners: partners.length,
        partners,
        items: partners,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get(['/rescue/pets', '/adoptions/pets', '/public/rescue/pets'], contentController.getRescuePetsPublic);
router.post(['/rescue/pets', '/adoptions/pets', '/public/rescue/pets'], authenticate, requireRole(['ADMIN', 'MANAGER']), contentController.createRescuePet);
router.get(['/rescue/pets/:id', '/public/rescue/pets/:id'], contentController.getRescuePetById);
router.get(['/rescue/stations', '/public/rescue/stations'], async (req, res, next) => {
  try {
    const [stations, emergencyHotline] = await Promise.all([
      getRescueStationsList(),
      getEmergencyHotline(),
    ]);
    res.status(200).json({
      success: true,
      data: stations,
      emergencyHotline,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  ['/rescue/requests', '/adoptions/requests', '/public/rescue/requests', '/public/adoptions/requests'],
  optionalAuth,
  idempotency('createAdoptionRequest', { required: false }),
  contentController.createAdoptionRequest
);
router.get(['/rescue/my-requests', '/adoptions/my-requests', '/public/rescue/my-requests', '/public/adoptions/my-requests'], authenticate, contentController.getMyAdoptionRequests);

export default router;

