import express from 'express';
import { requireRole } from '../../shared/authMiddleware.js';
import * as contentController from './content.controller.js';

const router = express.Router();

// =========================================================================
// 1. ADMIN POSTS (BLOG & FIRST AID)
// =========================================================================
router.get('/posts', requireRole(['ADMIN', 'MANAGER']), contentController.getPostsAdmin);
router.post('/posts', requireRole(['ADMIN']), contentController.createPost);
router.get('/posts/:id', requireRole(['ADMIN', 'MANAGER']), contentController.getPostById);
router.patch('/posts/:id', requireRole(['ADMIN']), contentController.updatePost);
router.patch('/posts/:id/status', requireRole(['ADMIN', 'MANAGER']), contentController.updatePostStatus);
router.delete('/posts/:id', requireRole(['ADMIN']), contentController.deletePost);

// =========================================================================
// 2. COMMUNITY POSTS MODERATION & CREATION (BE-FIX-06)
// =========================================================================
router.get('/community/posts', requireRole(['ADMIN', 'MANAGER']), contentController.getCommunityPostsAdmin);
router.post('/community/posts', requireRole(['ADMIN', 'MANAGER']), contentController.createCommunityPostAdmin);
router.patch('/community/posts/:id/moderate', requireRole(['ADMIN', 'MANAGER']), contentController.moderateCommunityPost);
router.delete('/community/posts/:id', requireRole(['ADMIN']), contentController.deleteCommunityPost);

// =========================================================================
// 3. RESCUE PETS MANAGEMENT
// =========================================================================
router.get('/rescue/pets', requireRole(['ADMIN', 'MANAGER']), contentController.getRescuePetsAdmin);
router.post('/rescue/pets', requireRole(['ADMIN', 'MANAGER']), contentController.createRescuePet);
router.get('/rescue/pets/:id', requireRole(['ADMIN', 'MANAGER']), contentController.getRescuePetById);
router.patch('/rescue/pets/:id', requireRole(['ADMIN', 'MANAGER']), contentController.updateRescuePet);
router.delete('/rescue/pets/:id', requireRole(['ADMIN']), contentController.deleteRescuePet);

// =========================================================================
// 4. ADOPTION REQUESTS REVIEW
// =========================================================================
router.get('/rescue/requests', requireRole(['ADMIN', 'MANAGER']), contentController.getAdoptionRequestsAdmin);
router.patch('/rescue/requests/:id/review', requireRole(['ADMIN', 'MANAGER']), contentController.reviewAdoptionRequest);

// =========================================================================
// 5. COMMUNITY VIOLATION REPORTS MODERATION (MOD-09..12)
// =========================================================================
router.get('/reports', requireRole(['ADMIN', 'MANAGER']), contentController.getCommunityReportsAdmin);
router.get('/reports/:id', requireRole(['ADMIN', 'MANAGER']), contentController.getCommunityReportById);
router.patch('/reports/:id/resolve', requireRole(['ADMIN', 'MANAGER']), contentController.resolveCommunityReport);

export default router;
