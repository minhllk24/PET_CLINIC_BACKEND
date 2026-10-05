import express from 'express';
import mongoose from 'mongoose';
import { sendSuccess } from '../shared/responseHelpers';
import AppError from '../utils/AppError';

const router = express.Router();

router.get('/health', (req, res) => {
  sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health/ready', (req, res, next) => {
  // Check if mongoose connection is ready (1 = connected)
  const isDbConnected = mongoose.connection.readyState === 1;
  
  if (!isDbConnected) {
    return next(new AppError(503, 'Service Unavailable', 'INTERNAL_ERROR', 'Database not connected'));
  }
  
  sendSuccess(res, { status: 'ready', timestamp: new Date().toISOString() });
});

export default router;
