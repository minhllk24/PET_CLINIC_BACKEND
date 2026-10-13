import rateLimit from 'express-rate-limit';

/**
 * Factory for creating custom RFC 9457 compliant rate limiters
 * @param {Object} options
 * @param {number} [options.windowMs=900000] - 15 minutes by default
 * @param {number} [options.max=20] - Max requests per window
 * @param {string} [options.message='Too many requests, please try again later']
 */
export const createEndpointLimiter = (options = {}) => {
  if (process.env.NODE_ENV === 'test') {
    return (req, res, next) => next();
  }

  const {
    windowMs = 15 * 60 * 1000,
    max = 20,
    message = 'Too many requests, please try again later.',
  } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).type('application/problem+json').json({
        type: 'https://tools.ietf.org/html/rfc9457',
        title: 'Too Many Requests',
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        correlationId: req.id || null,
        detail: message,
        instance: req.originalUrl,
      });
    },
  });
};

// Standard rate limiters for authentication endpoints
export const authLimiter = createEndpointLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 20,
  message: 'Too many authentication attempts, please try again after 15 minutes.',
});

export const otpLimiter = createEndpointLimiter({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 10,
  message: 'Too many OTP verification attempts. Please wait 15 minutes.',
});

export const forgotPasswordLimiter = createEndpointLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many password reset requests. Maximum 5 requests per hour.',
});

export default {
  createEndpointLimiter,
  authLimiter,
  otpLimiter,
  forgotPasswordLimiter,
};
