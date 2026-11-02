import express from 'express';
import mongoose from 'mongoose';
import { authenticate, optionalAuth } from '../../shared/authMiddleware.js';
import * as contentController from './content.controller.js';

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

// Category endpoint for first-aid delegates to legacy sample / custom categories
router.get(['/first-aid/categories', '/public/first-aid/categories'], (req, res, next) => {
  next();
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
// 2. COMMUNITY POSTS
// =========================================================================
router.get(['/community/posts', '/public/community/posts'], contentController.getCommunityPostsPublic);
router.post('/community/posts', authenticate, contentController.createCommunityPost);

// =========================================================================
// 3. RESCUE PETS & ADOPTIONS
// =========================================================================
router.get(['/rescue/pets', '/adoptions/pets', '/public/rescue/pets'], contentController.getRescuePetsPublic);
router.get(['/rescue/pets/:id', '/public/rescue/pets/:id'], contentController.getRescuePetById);

router.post(['/rescue/requests', '/adoptions/requests'], optionalAuth, contentController.createAdoptionRequest);
router.get(['/rescue/my-requests', '/adoptions/my-requests'], authenticate, contentController.getMyAdoptionRequests);

export default router;

