import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-cart-token"]',
      'body.password',
      'body.otp',
      'body.cartToken',
      'body.accessToken',
      'body.refreshToken',
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
  genReqId: (req, res) => {
    // Check if correlationId exists in header and is valid length/chars, else generate new UUID
    const incomingId = req.headers['x-correlation-id'];
    const reqId = (incomingId && typeof incomingId === 'string' && incomingId.length <= 50 && /^[a-zA-Z0-9-]+$/.test(incomingId))
      ? incomingId
      : uuidv4();
    req.id = reqId; // Expose on req
    res.setHeader('X-Correlation-Id', reqId);
    return reqId;
  },
  customProps: (req, res) => {
    return {
      correlationId: req.id,
    };
  },
});
