import express from 'express';
import * as recommendationController from './recommendation.controller';
import { optionalAuth } from '../../shared/authMiddleware';

const router = express.Router();

router.get('/', optionalAuth, recommendationController.getRecommendations);

export default router;

