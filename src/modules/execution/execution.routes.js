import express from 'express';
import * as executionController from './execution.controller';
import { requireRole } from '../../shared/authMiddleware';
import { idempotency } from '../../middleware/idempotencyMiddleware';

const router = express.Router();

// List & Create
router.get('/', requireRole(['STAFF', 'MANAGER', 'ADMIN', 'CUSTOMER']), executionController.listRecords);
router.get('/records', requireRole(['STAFF', 'MANAGER', 'ADMIN', 'CUSTOMER']), executionController.listRecords);

router.post('/', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.createRecord);
router.post('/records', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.createRecord);

// Detail & Revisions
router.get('/:id/revisions', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.getRevisions);
router.get('/records/:id/revisions', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.getRevisions);

router.get('/:id', requireRole(['STAFF', 'MANAGER', 'ADMIN', 'CUSTOMER']), executionController.getRecordById);
router.get('/records/:id', requireRole(['STAFF', 'MANAGER', 'ADMIN', 'CUSTOMER']), executionController.getRecordById);

// Update Materials (OpenAPI uses PUT; allow PATCH as well)
router.put('/:id/materials', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.updateMaterials);
router.patch('/:id/materials', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.updateMaterials);
router.put('/records/:id/materials', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.updateMaterials);
router.patch('/records/:id/materials', requireRole(['STAFF', 'MANAGER', 'ADMIN']), executionController.updateMaterials);

// Update Professional (OpenAPI uses PUT; allow PATCH as well)
router.put(
  '/:id/professional',
  requireRole(['STAFF', 'ADMIN'], ['VETERINARIAN']),
  executionController.updateProfessional
);
router.patch(
  '/:id/professional',
  requireRole(['STAFF', 'ADMIN'], ['VETERINARIAN']),
  executionController.updateProfessional
);
router.put(
  '/records/:id/professional',
  requireRole(['STAFF', 'ADMIN'], ['VETERINARIAN']),
  executionController.updateProfessional
);
router.patch(
  '/records/:id/professional',
  requireRole(['STAFF', 'ADMIN'], ['VETERINARIAN']),
  executionController.updateProfessional
);

// Reopen (Manager / Admin)
router.post(
  '/:id/reopen',
  requireRole(['MANAGER', 'ADMIN']),
  idempotency('serviceRecordsReopen', { required: false }),
  executionController.reopenRecord
);
router.post(
  '/records/:id/reopen',
  requireRole(['MANAGER', 'ADMIN']),
  idempotency('serviceRecordsReopen', { required: false }),
  executionController.reopenRecord
);

// Submit Review (Nurse) - OpenAPI uses POST; allow PATCH as well
router.post(
  '/:id/submit-review',
  requireRole(['STAFF'], ['NURSE']),
  idempotency('serviceRecordsSubmitReview', { required: false }),
  executionController.submitReview
);
router.patch(
  '/:id/submit-review',
  requireRole(['STAFF'], ['NURSE']),
  idempotency('serviceRecordsSubmitReview', { required: false }),
  executionController.submitReview
);
router.post(
  '/records/:id/submit-review',
  requireRole(['STAFF'], ['NURSE']),
  idempotency('serviceRecordsSubmitReview', { required: false }),
  executionController.submitReview
);
router.patch(
  '/records/:id/submit-review',
  requireRole(['STAFF'], ['NURSE']),
  idempotency('serviceRecordsSubmitReview', { required: false }),
  executionController.submitReview
);

// Finalize (Vet or Care Staff / Groomer) - OpenAPI uses POST; allow PATCH as well
router.post(
  '/:id/finalize',
  requireRole(['STAFF'], ['VETERINARIAN', 'CARE_STAFF_GROOMER']),
  idempotency('serviceRecordsFinalize', { required: false }),
  executionController.finalizeRecord
);
router.patch(
  '/:id/finalize',
  requireRole(['STAFF'], ['VETERINARIAN', 'CARE_STAFF_GROOMER']),
  idempotency('serviceRecordsFinalize', { required: false }),
  executionController.finalizeRecord
);
router.post(
  '/records/:id/finalize',
  requireRole(['STAFF'], ['VETERINARIAN', 'CARE_STAFF_GROOMER']),
  idempotency('serviceRecordsFinalize', { required: false }),
  executionController.finalizeRecord
);
router.patch(
  '/records/:id/finalize',
  requireRole(['STAFF'], ['VETERINARIAN', 'CARE_STAFF_GROOMER']),
  idempotency('serviceRecordsFinalize', { required: false }),
  executionController.finalizeRecord
);

export default router;
