import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load variables from .env file
dotenv.config();

const requiredEnvs = [
  'MONGODB_URI',
  'JWT_ACCESS_TOKEN_SECRET',
  'JWT_REFRESH_TOKEN_SECRET',
];

const missingEnvs = requiredEnvs.filter((envName) => !process.env[envName]);

if (missingEnvs.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvs.join(', ')}`);
  process.exit(1);
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  mongoUri: process.env.MONGODB_URI,
  openapiSpecPath: process.env.OPENAPI_SPEC_PATH || (
    fs.existsSync(path.join(__dirname, '../../docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml'))
      ? path.join(__dirname, '../../docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml')
      : path.join(__dirname, '../../docs/07-openapi-v6.yaml')
  ),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_TOKEN_SECRET,
    refreshSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
    resetSecret: process.env.JWT_RESET_TOKEN_SECRET || process.env.JWT_ACCESS_TOKEN_SECRET,
  },
  cors: {
    // Allowed origins: Localhost, Vercel deployments, custom production domains
    allowedOrigins: [
      process.env.CUSTOMER_APP_URL || 'http://localhost:3000',
      process.env.ADMIN_APP_URL || 'http://localhost:3001',
      'http://localhost:4200',
      'https://drpetshouse.lat',
      'https://www.drpetshouse.lat',
      ...(process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
        : []),
    ],
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins default
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};

if (!fs.existsSync(config.openapiSpecPath)) {
  console.error(`OpenAPI spec not found at path: ${config.openapiSpecPath}`);
  process.exit(1);
}

export default config;
