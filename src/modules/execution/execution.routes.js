import express from 'express';
import * as executionController from './execution.controller';
import { requireRole } from '../../shared/authMiddleware';

const router = express.Router();

router.post('/records', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.createRecord);
router.patch('/records/:id/submit-review', requireRole(['NURSE', 'MANAGER', 'ADMIN']), executionController.submitReview);
router.patch('/records/:id/finalize', requireRole(['VETERINARIAN', 'CARE_STAFF_GROOMER', 'MANAGER', 'ADMIN']), executionController.finalizeRecord);

export default router;
