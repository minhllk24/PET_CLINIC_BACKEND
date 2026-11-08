import express from 'express';
import * as reviewService from './review.service';
import { authenticate, optionalAuth, requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// Public list
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const result = await reviewService.listReviews(req.query, req.actor);
    res.json(result);
  } catch (error) { next(error); }
});

// Admin list
router.get('/admin', requireRole(['MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const result = await reviewService.listAdminReviews(req.query, req.actor);
    res.json(result);
  } catch (error) { next(error); }
});

// Customer own reviews
router.get('/my', requireRole(['CUSTOMER']), async (req, res, next) => {
  try {
    const result = await reviewService.getMyReviews(req.actor);
    res.json(result);
  } catch (error) { next(error); }
});

// Create review (Customer)
router.post(
  '/',
  requireRole(['CUSTOMER']),
  idempotency('reviewsCreate', { required: false }),
  async (req, res, next) => {
    try {
      const review = await reviewService.createReview(req.body, req.actor);
      res.status(201).json(review);
    } catch (error) { next(error); }
  }
);

// Detail review
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const review = await reviewService.getReviewById(req.params.id, req.actor);
    res.json(review);
  } catch (error) { next(error); }
});

// Edit review (Customer)
router.put('/:id', requireRole(['CUSTOMER']), async (req, res, next) => {
  try {
    const review = await reviewService.updateReview(req.params.id, req.body, req.actor);
    res.json(review);
  } catch (error) { next(error); }
});

// Delete review (Customer or Admin)
router.delete('/:id', requireRole(['CUSTOMER', 'MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const result = await reviewService.deleteReview(req.params.id, req.actor);
    res.json(result);
  } catch (error) { next(error); }
});

// Hide review (Manager/Admin) - supports both POST (OpenAPI) and PATCH
const hideHandler = async (req, res, next) => {
  try {
    const review = await reviewService.hideReview(req.params.id, req.body, req.actor);
    res.json(review);
  } catch (error) { next(error); }
};

router.post('/:id/hide', requireRole(['MANAGER', 'ADMIN']), idempotency('reviewsHide', { required: false }), hideHandler);
router.patch('/:id/hide', requireRole(['MANAGER', 'ADMIN']), idempotency('reviewsHide', { required: false }), hideHandler);

// Show review (Manager/Admin) - supports both POST (OpenAPI) and PATCH
const showHandler = async (req, res, next) => {
  try {
    const review = await reviewService.showReview(req.params.id, req.actor);
    res.json(review);
  } catch (error) { next(error); }
};

router.post('/:id/show', requireRole(['MANAGER', 'ADMIN']), idempotency('reviewsShow', { required: false }), showHandler);
router.patch('/:id/show', requireRole(['MANAGER', 'ADMIN']), idempotency('reviewsShow', { required: false }), showHandler);

// Toggle visibility (Manager/Admin) - MOD-03
router.patch('/:id/visibility', requireRole(['MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const isVisible = req.body.isVisible ?? req.body.visible ?? (req.body.status === 'ACTIVE');
    const result = isVisible
      ? await reviewService.showReview(req.params.id, req.actor)
      : await reviewService.hideReview(req.params.id, req.body, req.actor);
    res.json(result);
  } catch (error) { next(error); }
});

// Reply to review (Staff/Admin) - MOD-04
router.post(
  '/:id/reply',
  requireRole(['STAFF', 'VET', 'GROOMER', 'NURSE', 'RECEPTIONIST', 'MANAGER', 'ADMIN']),
  async (req, res, next) => {
    try {
      const result = await reviewService.replyReview(req.params.id, req.body, req.actor);
      res.json(result);
    } catch (error) { next(error); }
  }
);

// Compatibility route for Frontend: GET /api/v1/reviews/target/product/:productId
router.get('/target/product/:productId', optionalAuth, async (req, res, next) => {
  try {
    const result = await reviewService.listReviews({
      ...req.query,
      targetType: 'PRODUCT',
      targetId: req.params.productId
    }, req.actor);
    res.json(result);
  } catch (error) { next(error); }
});

// Like a review (Customer/Public)
router.post('/:id/like', optionalAuth, async (req, res) => {
  res.json({
    success: true,
    EC: 0,
    EM: 'Success',
    id: req.params.id,
  });
});

export default router;
