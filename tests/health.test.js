import request from 'supertest';
import app from '../src/app';
import mongoose from 'mongoose';

describe('Foundation Verification Tests', () => {
  it('GET /api/v1/health should return 200 OK and UP', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'UP');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/health/ready should return 503 when DB disconnected', async () => {
    // DB is disconnected by default in tests
    const res = await request(app).get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('code', 'INTERNAL_ERROR');
    expect(res.body).toHaveProperty('title', 'Service Unavailable');
  });

  it('GET /api/v1/health/ready should return 200 when DB connected', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', { get: () => 1, configurable: true });
    const res = await request(app).get('/api/v1/health/ready');
    Object.defineProperty(mongoose.connection, 'readyState', { get: () => 0, configurable: true });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ready');
  });

  it('GET /api/v1/sai-duong-dan should return 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/v1/sai-duong-dan');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body).toHaveProperty('correlationId');
  });

  it('GET /api/v1/auth/me should return 401 AUTHENTICATION_ERROR when no token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('code', 'AUTHENTICATION_ERROR');
    expect(res.body).toHaveProperty('correlationId');
    expect(res.body.title).toBe('Unauthorized');
  });

  it('POST /api/v1/auth/login should return 400 VALIDATION_ERROR on missing fields', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBeTruthy();
  });

  it('POST /api/v1/auth/login should return 400 VALIDATION_ERROR on extra fields', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@petclinic.com',
      password: 'password',
      extraField: 'should not be here'
    });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('Should return 403 AUTHORIZATION_ERROR for disallowed CORS origin', async () => {
    const res = await request(app).get('/api/v1/health').set('Origin', 'http://hacker.com');
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('code', 'AUTHORIZATION_ERROR');
  });

  it('Should return 413 VALIDATION_ERROR for payload > 1MB', async () => {
    // Generate a 1.5MB payload
    const largeString = 'a'.repeat(1.5 * 1024 * 1024);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
      email: 'admin@petclinic.com',
      password: 'password',
      largeString
    });
    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('Should return 429 RATE_LIMIT after max requests', async () => {
    // Making 100 requests (the limit)
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(request(app).get('/api/v1/health'));
    }
    await Promise.all(requests);
    
    // The 101st request should fail
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('code', 'RATE_LIMIT');
    expect(res.body).toHaveProperty('correlationId');
  });
});
