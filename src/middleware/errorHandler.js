import AppError from '../utils/AppError';

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.title = err.title || 'Internal Server Error';
  error.status = err.status || 500;
  error.detail = err.detail || err.message || 'Something went wrong';
  error.type = err.type || `https://httpstatuses.com/${error.status}`;

  // Log to console for dev
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const detail = `Resource not found with id of ${err.value}`;
    error = new AppError(404, 'Not Found', detail, req.originalUrl);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const detail = 'Duplicate field value entered';
    error = new AppError(400, 'Bad Request', detail, req.originalUrl);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const detail = Object.values(err.errors).map((val) => val.message).join(', ');
    error = new AppError(400, 'Validation Error', detail, req.originalUrl);
  }

  res.status(error.status || 500).json({
    type: error.type || `https://httpstatuses.com/${error.status || 500}`,
    title: error.title || 'Internal Server Error',
    status: error.status || 500,
    detail: error.detail || 'Something went wrong',
    instance: error.instance || req.originalUrl,
  });
};

export default errorHandler;
