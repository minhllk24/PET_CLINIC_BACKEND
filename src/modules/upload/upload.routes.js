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
 * Hỗ trợ upload ảnh sản phẩm (single hoặc multiple, field name là "files" hoặc "file" hoặc "images")
 */
router.post(
  '/products',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  conditionalMulter,
  uploadController.uploadProductImages
);

/**
 * DELETE /api/v1/uploads/products/:imageId(*)
 * Xóa ảnh sản phẩm khỏi Cloudinary hoặc local disk
 */
router.delete(
  '/products/:imageId(*)',
  authenticate,
  requireRole(['ADMIN', 'MANAGER']),
  uploadController.deleteProductImage
);

export default router;
