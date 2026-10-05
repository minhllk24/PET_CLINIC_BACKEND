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

  // Log error using pino
  logger.error(err);

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

  // OpenAPI Validator Errors
  if (err.status === 400 && err.errors) {
    error = new AppError(
      400,
      'Bad Request',
      ErrorCodes.VALIDATION_ERROR,
      'Request validation failed',
      err.errors.map((e) => ({
        field: e.path,
        message: e.message,
        code: e.errorCode || ErrorCodes.VALIDATION_ERROR,
      }))
    );
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const detail = `Resource not found with invalid id format: ${err.value}`;
    error = new AppError(404, 'Not Found', ErrorCodes.NOT_FOUND, detail);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const detail = `Duplicate field value entered`;
    error = new AppError(409, 'Conflict', ErrorCodes.CONFLICT, detail);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
      code: ErrorCodes.VALIDATION_ERROR
    }));
    error = new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Validation failed', errors);
  }

  const isInternal = error.status === 500 || !error.status;
  
  const problemPayload = {
    type: error.type || `https://httpstatuses.com/${error.status || 500}`,
    title: isInternal ? 'Internal Server Error' : error.title,
    status: isInternal ? 500 : error.status,
    code: isInternal ? ErrorCodes.INTERNAL_ERROR : error.code,
    correlationId: req.id, // from pino-http
    detail: isInternal ? 'An unexpected error occurred' : error.detail,
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
