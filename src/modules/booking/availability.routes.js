import express from 'express';
import { getAvailability } from './booking.controller';
import { optionalAuth } from '../../shared/authMiddleware';

const router = express.Router();

router.get('/', optionalAuth, getAvailability);

export default router;
