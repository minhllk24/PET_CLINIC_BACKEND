import dotenv from 'dotenv';
import path from 'path';

// Use a distinct .env for tests if needed, or just set memory vars
process.env.NODE_ENV = 'test';
process.env.PORT = '8080';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test_db'; // Fake URI for testing validation
process.env.JWT_ACCESS_TOKEN_SECRET = 'test_access_secret';
process.env.JWT_REFRESH_TOKEN_SECRET = 'test_refresh_secret';
process.env.CUSTOMER_APP_URL = 'http://localhost:3000';
process.env.ADMIN_APP_URL = 'http://localhost:3001';
process.env.OPENAPI_SPEC_PATH = path.join(__dirname, '../docs/07-openapi-v6.yaml');
process.env.RATE_LIMIT_MAX = '100'; // Increase to allow all tests to pass
process.env.RATE_LIMIT_WINDOW_MS = '60000'; // 1 min
