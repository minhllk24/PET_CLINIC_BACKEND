import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as OpenApiValidator from 'express-openapi-validator';
import path from 'path';

import config from './shared/config';
import { httpLogger } from './shared/logger';
import { errorHandler, notFoundHandler } from './shared/errorHandler';
import healthRoutes from './routes/health';
import AppError from './utils/AppError';

const app = express();

// Logging should be first to capture all requests and assign req.id
app.use(httpLogger);

// Security middlewares
app.use(helmet()); // Sets various HTTP headers like X-Content-Type-Options

// CORS Configuration (Allowlist from env)
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (config.cors.allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  exposedHeaders: ['X-Correlation-Id'],
}));

// Global Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new AppError(429, 'Too Many Requests', 'RATE_LIMIT', 'Too many requests from this IP, please try again later.'));
  }
});
app.use(limiter);

// Payload parsers
// Limit payload size to 1mb (from 50mb legacy)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// OpenAPI Validator
app.use(
  OpenApiValidator.middleware({
    apiSpec: config.openapiSpecPath,
    validateRequests: true,
    validateResponses: config.env !== 'production', // Turn off for production performance
    ignoreUndocumented: true, // Ignore routes not in spec (like /health)
  })
);

// Routes
app.use('/api/v1', healthRoutes);

// Catch 404
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
