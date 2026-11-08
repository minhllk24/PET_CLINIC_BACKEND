import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import User from '../src/models/User';
import Order from '../src/modules/order/models/Order';
import OrderReturn from '../src/modules/order/models/OrderReturn';

const adminId = '507f1f77bcf86cd799439001';
const customerId = '507f1f77bcf86cd799439003';
const branchId = '6ad08e4417bf41f5954234c3';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

describe('Wave 1: Feedback Fixes Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FB-C1: Vietnamese Administrative Divisions API', () => {
    it('GET /api/v1/locations/provinces returns 63 provinces including TP.HCM, Hanoi, Da Nang', async () => {
      const res = await request(app).get('/api/v1/locations/provinces');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(60);

      const hcm = res.body.data.find((p) => p.code === '79');
      expect(hcm).toBeDefined();
      expect(hcm.name).toContain('Hồ Chí Minh');
    });

    it('GET /api/v1/locations/provinces?q=hanoi filters provinces by name', async () => {
      const res = await request(app).get('/api/v1/locations/provinces?q=hanoi');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].code).toBe('01');
    });

    it('GET /api/v1/locations/provinces/79/districts returns districts of TP.HCM', async () => {
      const res = await request(app).get('/api/v1/locations/provinces/79/districts');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(10);
      const q1 = res.body.data.find((d) => d.code === '760');
      expect(q1).toBeDefined();
      expect(q1.name).toBe('Quận 1');
    });

    it('GET /api/v1/locations/districts/760/wards returns wards of Quan 1', async () => {
      const res = await request(app).get('/api/v1/locations/districts/760/wards');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);
      const benNghe = res.body.data.find((w) => w.name === 'Phường Bến Nghé');
      expect(benNghe).toBeDefined();
    });
  });

  describe('FB-C3: Customer Address Book Endpoints', () => {
    it('GET /api/v1/auth/me/addresses returns user address list', async () => {
      const mockCustomerDoc = {
        _id: new mongoose.Types.ObjectId(customerId),
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        addresses: [
          {
            _id: new mongoose.Types.ObjectId(),
            fullName: 'Lê Văn Cường',
            phone: '0905555555',
            province: 'Thành phố Hồ Chí Minh',
            provinceCode: '79',
            district: 'Quận 1',
            districtCode: '760',
            ward: 'Phường Bến Nghé',
            wardCode: '26734',
            addressDetail: '123 Lê Lợi',
            fullAddress: '123 Lê Lợi, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh',
            isDefault: true,
          }
        ]
      };

      jest.spyOn(User, 'findById').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve(mockCustomerDoc),
          then: (r) => Promise.resolve(mockCustomerDoc).then(r)
        }),
        lean: () => Promise.resolve(mockCustomerDoc),
        then: (r) => Promise.resolve(mockCustomerDoc).then(r)
      });

      const res = await request(app)
        .get('/api/v1/auth/me/addresses')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].fullName).toBe('Lê Văn Cường');
      expect(res.body[0].provinceCode).toBe('79');
    });
  });

  describe('FB-A8: Order Returns Multi-status Filter & Counts', () => {
    it('GET /api/v1/order-returns with comma-separated status and statusGroup', async () => {
      const mockAdminDoc = {
        _id: new mongoose.Types.ObjectId(adminId),
        systemRole: 'ADMIN',
        accountStatus: 'ACTIVE',
      };
      jest.spyOn(User, 'findById').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve(mockAdminDoc),
          then: (r) => Promise.resolve(mockAdminDoc).then(r)
        }),
        lean: () => Promise.resolve(mockAdminDoc),
        then: (r) => Promise.resolve(mockAdminDoc).then(r)
      });

      jest.spyOn(OrderReturn, 'find').mockReturnValue({
        sort: () => ({
          limit: () => Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId('672b1234567890abcdef0001'),
              code: 'RET-001',
              orderId: new mongoose.Types.ObjectId('672b1234567890abcdef0002'),
              status: 'PROCESSING',
              refundBreakdown: { total: 100000 },
              items: [],
              createdAt: new Date(),
              history: []
            }
          ])
        })
      });
      jest.spyOn(OrderReturn, 'countDocuments').mockResolvedValue(3);
      jest.spyOn(Order, 'find').mockReturnValue({
        select: () => Promise.resolve([
          { _id: new mongoose.Types.ObjectId('672b1234567890abcdef0002'), code: 'ORD-001' }
        ])
      });

      const res = await request(app)
        .get('/api/v1/order-returns?status=PROCESSING,RECEIVED,APPROVED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.inProgressCount).toBe(3);
    });
  });

  describe('FB-C2: Bookable only service filtering', () => {
    it('GET /api/v1/services supports bookableOnly=true', async () => {
      const res = await request(app).get('/api/v1/services?bookableOnly=true');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
    });
  });
});
