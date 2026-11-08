import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import config from '../../shared/config';
import { logger } from '../../shared/logger';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

const checkCloudinaryConfigured = () => {
  const cloudName = config.cloudinary?.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = config.cloudinary?.apiKey || process.env.CLOUDINARY_API_KEY;
  const apiSecret = config.cloudinary?.apiSecret || process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return true;
  }
  return false;
};

if (checkCloudinaryConfigured()) {
  logger.info('Cloudinary configured successfully for media uploads');
} else {
  logger.warn('Cloudinary credentials missing in environment. Uploads will fail with 502 UPLOAD_PROVIDER_ERROR until configured.');
}

const MODULE_FOLDERS = {
  products: 'pet_clinic/products',
  content: 'pet_clinic/content',
  community: 'pet_clinic/community',
  rescue: 'pet_clinic/rescue',
};

/**
 * Helper to stream buffer to Cloudinary
 */
export const uploadToCloudinary = (buffer, originalname = 'image', folder = 'pet_clinic/products') => {
  return new Promise((resolve, reject) => {
    const ext = path.extname(originalname || '');
    const base = path.basename(originalname || 'image', ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    const publicId = `${base}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result || !result.secure_url) {
          return reject(new Error('Invalid response from Cloudinary'));
        }
        resolve({
          id: result.public_id,
          url: result.secure_url,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
};

/**
 * Upload base64 image data URL directly to Cloudinary
 */
export const uploadBase64ToCloudinary = async (base64Str, originalname = 'image', folder = 'pet_clinic/products') => {
  if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:')) {
    return base64Str;
  }
  try {
    const parts = base64Str.split(';base64,');
    if (parts.length !== 2) return base64Str;
    const buffer = Buffer.from(parts[1], 'base64');
    const res = await uploadToCloudinary(buffer, originalname, folder);
    return res.url;
  } catch (err) {
    logger.warn('Failed to upload base64 to Cloudinary, keeping original url:', err.message);
    return base64Str;
  }
};

/**
 * Upload single file strictly to Cloudinary (No local disk fallback - BE-FIX-09)
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

  // Simulated provider error ONLY in test environment (GAP-14)
  if (process.env.NODE_ENV === 'test' && simulateProviderFailure) {
    throw new AppError(502, 'Bad Gateway', 'UPLOAD_PROVIDER_ERROR', 'Cloudinary upload failed: Connection timed out to storage provider');
  }

  const cloudinaryFolder = MODULE_FOLDERS[moduleName] || `pet_clinic/${moduleName}`;

  if (!checkCloudinaryConfigured()) {
    throw new AppError(
      502,
      'Bad Gateway',
      'UPLOAD_PROVIDER_ERROR',
      'Cloudinary storage provider is not configured (missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET)'
    );
  }

  if (!file.buffer) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Image file buffer is required for cloud upload');
  }

  try {
    const result = await uploadToCloudinary(file.buffer, file.originalname, cloudinaryFolder);
    return {
      id: result.id,
      url: result.url,
      size: result.bytes || file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
      folder: cloudinaryFolder,
    };
  } catch (err) {
    logger.error('Cloudinary upload failed:', err.message);
    throw new AppError(502, 'Bad Gateway', 'UPLOAD_PROVIDER_ERROR', `Cloudinary upload failed: ${err.message}`);
  }
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
 * Delete product image from Cloudinary (No local disk fallback - BE-FIX-09)
 */
export const deleteProductImage = async (imageId) => {
  if (!imageId || !imageId.trim()) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'imageId is required');
  }

  const cleanId = imageId.trim().replace(/\.[^/.]+$/, '');

  if (checkCloudinaryConfigured()) {
    try {
      const publicId = cleanId.startsWith('pet_clinic/')
        ? cleanId
        : `pet_clinic/products/${cleanId}`;
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      logger.info(`Cloudinary destroy result for ${publicId}:`, result);
    } catch (err) {
      logger.warn('Cloudinary delete image error:', err.message);
    }
  }

  return {
    id: imageId,
    success: true,
    message: 'Image deleted successfully',
  };
};
