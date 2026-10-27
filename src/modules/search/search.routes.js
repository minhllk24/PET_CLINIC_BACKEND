import express from 'express';
import * as searchController from './search.controller';
import { optionalAuth } from '../../shared/authMiddleware';

const router = express.Router();

// GET /api/v1/search
router.get('/', optionalAuth, searchController.unifiedSearch);

// GET /api/v1/search/suggestions
router.get('/suggestions', optionalAuth, searchController.getSearchSuggestions);

export default router;
