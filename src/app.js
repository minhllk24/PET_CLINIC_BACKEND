import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as OpenApiValidator from 'express-openapi-validator';
import path from 'path';

import cookieParser from 'cookie-parser';
import config from './shared/config';
import { httpLogger } from './shared/logger';
import { errorHandler, notFoundHandler } from './shared/errorHandler';
import { authorizeRequest } from './shared/authorizeRequest';
import healthRoutes from './routes/health';
import authRoutes from './modules/auth/auth.routes.js';
import branchRoutes from './modules/branch/branch.routes';
import staffRoutes from './modules/staff/staff.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import customerRoutes from './modules/customer/customer.routes';
import guestRoutes, { activationRouter } from './modules/customer/guest.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import cartRoutes from './modules/cart/cart.routes';
import orderRoutes from './modules/order/order.routes';
import checkoutRoutes from './modules/order/checkout.routes';
import bookingRoutes from './modules/booking/booking.routes';
import bookingRefundRoutes from './modules/booking/bookingRefund.routes';
import availabilityRoutes from './modules/booking/availability.routes';
import executionRoutes from './modules/execution/execution.routes';
import uploadRoutes from './modules/upload/upload.routes';
import voucherRoutes from './modules/order/voucher.routes';
import { returnRouter, refundRouter } from './modules/order/return.routes';
import internalBookingRoutes from './modules/booking/internalBooking.routes';
import shiftRoutes from './modules/staff/shift.routes';
import reviewRoutes from './modules/review/review.routes';
import feedbackRoutes from './modules/review/feedback.routes';
import AppError from './utils/AppError';

const app = express();

// Trust reverse proxy (Render, Cloudflare, load balancers)
app.set('trust proxy', 1);

// Logging should be first to capture all requests and assign req.id
app.use(httpLogger);

// Security middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})); // Sets various HTTP headers like X-Content-Type-Options

// CORS Configuration (Allowlist from env, custom domains drpetshouse.lat, + all *.vercel.app deployments)
const normalizeOrigin = (url) => (url ? url.trim().replace(/\/+$/, '') : '');

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const cleanOrigin = normalizeOrigin(origin);

  // Allow localhost & explicitly configured origins in config
  const isExplicitlyAllowed = config.cors.allowedOrigins.some(
    (allowed) => normalizeOrigin(allowed) === cleanOrigin
  );
  if (isExplicitlyAllowed) return true;

  try {
    const parsed = new URL(cleanOrigin);
    // Allow any Vercel domain (production & preview branches: e.g. *.vercel.app)
    if (parsed.hostname.endsWith('.vercel.app') || parsed.hostname === 'vercel.app') {
      return true;
    }
    // Allow production custom domain drpetshouse.lat and any subdomains (e.g. www.drpetshouse.lat)
    if (parsed.hostname === 'drpetshouse.lat' || parsed.hostname.endsWith('.drpetshouse.lat')) {
      return true;
    }
    // Allow local development hostnames
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return true;
    }
  } catch (e) {
    return false;
  }

  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (!isOriginAllowed(origin)) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new AppError(403, 'Forbidden', 'AUTHORIZATION_ERROR', msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Correlation-Id',
    'X-Guest-Lookup-Token',
    'X-Guest-Cart-Token',
    'Accept',
    'Origin',
    'X-Requested-With',
  ],
  exposedHeaders: ['X-Correlation-Id'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
app.use(cookieParser());

// Bridge & Sanitizer for OpenAPI validation compatibility
app.use((req, res, next) => {
  // Bridge: If refresh token is provided via HttpOnly Cookie, auto-populate body for OpenAPI validator
  if (req.path.endsWith('/auth/refresh') && req.cookies && req.cookies.refreshToken && (!req.body || !req.body.refreshToken)) {
    req.body = req.body || {};
    req.body.refreshToken = req.cookies.refreshToken;
    req.headers['content-type'] = req.headers['content-type'] || 'application/json';
  }

  // Sanitizer: Remove client-side UI flags (e.g. rememberMe) from /auth/login so strict OpenAPI additionalProperties: false doesn't reject
  if (req.path.endsWith('/auth/login') && req.body && typeof req.body === 'object') {
    if ('rememberMe' in req.body) {
      delete req.body.rememberMe;
    }
    if (!req.body.identifier) {
      req.body.identifier = req.body.username || req.body.phone;
    }
  }

  next();
});

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
              fullName: decoded.fullName || decoded.name || null,
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
        },
        guestCartToken: (req) => {
          const token = req.headers['x-guest-cart-token'];
          return typeof token === 'string' && token.trim().length > 0;
        }
      }
    }
  })
);

// Apply Role-based Authorization from OpenAPI x-authz extension
app.use(authorizeRequest);

// Routes
// Root health/welcome route for Render / monitoring probes
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'UP',
    message: 'Pet Clinic API Backend is running',
    version: '1.0.0',
    documentation: '/docs',
    timestamp: new Date().toISOString(),
  });
});

// Universal Health Check endpoints for Render / Uptime monitors / Cloud probers
app.get(['/health', '/healthz'], (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/branches', branchRoutes);
app.use('/api/v1/staff', staffRoutes);
app.use('/api/v1', catalogRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/admin/customers', customerRoutes);
app.use('/api/v1/guest', guestRoutes);
app.use('/api/v1/activation', activationRouter);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/carts', cartRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1', checkoutRoutes);
app.use('/api/v1/appointments', bookingRoutes);
app.use('/api/v1/booking-refunds', bookingRefundRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/execution', executionRoutes);
app.use('/api/v1/service-records', executionRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/vouchers', voucherRoutes);
app.use('/api/v1/order-returns', returnRouter);
app.use('/api/v1/order-refunds', refundRouter);
app.use('/api/v1/internal', internalBookingRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/feedback', feedbackRoutes);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Catch 404
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
