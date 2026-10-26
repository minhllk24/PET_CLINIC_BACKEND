import express from 'express';
import * as feedbackService from './feedback.service';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';

const router = express.Router();

// Anyone can create feedback (public or authenticated)
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const feedback = await feedbackService.createFeedback(req.body, req.actor);
    res.status(201).json(feedback);
  } catch (error) { next(error); }
});

// Manager / Admin list feedback
router.get('/', requireRole(['MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const result = await feedbackService.listFeedback(req.query, req.actor);
    res.json(result);
  } catch (error) { next(error); }
});

// Manager / Admin detail feedback
router.get('/:id', requireRole(['MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const feedback = await feedbackService.getFeedbackById(req.params.id, req.actor);
    res.json(feedback);
  } catch (error) { next(error); }
});

// Manager / Admin update feedback status
router.patch('/:id/status', requireRole(['MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const feedback = await feedbackService.updateFeedbackStatus(req.params.id, req.body, req.actor);
    res.json(feedback);
  } catch (error) { next(error); }
});

export default router;
