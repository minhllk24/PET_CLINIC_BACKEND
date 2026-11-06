import * as uploadService from './upload.service';
import { sendCreated, sendSuccess } from '../../shared/responseHelpers';

export const uploadProductImages = async (req, res, next) => {
  try {
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    const reqHost = `${protocol}://${host}`;

    // Detect module from path: /products, /content, /community, /rescue
    let moduleName = 'products';
    const pathLower = (req.originalUrl || req.baseUrl || req.path || '').toLowerCase();
    if (pathLower.includes('/content')) moduleName = 'content';
    else if (pathLower.includes('/community')) moduleName = 'community';
    else if (pathLower.includes('/rescue')) moduleName = 'rescue';
    else if (pathLower.includes('/products')) moduleName = 'products';

    const simulateProviderFailure = Boolean(req.headers['x-simulate-upload-failure']);

    // Handle both req.files (array) and req.file (single)
    const files = req.files || (req.file ? [req.file] : []);
    const results = await uploadService.uploadProductImages(files, reqHost, moduleName, simulateProviderFailure);

    return sendCreated(res, {
      items: results,
      total: results.length,
      module: moduleName,
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
