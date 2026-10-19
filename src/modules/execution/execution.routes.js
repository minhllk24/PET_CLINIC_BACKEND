import express from 'express';
import * as executionController from './execution.controller';
import { requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

router.post('/records', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.createRecord);
router.patch(
  '/records/:id/submit-review',
  requireRole(['STAFF'], ['NURSE']),
  idempotency('serviceRecordsSubmitReview', { required: true }),
  executionController.submitReview
);
router.patch(
  '/records/:id/finalize',
  requireRole(['STAFF'], ['VETERINARIAN', 'CARE_STAFF_GROOMER']),
  idempotency('serviceRecordsFinalize', { required: true }),
  executionController.finalizeRecord
);

export default router;
