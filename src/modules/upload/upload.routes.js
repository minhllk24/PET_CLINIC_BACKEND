import express from 'express';
import multer from 'multer';
import * as uploadController from './upload.controller';
import { authenticate, requireRole } from '../../shared/authMiddleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10, // Max 10 files
  },
});

const router = express.Router();

const conditionalMulter = (req, res, next) => {
  if (req.files && (Array.isArray(req.files) ? req.files.length > 0 : Object.keys(req.files).length > 0)) {
    return next();
  }
  upload.any()(req, res, next);
};

/**
 * POST /api/v1/uploads/products
 */
router.post(
  '/products',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  conditionalMulter,
  uploadController.uploadProductImages
);

/**
 * POST /api/v1/uploads/content (Articles, First Aid)
 */
router.post(
  '/content',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  conditionalMulter,
  uploadController.uploadProductImages
);

/**
 * POST /api/v1/uploads/community (Member forum uploads)
 */
router.post(
  '/community',
  authenticate,
  conditionalMulter,
  uploadController.uploadProductImages
);

/**
 * POST /api/v1/uploads/rescue (Partner & Rescue pet uploads)
 */
router.post(
  '/rescue',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  conditionalMulter,
  uploadController.uploadProductImages
);

/**
 * DELETE /api/v1/uploads/products/:imageId(*)
 */
router.delete(
  '/products/:imageId(*)',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  uploadController.deleteProductImage
);

export default router;
