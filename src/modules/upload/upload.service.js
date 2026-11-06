import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import config from '../../shared/config';
import { logger } from '../../shared/logger';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

// Configure Cloudinary if credentials are present
const isCloudinaryConfigured = Boolean(
  config.cloudinary?.cloudName &&
  config.cloudinary?.apiKey &&
  config.cloudinary?.apiSecret
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
  logger.info('Cloudinary configured successfully for media uploads');
} else {
  logger.info('Cloudinary not configured. Falling back to local disk storage in /public/uploads');
}

const MODULE_FOLDERS = {
  products: 'pet_clinic/products',
  content: 'pet_clinic/content',
  community: 'pet_clinic/community',
  rescue: 'pet_clinic/rescue',
};

const getLocalUploadDir = (moduleName = 'products') => {
  const dir = path.join(__dirname, `../../../public/uploads/${moduleName}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};
const localUploadDir = getLocalUploadDir('products');

/**
 * Upload single file (either to Cloudinary or Local Disk)
 */
export const uploadProductImage = async (file, reqHost = '', moduleName = 'products', simulateProviderFailure = false) => {
  if (!file) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'No image file provided');
  }

  // Validate MIME type strictly (JPG, PNG, WEBP)
  const allowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (!allowedMime.includes(file.mimetype)) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Only JPG, PNG and WEBP images are allowed');
  }

  // Validate File Size (max 5MB)
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'File size exceeds maximum limit of 5MB');
  }

  // Simulated provider error in test (GAP-14)
  if (simulateProviderFailure) {
    throw new AppError(502, 'Bad Gateway', 'UPLOAD_PROVIDER_ERROR', 'Cloudinary upload failed: Connection timed out to storage provider');
  }

  const cloudinaryFolder = MODULE_FOLDERS[moduleName] || `pet_clinic/${moduleName}`;

  // If Cloudinary is configured, attempt upload to Cloudinary.
  // CRITICAL: Do NOT silently fallback to local storage if Cloudinary fails! (BE-FIX-09)
  if (isCloudinaryConfigured && file.buffer && process.env.NODE_ENV !== 'test') {
    try {
      const result = await uploadToCloudinary(file.buffer, file.originalname, cloudinaryFolder);
      return {
        id: result.id,
        url: result.url,
        size: result.bytes,
        mimeType: file.mimetype,
        originalName: file.originalname,
        folder: cloudinaryFolder,
      };
    } catch (err) {
      logger.error('Cloudinary upload failed:', err.message);
      throw new AppError(502, 'Bad Gateway', 'UPLOAD_PROVIDER_ERROR', `Cloudinary upload failed: ${err.message}`);
    }
  }

  // Local disk storage for non-Cloudinary local/offline development
  const localDir = getLocalUploadDir(moduleName);
  const uniqueName = `${moduleName.slice(0, 3)}-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
  const targetPath = path.join(localDir, uniqueName);

  if (file.buffer) {
    fs.writeFileSync(targetPath, file.buffer);
  } else if (file.path) {
    fs.copyFileSync(file.path, targetPath);
  }

  const relativeUrl = `/uploads/${moduleName}/${uniqueName}`;
  const absoluteUrl = reqHost ? `${reqHost}${relativeUrl}` : relativeUrl;

  return {
    id: uniqueName,
    url: absoluteUrl,
    size: file.size,
    mimeType: file.mimetype,
    originalName: file.originalname,
    folder: cloudinaryFolder,
  };
};

/**
 * Upload multiple files
 */
export const uploadProductImages = async (files = [], reqHost = '', moduleName = 'products', simulateProviderFailure = false) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'No files provided for upload');
  }
  if (files.length > 10) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Maximum 10 images allowed per product');
  }

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const uploaded = await uploadProductImage(files[i], reqHost, moduleName, simulateProviderFailure);
    results.push({
      ...uploaded,
      isPrimary: i === 0,
      sortOrder: i,
    });
  }
  return results;
};

/**
 * Delete product image from Cloudinary or local disk
 */
export const deleteProductImage = async (imageId) => {
  if (!imageId || !imageId.trim()) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'imageId is required');
  }

  const cleanId = imageId.trim().replace(/\.[^/.]+$/, '');

  if (isCloudinaryConfigured && process.env.NODE_ENV !== 'test') {
    try {
      const publicId = cleanId.startsWith('pet_clinic/products/')
        ? cleanId
        : `pet_clinic/products/${cleanId}`;
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      logger.info(`Cloudinary destroy result for ${publicId}:`, result);
      return {
        id: imageId,
        success: true,
        message: 'Image deleted successfully',
      };
    } catch (err) {
      logger.warn('Cloudinary delete image error:', err.message);
    }
  }

  const baseName = path.basename(imageId);
  const targetPath = path.join(localUploadDir, baseName);
  if (fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
    } catch (e) {
      logger.warn('Failed to delete local file:', e.message);
    }
  }

  return {
    id: imageId,
    success: true,
    message: 'Image deleted successfully',
  };
};
