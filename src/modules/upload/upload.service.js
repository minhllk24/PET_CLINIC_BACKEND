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

const localUploadDir = path.join(__dirname, '../../../public/uploads/products');
if (!fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

/**
 * Upload buffer to Cloudinary via upload_stream
 */
const uploadToCloudinary = (fileBuffer, originalname, folder = 'pet_clinic/products') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        public_id: `${Date.now()}-${path.parse(originalname).name.replace(/[^a-zA-Z0-9]/g, '_')}`,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          id: result.public_id,
          url: result.secure_url,
          format: result.format,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Upload single file (either to Cloudinary or Local Disk)
 */
export const uploadProductImage = async (file, reqHost = '') => {
  if (!file) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'No image file provided');
  }

  // Validate MIME type
  const allowedMime = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  if (!allowedMime.includes(file.mimetype)) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Only JPG, PNG and WEBP images are allowed');
  }

  // Validate File Size (max 5MB)
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'File size exceeds maximum limit of 5MB');
  }

  // If Cloudinary is configured and not in test, attempt Cloudinary upload
  if (isCloudinaryConfigured && file.buffer && process.env.NODE_ENV !== 'test') {
    try {
      const result = await uploadToCloudinary(file.buffer, file.originalname);
      return {
        id: result.id,
        url: result.url,
        size: result.bytes,
        mimeType: file.mimetype,
        originalName: file.originalname,
      };
    } catch (err) {
      logger.warn('Cloudinary upload failed, falling back to local disk storage:', err.message);
    }
  }

  // Local disk fallback
  const uniqueName = `sp-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
  const targetPath = path.join(localUploadDir, uniqueName);

  if (file.buffer) {
    fs.writeFileSync(targetPath, file.buffer);
  } else if (file.path) {
    fs.copyFileSync(file.path, targetPath);
  }

  const relativeUrl = `/uploads/products/${uniqueName}`;
  const absoluteUrl = reqHost ? `${reqHost}${relativeUrl}` : relativeUrl;

  return {
    id: uniqueName,
    url: absoluteUrl,
    size: file.size,
    mimeType: file.mimetype,
    originalName: file.originalname,
  };
};

/**
 * Upload multiple files
 */
export const uploadProductImages = async (files = [], reqHost = '') => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'No files provided for upload');
  }
  if (files.length > 10) {
    throw new AppError(400, 'Bad Request', ErrorCodes.VALIDATION_ERROR, 'Maximum 10 images allowed per product');
  }

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const uploaded = await uploadProductImage(files[i], reqHost);
    results.push({
      ...uploaded,
      isPrimary: i === 0,
      sortOrder: i,
    });
  }
  return results;
};
