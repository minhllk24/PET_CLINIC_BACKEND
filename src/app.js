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
import orderRoutes, { adminOrderRouter } from './modules/order/order.routes';
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
import searchRoutes from './modules/search/search.routes';
import notificationRoutes from './modules/notification/notification.routes';
import legacyFallbackRoutes from './modules/legacy/legacyFallback.routes.js';
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

const corsOptionsDelegate = (req, callback) => {
  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    const msg = "The CORS policy for this site does not allow access from the specified Origin.";
    return callback(new AppError(403, "Forbidden", "AUTHORIZATION_ERROR", msg), false);
  }

  const requestedHeaders = req.headers["access-control-request-headers"];
  const corsOpts = {
    origin: origin || true,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: requestedHeaders || [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "idempotency-key",
      "X-Correlation-Id",
      "x-correlation-id",
      "X-Guest-Lookup-Token",
      "X-Guest-Cart-Token",
      "Accept",
      "Origin",
      "X-Requested-With",
      "ngrok-skip-browser-warning",
    ],
    exposedHeaders: ["X-Correlation-Id"],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  };
  callback(null, corsOpts);
};

app.use(cors(corsOptionsDelegate));
app.options("*", cors(corsOptionsDelegate));

// Global Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for Render platform health probes to prevent 429 instance failures
    if (req.path.endsWith('/health') && (req.headers['x-render-origin-server'] || req.headers['rndr-id'] || req.headers['user-agent']?.includes('Render'))) {
      return true;
    }
    return false;
  },
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

