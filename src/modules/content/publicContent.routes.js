import express from 'express';
import mongoose from 'mongoose';
import { authenticate, optionalAuth } from '../../shared/authMiddleware.js';
import * as contentController from './content.controller.js';
import { getRescuePartnersList, getRescueStationsList, getEmergencyHotline } from './content.service.js';

const router = express.Router();

// Fallback helper: If MongoDB is disconnected (e.g., offline test runners), pass directly to legacy fallback
const checkDbConnected = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return next();
  }
  next();
};

router.use(checkDbConnected);

// =========================================================================
// 1. PUBLIC BLOG & FIRST AID
// =========================================================================
router.get(['/posts/featured', '/public/posts/featured'], contentController.getFeaturedPosts);
router.get(['/posts/trending', '/public/posts/trending'], contentController.getTrendingPosts);
router.get(['/post-categories', '/public/post-categories'], contentController.getPostCategories);

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
  if (['featured', 'trending', 'categories', 'post-categories'].includes(req.params.slug)) {
    return next();
  }
  return contentController.getPostBySlugPublic(req, res, next);
});

// =========================================================================
// 2. COMMUNITY POSTS & INTERACTIONS (BE-HANDOFF 2026-11-16)
// =========================================================================
router.get(['/community/posts', '/public/community/posts'], contentController.getCommunityPostsPublic);
router.post(['/community/posts', '/public/community/posts'], authenticate, contentController.createCommunityPost);

// Comments (both canonical /community/posts/:id/comments and legacy /posts/:id/comments)
router.get(['/community/posts/:id/comments', '/posts/:id/comments', '/public/posts/:id/comments'], contentController.getCommunityComments);
router.post(['/community/posts/:id/comments', '/posts/:id/comments', '/public/posts/:id/comments'], authenticate, contentController.addCommunityComment);

// Replies (both canonical /community/comments/:id/replies and legacy /posts/comments/:commentId/reply)
router.post(['/community/comments/:id/replies', '/community/comments/:id/reply', '/posts/comments/:id/reply', '/public/posts/comments/:id/reply', '/posts/comments/:commentId/reply', '/public/posts/comments/:commentId/reply'], authenticate, contentController.addCommentReply);

// Reports
router.post(['/community/posts/:id/reports', '/posts/:id/reports'], authenticate, contentController.reportCommunityPost);

// Likes & Unlikes
router.post(['/community/posts/:id/like', '/posts/:id/like', '/public/posts/:id/like'], authenticate, contentController.likeCommunityPost);
router.post(['/community/posts/:id/unlike', '/posts/:id/unlike', '/public/posts/:id/unlike'], authenticate, contentController.unlikeCommunityPost);
router.delete(['/community/posts/:id/like', '/posts/:id/like', '/public/posts/:id/like'], authenticate, contentController.unlikeCommunityPost);

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

router.post(['/rescue/requests', '/adoptions/requests'], optionalAuth, contentController.createAdoptionRequest);
router.get(['/rescue/my-requests', '/adoptions/my-requests'], authenticate, contentController.getMyAdoptionRequests);

export default router;

