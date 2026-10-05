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

const app = express();

// Security middlewares
app.use(helmet()); // Sets various HTTP headers like X-Content-Type-Options

// CORS Configuration (Allowlist from env)
app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (config.cors.allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
}));

// Global Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'about:blank',
    title: 'Too Many Requests',
    status: 429,
    code: 'RATE_LIMIT',
    detail: 'Too many requests from this IP, please try again later.',
  }
});
app.use(limiter);

// Logging and payload parsers
app.use(httpLogger);
// Limit payload size to 1mb (from 50mb legacy)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// OpenAPI Validator
const apiSpecPath = path.join(__dirname, '../docs/07-openapi-v5.yaml');
app.use(
  OpenApiValidator.middleware({
    apiSpec: apiSpecPath,
    validateRequests: {
      removeAdditional: 'failing' // Block additional properties
    },
    validateResponses: false, // Turn off for production performance if needed, but useful for testing
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
