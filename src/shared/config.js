import dotenv from 'dotenv';

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
  jwt: {
    accessSecret: process.env.JWT_ACCESS_TOKEN_SECRET,
    refreshSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
  },
  cors: {
    // Only allow specific Angular origins as per doc 13
    allowedOrigins: [
      process.env.CUSTOMER_APP_URL || 'http://localhost:3000',
      process.env.ADMIN_APP_URL || 'http://localhost:3001',
    ],
  },
};

export default config;
