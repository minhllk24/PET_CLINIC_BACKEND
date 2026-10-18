import * as uploadService from './upload.service';
import { sendCreated, sendSuccess } from '../../shared/responseHelpers';

export const uploadProductImages = async (req, res, next) => {
  try {
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    const reqHost = `${protocol}://${host}`;

    // Handle both req.files (array) and req.file (single)
    const files = req.files || (req.file ? [req.file] : []);
    const results = await uploadService.uploadProductImages(files, reqHost);

    return sendCreated(res, {
      items: results,
      total: results.length,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteProductImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const result = await uploadService.deleteProductImage(decodeURIComponent(imageId));
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};
