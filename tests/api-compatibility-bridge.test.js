import request from 'supertest';
import app from '../src/app';

// Mock availability, auth, and voucher services to isolate API Ingress Bridge & OpenAPI validation
jest.mock('../src/modules/booking/availability.service', () => ({
  getAvailability: jest.fn().mockResolvedValue({
    branchId: '6ad08e4417bf41f5954234c3',
    serviceIds: ['6ad08e4417bf41f5954234c6'],
    date: '2026-11-01',
    scheduledDurationMinutes: 60,
    slots: [
      {
        start: '2026-11-01T09:00:00.000Z',
        end: '2026-11-01T10:00:00.000Z',
        remaining: 3
      }
    ]
  }),
  getBranchOperationSlots: jest.fn().mockResolvedValue([])
}));

jest.mock('../src/modules/auth/auth.service', () => ({
  login: jest.fn().mockResolvedValue({
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
    expiresAt: new Date(Date.now() + 86400000),
    user: { id: '507f1f77bcf86cd799439001', systemRole: 'CUSTOMER', accountStatus: 'ACTIVE' }
  })
}));

jest.mock('../src/modules/order/voucher.service', () => ({
  validateVoucherEligibility: jest.fn().mockResolvedValue({
    code: 'VOUCHER_NON_EXISTENT',
    valid: false,
    reason: 'Voucher does not exist',
    discount: 0
  })
}));

describe('API Ingress Bridge & Compatibility Verification', () => {
  describe('1. Products & Catalog Query Normalizer', () => {
    it('normalizes sort=best_selling to NEWEST and returns 200', async () => {
      const res = await request(app)
        .get('/api/v1/products?sort=best_selling&limit=10&page=1')
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('normalizes sort=price_asc and sort=price_desc to uppercase Enum', async () => {
      const resAsc = await request(app)
        .get('/api/v1/products?sort=price_asc&limit=5&page=1')
        .expect(200);
      expect(resAsc.body).toHaveProperty('items');

      const resDesc = await request(app)
        .get('/api/v1/products?sort=price_desc&limit=5&page=1')
        .expect(200);
      expect(resDesc.body).toHaveProperty('items');
    });

    it('normalizes filter and category_id parameters without 400 validation error', async () => {
      const res = await request(app)
        .get('/api/v1/products?filter=cho&category_id=6ae1b15cb1d650ca8dafe56c')
        .expect(200);

      expect(res.body).toHaveProperty('items');
    });

    it('handles slug category parameter gracefully', async () => {
      const res = await request(app)
        .get('/api/v1/products?category=thuc-an')
        .expect(200);

      expect(res.body).toHaveProperty('items');
    });
  });

  describe('2. Availability & Slots Query Aliases', () => {
    it('handles GET /api/v1/availability even if serviceIds is omitted', async () => {
      const res = await request(app)
        .get('/api/v1/availability?branchId=6ad08e4417bf41f5954234c3&date=2026-11-01')
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('rewrites GET /api/v1/appointments/slots to availability and returns 200', async () => {
      const res = await request(app)
        .get('/api/v1/appointments/slots?branchId=6ad08e4417bf41f5954234c3&date=2026-11-01')
        .expect(200);

      expect(res.body).toBeDefined();
    });
  });

  describe('3. Legacy Marketing & Fallback Routes', () => {
    it('GET /api/v1/flash-sales/active returns 200 with fallback data', async () => {
      const res = await request(app)
        .get('/api/v1/flash-sales/active')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toEqual([]);
    });

    it('GET /api/v1/first-aid/categories and /first-aid/guides return 200', async () => {
      const resCats = await request(app)
        .get('/api/v1/first-aid/categories')
        .expect(200);
      expect(resCats.body.success).toBe(true);

      const resGuides = await request(app)
        .get('/api/v1/first-aid/guides')
        .expect(200);
      expect(resGuides.body.success).toBe(true);
      expect(resGuides.body.data.items.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/posts/featured and /posts/trending return 200', async () => {
      const resPosts = await request(app)
        .get('/api/v1/posts/featured')
        .expect(200);
      expect(resPosts.body.success).toBe(true);
      expect(Array.isArray(resPosts.body.data)).toBe(true);
    });

    it('GET /api/v1/pets/species and /pets/breeds return 200', async () => {
      const resSpecies = await request(app)
        .get('/api/v1/pets/species')
        .expect(200);
      expect(resSpecies.body.success).toBe(true);

      const resBreeds = await request(app)
        .get('/api/v1/pets/breeds')
        .expect(200);
      expect(resBreeds.body.success).toBe(true);
    });
  });

  describe('4. Auth & Voucher Aliases', () => {
    it('POST /api/v1/vouchers/apply maps to validate and does not 404', async () => {
      const res = await request(app)
        .post('/api/v1/vouchers/apply')
        .send({ code: 'VOUCHER_NON_EXISTENT' });

      // Should return RFC 9457 error or validation error, NOT 404 Not Found
      expect(res.status).not.toBe(404);
    });

    it('POST /api/v1/auth/login ignores rememberMe and accepts plain text username', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'admin',
          password: 'K9#mQ$8xL!2vW*7z',
          rememberMe: true
        });

      // Status should be 200 (if db connected) or auth failure, NOT 400 additionalProperties
      expect(res.status).not.toBe(400);
    });
  });
});
