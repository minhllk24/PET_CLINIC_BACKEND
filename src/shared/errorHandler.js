import AppError from '../utils/AppError';
import { logger } from './logger';
import { ErrorCodes } from './errorCodes';

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.title = err.title || 'Internal Server Error';
  error.status = err.status || 500;
  error.code = err.code || ErrorCodes.INTERNAL_ERROR;
  error.detail = err.detail || err.message || 'Something went wrong';
  error.type = err.type || `https://httpstatuses.com/${error.status}`;

  // Express Payload Too Large
  if (err.type === 'entity.too.large') {
    error = new AppError(
      413,
      'Payload Too Large',
      ErrorCodes.VALIDATION_ERROR,
      'Request payload exceeds limit (1mb)'
    );
  }

  // Express JSON Parse Error
  if (err.type === 'entity.parse.failed') {
    error = new AppError(
      400,
      'Bad Request',
      ErrorCodes.VALIDATION_ERROR,
      'Invalid JSON payload'
    );
  }

  // OpenAPI Validator Errors & Token Expiration
  if (err.name === 'TokenExpiredError' || err.code === 'TOKEN_EXPIRED' || error.code === 'TOKEN_EXPIRED') {
    error.status = 401;
    error.code = 'TOKEN_EXPIRED';
    error.title = 'Token Expired';
    error.detail = err.detail || 'Access token has expired';
  } else if (err.status === 401 && !err.code) {
    error = new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, err.message);
  }
  
  if (err.status === 403) {
    const customCode = err.code || (error && error.code);
    const resolvedCode = customCode && customCode !== 'INTERNAL_SERVER_ERROR' && customCode !== 'INTERNAL_ERROR'
      ? customCode
      : ErrorCodes.AUTHORIZATION_ERROR;
    error = new AppError(403, err.title || error.title || 'Forbidden', resolvedCode, err.message || error.message || 'Forbidden');
  }

  if (err.status === 400 && err.errors) {
    const formattedErrors = err.errors.map((e) => {
      let friendlyMsg = e.message;
      if (e.message && e.message.includes('should NOT have additional properties')) {
        const prop = e.params?.additionalProperty || e.path || '';
        friendlyMsg = `Trường không hợp lệ: ${prop}`;
      } else if (e.path && e.path.includes('phone')) {
        friendlyMsg = 'Số điện thoại không đúng định dạng (VD: 0912345678)';
      } else if (e.path && e.path.includes('email')) {
        friendlyMsg = 'Email không đúng định dạng';
      }
      return {
        field: e.path,
        message: friendlyMsg || e.message,
        code: e.errorCode || ErrorCodes.VALIDATION_ERROR,
      };
    });

    const firstMsg = formattedErrors.find(e => e.message)?.message;
    const summaryDetail = firstMsg || 'Dữ liệu yêu cầu không hợp lệ. Vui lòng kiểm tra lại.';

    error = new AppError(
      400,
      'Bad Request',
      ErrorCodes.VALIDATION_ERROR,
      summaryDetail,
      formattedErrors
    );
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const detail = `Resource not found with invalid id format: ${err.value}`;
    error = new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, detail);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    let detail = 'Dữ liệu đã tồn tại trên hệ thống';
    if (err.keyValue) {
      const keys = Object.keys(err.keyValue);
      if (keys.length > 0) {
        const key = keys[0];
        const val = err.keyValue[key];
        if (key.includes('sku') || key === 'variants.sku') {
          detail = `SKU "${val}" đã tồn tại trên hệ thống`;
        } else if (key === 'name') {
          detail = `Tên "${val}" đã tồn tại trên hệ thống`;
        } else if (key === 'slug') {
          detail = `Slug "${val}" đã tồn tại trên hệ thống`;
        } else {
          detail = `Trường "${key}" với giá trị "${val}" đã tồn tại trên hệ thống`;
        }
      }
    }
    error = new AppError(409, 'Conflict', ErrorCodes.CONFLICT, detail);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => {
      let friendlyMsg = val.message;
      if (val.path === 'email' || (val.message && val.message.toLowerCase().includes('email'))) {
        friendlyMsg = 'Địa chỉ email không đúng định dạng (VD: example@domain.com)';
      } else if (val.path === 'phone' || (val.message && val.message.toLowerCase().includes('phone'))) {
        friendlyMsg = 'Số điện thoại không đúng định dạng Việt Nam (VD: 0987654321 hoặc +84987654321)';
      }
      return {
        field: val.path,
        message: friendlyMsg || val.message,
        code: ErrorCodes.VALIDATION_ERROR
      };
    });
    const firstMsg = errors.find((e) => e.message)?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
    error = new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, firstMsg, errors);
  }

  const isInternal = error.status === 500 || !error.status;
  
  // Log error using pino: full stack trace for 5xx, concise warning for 4xx
  if (isInternal) {
    logger.error(err);
  } else {
    logger.warn({
      status: error.status,
      code: error.code,
      url: req.originalUrl,
      correlationId: req.id,
      detail: error.detail,
    });
  }
  
  const problemPayload = {
    type: error.type || `https://httpstatuses.com/${error.status || 500}`,
    title: isInternal ? 'Internal Server Error' : error.title,
    status: isInternal ? 500 : error.status,
    code: isInternal ? ErrorCodes.INTERNAL_ERROR : error.code,
    correlationId: req.id, // from pino-http
    detail: isInternal ? 'An unexpected error occurred' : error.detail,
    message: isInternal ? 'An unexpected error occurred' : (error.detail || error.message),
    instance: req.originalUrl,
  };

  if (error.errors && error.errors.length > 0) {
    problemPayload.errors = error.errors;
  }

  // Set response type to application/problem+json
  res.setHeader('Content-Type', 'application/problem+json');
  res.status(problemPayload.status).json(problemPayload);
};

export const notFoundHandler = (req, res, next) => {
  const error = new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, `Cannot find ${req.originalUrl}`);
  next(error);
};