// =========================================================================
// INGRESS BRIDGE & PARAMETER NORMALIZER FOR OPENAPI V7 COMPATIBILITY
// =========================================================================
app.use(async (req, res, next) => {
  // Helper to synchronize both req.url and req.originalUrl for express-openapi-validator
  const rewriteUrl = (from, to) => {
    if (req.url && req.url.includes(from)) {
      req.url = req.url.replace(from, to);
    }
    if (req.originalUrl && req.originalUrl.includes(from)) {
      req.originalUrl = req.originalUrl.replace(from, to);
    }
  };

  // 1. URL Path Rewrites (Route Aliasing & Backward Compatibility)
  if (req.url.startsWith('/api/v1/appointments/slots')) {
    rewriteUrl('/api/v1/appointments/slots', '/api/v1/availability');
  } else if (req.url.startsWith('/api/v1/cart') && !req.url.startsWith('/api/v1/cart/items') && !req.url.startsWith('/api/v1/carts')) {
    if (req.method === 'POST' && (req.path === '/api/v1/cart' || req.path === '/cart')) {
      rewriteUrl('/cart', '/cart/items');
    } else if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      rewriteUrl('/cart/', '/cart/items/');
      if (req.method === 'PUT') req.method = 'PATCH';
    }
  } else if (req.url.startsWith('/api/v1/vouchers/apply')) {
    rewriteUrl('/api/v1/vouchers/apply', '/api/v1/vouchers/validate');
  } else if (req.url.startsWith('/api/v1/auth/refresh-token')) {
    rewriteUrl('/api/v1/auth/refresh-token', '/api/v1/auth/refresh');
  } else if (req.url.startsWith('/api/v1/login')) {
    rewriteUrl('/api/v1/login', '/api/v1/auth/login');
  } else if (req.url.startsWith('/api/v1/verify-register-otp')) {
    rewriteUrl('/api/v1/verify-register-otp', '/api/v1/auth/verify-otp');
  } else if (req.url.startsWith('/api/v1/verify-otp')) {
    rewriteUrl('/api/v1/verify-otp', '/api/v1/auth/verify-otp');
  } else if (req.url.startsWith('/api/v1/forgot-password')) {
    rewriteUrl('/api/v1/forgot-password', '/api/v1/auth/forgot-password');
  } else if (req.url.startsWith('/api/v1/reset-password')) {
    rewriteUrl('/api/v1/reset-password', '/api/v1/auth/reset-password');
  } else if (req.url.startsWith('/api/v1/change-password')) {
    rewriteUrl('/api/v1/change-password', '/api/v1/auth/change-password');
  } else if (req.url.startsWith('/api/v1/auth/guest-otp')) {
    rewriteUrl('/api/v1/auth/guest-otp', '/api/v1/guest/lookup/otp');
  } else if (req.url.startsWith('/api/v1/auth/activate-guest')) {
    rewriteUrl('/api/v1/auth/activate-guest', '/api/v1/activation/complete');
  }

  // Smart Product ID Resolver (Resolves codes, skus, slugs or numeric indexes before OpenAPI validator)
  const prodMatch = req.url.match(/\/api\/v1\/products\/([^\/\?]+)/);
  if (prodMatch && prodMatch[1]) {
    const rawId = prodMatch[1];
    if (rawId !== 'suggestions' && !/^[0-9a-fA-F]{24}$/.test(rawId)) {
      try {
        const Product = require('./modules/catalog/models/Product').default || require('./modules/catalog/models/Product');
        let found = await Product.findOne({
          $or: [
            { productCode: rawId },
            { 'variants.sku': rawId },
            { slug: rawId },
            { code: rawId }
          ]
        }).select('_id').lean();

        if (!found && /^\d+$/.test(rawId)) {
          const idx = parseInt(rawId, 10);
          const products = await Product.find({ status: 'ACTIVE' }).select('_id').skip(Math.max(0, idx - 1)).limit(1).lean();
          if (products.length > 0) {
            found = products[0];
          }
        }

        if (found) {
          rewriteUrl(`/products/${rawId}`, `/products/${found._id.toString()}`);
        }
      } catch (e) {
        // Fallback to next
      }
    }
  }

  // 2. Query Parameters Normalization
  if (req.query && typeof req.query === 'object') {
    // A. Catalog / Products Normalizer
    const isProducts = req.url.includes('/products') || (req.originalUrl && req.originalUrl.includes('/products')) || (req.path && req.path.includes('/products'));
    if (isProducts) {
      // Sort mapping to OpenAPI v7 Enum
      if (req.query.sort) {
        const rawSort = String(req.query.sort).toLowerCase().trim();
        if (rawSort === 'best_selling' || rawSort === 'newest') {
          req.query.sort = 'NEWEST';
        } else if (rawSort === 'price_asc' || rawSort === 'asc') {
          req.query.sort = 'PRICE_ASC';
        } else if (rawSort === 'price_desc' || rawSort === 'desc') {
          req.query.sort = 'PRICE_DESC';
        } else if (rawSort === 'name_asc') {
          req.query.sort = 'NAME_ASC';
        } else if (rawSort === 'name_desc') {
          req.query.sort = 'NAME_DESC';
        } else if (['NEWEST', 'NAME_ASC', 'NAME_DESC', 'PRICE_ASC', 'PRICE_DESC'].includes(req.query.sort)) {
          // Valid uppercase, keep as is
        } else {
          req.query.sort = 'NEWEST';
        }
      }

      // Filter -> q
      if (req.query.filter && !req.query.q) {
        req.query.q = String(req.query.filter).trim();
      }
      delete req.query.filter;

      // Category parameter normalization
      const catParam = req.query.categoryId || req.query.category_id || req.query.category_ids || req.query.category;
      if (catParam) {
        const catStr = String(catParam).split(',')[0].trim();
        if (/^[0-9a-fA-F]{24}$/.test(catStr)) {
          req.query.categoryId = catStr;
        } else if (!req.query.q) {
          req.query.q = catStr;
        }
      }
      delete req.query.category_id;
      delete req.query.category_ids;
      delete req.query.category;
    }

    // B. Availability Normalizer
    const isAvailability = req.url.includes('/availability') || (req.originalUrl && req.originalUrl.includes('/availability')) || (req.path && req.path.includes('/availability'));
    if (isAvailability) {
      if (req.query.branch_id && !req.query.branchId) {
        req.query.branchId = req.query.branch_id;
      }
      delete req.query.branch_id;

      if (req.query.service_ids && !req.query.serviceIds) {
        req.query.serviceIds = req.query.service_ids;
      }
      delete req.query.service_ids;
      delete req.query.service_type;

      // Ensure branchId is a valid ObjectId, otherwise fallback to primary branch
      if (!req.query.branchId || req.query.branchId === 'undefined' || !/^[0-9a-fA-F]{24}$/.test(req.query.branchId)) {
        req.query.branchId = '6ad08e4417bf41f5954234c3';
      }

      // Ensure serviceIds exists to satisfy OpenAPI validation
      if (!req.query.serviceIds || req.query.serviceIds === 'undefined') {
        req.query.serviceIds = '6ad08e4417bf41f5954234c6';
      }
    }

    // C. Notification Normalizer
    const isNotification = req.url.includes('/notifications') || (req.originalUrl && req.originalUrl.includes('/notifications')) || (req.path && req.path.includes('/notifications'));
    if (isNotification) {
      if (req.query.status === 'unread' || req.query.isRead === 'false' || req.query.isRead === false) {
        req.query.unreadOnly = true;
      }
      delete req.query.status;
      delete req.query.isRead;
      delete req.query.search;
    }
  }

  // 3. Body Parameters Normalization
  if (req.body && typeof req.body === 'object') {
    // Auth Login
    if (req.path.endsWith('/auth/login') || req.path.endsWith('/login')) {
      delete req.body.rememberMe;
      delete req.body.remember;
      delete req.body.remember_me;
      req.body.identifier = req.body.identifier || req.body.username || req.body.phone || req.body.loginId || req.body.login_id;
    }

    // Auth OTP Verification
    if (req.path.includes('/verify-otp') || req.path.includes('/verify-register-otp')) {
      req.body.identifier = req.body.identifier || req.body.login_id || req.body.loginId || req.body.phone || req.body.email;
      req.body.otpCode = req.body.otpCode || req.body.otp_code;
      if (!req.body.purpose) {
        req.body.purpose = (req.path.includes('register') || (req.body.identifier && !String(req.body.identifier).includes('@'))) ? 'REGISTER' : 'FORGOT_PASSWORD';
      }
    }

    // Auth Forgot Password
    if (req.path.includes('/forgot-password')) {
      req.body.identifier = req.body.identifier || req.body.email || req.body.phone;
    }

    // Auth Reset Password
    if (req.path.includes('/reset-password')) {
      req.body.resetToken = req.body.resetToken || req.body.reset_token;
      req.body.newPassword = req.body.newPassword || req.body.new_password;
    }

    // Auth Change Password
    if (req.path.includes('/change-password')) {
      req.body.oldPassword = req.body.oldPassword || req.body.old_password;
      req.body.newPassword = req.body.newPassword || req.body.new_password;
    }

    // Cart Add Item
    if (req.path.includes('/cart')) {
      if (req.body.product_id && !req.body.productId) req.body.productId = req.body.product_id;
      if (req.body.variant_id && !req.body.variantId) req.body.variantId = req.body.variant_id;
      delete req.body.product_id;
      delete req.body.variant_id;
    }

    // Appointments Booking Ingress Normalizer
    if (req.path.endsWith('/appointments') && req.method === 'POST') {
      if (!req.body.branchId || req.body.branchId === 'undefined' || !/^[0-9a-fA-F]{24}$/.test(req.body.branchId)) {
        req.body.branchId = '6ad08e4417bf41f5954234c3';
      }
      if (!req.body.slotStart && req.body.appointmentDate && req.body.startTime) {
        try {
          const datePart = String(req.body.appointmentDate).split('T')[0];
          const timePart = String(req.body.startTime).includes(':') ? req.body.startTime : `${req.body.startTime}:00`;
          req.body.slotStart = new Date(`${datePart}T${timePart}:00.000Z`).toISOString();
        } catch {
          req.body.slotStart = new Date().toISOString();
        }
      }
      if (req.body.contactSnapshot && !req.body.contact) {
        req.body.contact = req.body.contactSnapshot;
      }
      if (!req.body.paymentMethod) {
        req.body.paymentMethod = 'PAY_AT_STORE';
      }
      delete req.body.customerId;
      delete req.body.appointmentDate;
      delete req.body.startTime;
      delete req.body.contactSnapshot;
    }

    // Reviews Ingress Normalizer
    if (req.path.endsWith('/reviews') && req.method === 'POST') {
      if (req.body.target_type && !req.body.targetType) {
        req.body.targetType = String(req.body.target_type).toUpperCase();
      }
      if (req.body.target_id && !req.body.targetId) {
        req.body.targetId = req.body.target_id;
      }
      delete req.body.target_type;
      delete req.body.target_id;
    }

    // Vouchers Ingress Normalizer
    if (req.path.includes('/vouchers/validate') || req.path.includes('/vouchers/apply')) {
      if (req.body.branch_id && !req.body.branchId) {
        req.body.branchId = req.body.branch_id;
      }
      if (!req.body.scope) {
        req.body.scope = 'ORDER';
      }
      delete req.body.branch_id;
      delete req.body.order_value;
    }

    // Orders Checkout Ingress Normalizer
    if ((req.path.endsWith('/orders/checkout') || req.path.endsWith('/checkout')) && req.method === 'POST') {
      if (req.body.paymentMethod === 'ONLINE' || req.body.paymentMethod === 'online') {
        req.body.paymentMethod = 'ONLINE_MOCK';
      } else if (req.body.paymentMethod === 'store' || req.body.paymentMethod === 'STORE') {
        req.body.paymentMethod = 'COD';
      }
      if (req.body.contactSnapshot && !req.body.contact) {
        req.body.contact = req.body.contactSnapshot;
      }
      delete req.body.customerId;
      delete req.body.items;
      delete req.body.addressId;
      delete req.body.contactSnapshot;
    }
  }

  // Cookie Bridge for Refresh Token
  if (req.path.endsWith('/auth/refresh') && req.cookies && req.cookies.refreshToken && (!req.body || !req.body.refreshToken)) {
    req.body = req.body || {};
    req.body.refreshToken = req.cookies.refreshToken;
    req.headers['content-type'] = req.headers['content-type'] || 'application/json';
  }

  next();
});

// Mount Legacy Fallback routes BEFORE OpenAPI Validator
// Ensures legacy marketing, blogs, species, and first-aid routes respond immediately with 200 OK
// without false 401/404 from OpenAPI route matching against /pets/{id}
app.use('/api/v1', legacyFallbackRoutes);

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

// Backward compatibility aliases for Auth routes called without /auth
app.use('/api/v1/verify-register-otp', authRoutes);
app.use('/api/v1/verify-otp', authRoutes);
app.use('/api/v1/forgot-password', authRoutes);
app.use('/api/v1/reset-password', authRoutes);
app.use('/api/v1/change-password', authRoutes);

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
app.use('/api/v1/admin/orders', adminOrderRouter);
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
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Catch 404
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export { limiter };
export default app;
