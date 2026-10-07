import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as OpenApiValidator from 'express-openapi-validator';
import path from 'path';

import config from './shared/config';
import { httpLogger } from './shared/logger';
import { errorHandler, notFoundHandler } from './shared/errorHandler';
import { authorizeRequest } from './shared/authorizeRequest';
import healthRoutes from './routes/health';
import identityRoutes from './modules/identity/identity.routes';
import branchRoutes from './modules/branch/branch.routes';
import staffRoutes from './modules/staff/staff.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import customerRoutes from './modules/customer/customer.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import cartRoutes from './modules/cart/cart.routes';
import orderRoutes from './modules/order/order.routes';
import bookingRoutes from './modules/booking/booking.routes';
import executionRoutes from './modules/execution/execution.routes';
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
    validateSecurity: {
      handlers: {
        bearerAuth: (req, scopes, schema) => {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
          const token = authHeader.split(' ')[1];
          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, config.jwt.accessSecret);
            req.actor = {
              id: decoded.id,
              systemRole: decoded.systemRole,
              staffSubRole: decoded.staffSubRole,
              assignedBranchIds: decoded.assignedBranchIds || [],
              authorizedBranchIds: decoded.authorizedBranchIds || []
            };
            return true;
          } catch (e) {
            return false;
          }
        },
        guestLookupToken: (req, scopes, schema) => {
          // TODO: Implement actual guest token verification logic
          return true;
        }
      }
    }
  })
);

// Apply Role-based Authorization from OpenAPI x-authz extension
app.use(authorizeRequest);

// Routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', identityRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/carts', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/appointments', bookingRoutes);
app.use('/api/v1/execution', executionRoutes);

// Catch 404
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
