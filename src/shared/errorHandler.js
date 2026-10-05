import AppError from '../utils/AppError';
import { logger } from './logger';

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.title = err.title || 'Internal Server Error';
  error.status = err.status || 500;
  error.code = err.code || 'INTERNAL_ERROR';
  error.detail = err.detail || err.message || 'Something went wrong';
  error.type = err.type || `https://httpstatuses.com/${error.status}`;

  // Log error using pino
  logger.error(err);

  // OpenAPI Validator Errors
  if (err.status === 400 && err.errors) {
    error = new AppError(
      400,
      'Bad Request',
      'VALIDATION_ERROR',
      'Request validation failed',
      err.errors.map((e) => ({
        field: e.path,
        message: e.message,
        code: e.errorCode || 'INVALID_FIELD',
      }))
    );
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const detail = `Resource not found with invalid id format: ${err.value}`;
    error = new AppError(404, 'Not Found', 'NOT_FOUND', detail);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const detail = `Duplicate field value entered`;
    error = new AppError(409, 'Conflict', 'CONFLICT', detail);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((val) => ({
      field: val.path,
      message: val.message,
      code: 'INVALID_FIELD'
    }));
    error = new AppError(400, 'Validation Error', 'VALIDATION_ERROR', 'Validation failed', errors);
  }

  // Response payload following RFC 9457 schema from docs
  const problemPayload = {
    type: error.type || `https://httpstatuses.com/${error.status || 500}`,
    title: error.title || 'Internal Server Error',
    status: error.status || 500,
    code: error.code || 'INTERNAL_ERROR',
    correlationId: req.id, // from pino-http
    detail: error.detail || 'Something went wrong',
    instance: req.originalUrl,
  };

  if (error.errors && error.errors.length > 0) {
    problemPayload.errors = error.errors;
  }
  if (error.suggestedGroups) {
    problemPayload.suggestedGroups = error.suggestedGroups;
  }

  // Set response type to application/problem+json
  res.setHeader('Content-Type', 'application/problem+json');
  res.status(problemPayload.status).json(problemPayload);
};

export const notFoundHandler = (req, res, next) => {
  const error = new AppError(404, 'Not Found', 'NOT_FOUND', `Cannot find ${req.originalUrl}`);
  next(error);
};
