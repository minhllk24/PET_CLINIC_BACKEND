import express from 'express';
import * as screeningController from './screening.controller';
import { optionalAuth } from '../../shared/authMiddleware';

const router = express.Router();

router.post('/screening', optionalAuth, screeningController.screenSymptoms);

export default router;

