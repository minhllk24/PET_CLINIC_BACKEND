import request from 'supertest';
import app from '../src/app';

describe('Health Check API', () => {
  it('GET /api/v1/health should return 200 OK and correct payload', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'UP');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/sai-duong-dan should return 404', async () => {
    const res = await request(app).get('/api/v1/sai-duong-dan');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body).toHaveProperty('type', 'https://httpstatuses.com/404');
  });
});
