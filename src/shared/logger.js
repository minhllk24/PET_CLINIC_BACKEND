import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-cart-token"]',
      'body.password',
      'body.confirmPassword',
      'body.oldPassword',
      'body.newPassword',
      'body.otp',
      'body.otpCode',
      'body.resetToken',
      'body.cartToken',
      'body.accessToken',
      'body.refreshToken',
      'body.credential',
    ],
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => {
    // Check if correlationId exists in header, else generate new UUID
    const reqId = req.headers['x-correlation-id'] || uuidv4();
    req.id = reqId; // Expose on req
    return reqId;
  },
  customProps: (req, res) => {
    return {
      correlationId: req.id,
    };
  },
});
