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
    resetSecret: process.env.JWT_RESET_TOKEN_SECRET || process.env.JWT_ACCESS_TOKEN_SECRET,
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  email: {
    user: process.env.EMAIL_APP || '',
    password: process.env.EMAIL_APP_PASSWORD || '',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
  },
  cors: {
    // Only allow specific Angular / Frontend origins as per doc 13
    allowedOrigins: [
      process.env.CUSTOMER_APP_URL || 'http://localhost:3000',
      process.env.ADMIN_APP_URL || 'http://localhost:3001',
      'http://localhost:4200',
    ],
  },
};

export default config;

