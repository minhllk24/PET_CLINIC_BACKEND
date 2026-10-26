import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import config from '../src/shared/config';
import Customer from '../src/modules/customer/models/Customer';
import User from '../src/models/User';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';

const branch1 = '507f1f77bcf86cd799439011';
const branch2 = '507f1f77bcf86cd799439012';

const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const receptionistId = '507f1f77bcf86cd799439004';
const customerUserId = '507f1f77bcf86cd799439003';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branch1], authorizedBranchIds: [branch1] },
  config.jwt.accessSecret
);

const managerToken = jwt.sign(
  { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branch1], authorizedBranchIds: [branch1] },
  config.jwt.accessSecret
);

const receptionistToken = jwt.sign(
  { id: receptionistId, systemRole: 'STAFF', staffSubRole: 'RECEPTIONIST', assignedBranchIds: [branch1], authorizedBranchIds: [branch1] },
  config.jwt.accessSecret
);

const customerToken = jwt.sign(
  { id: customerUserId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

describe('Task 4.5 P1: Customer Account Management Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validCustomerId = '507f1f77bcf86cd799439070';

  describe('1. Customer List & Scoping (GET /admin/customers)', () => {
    it('lists customers with search and status filters for Admin', async () => {
      const mockCustomers = [
        {
          _id: new mongoose.Types.ObjectId(validCustomerId),
          userId: {
            _id: new mongoose.Types.ObjectId(customerUserId),
            fullName: 'Nguyen Van A',
            email: 'vana@example.com',
            status: 'ACTIVE',
            lastLogin: new Date(),
          },
          contactPhone: '0901234567',
          activationStatus: 'ACTIVATED',
          accountStatus: 'ACTIVE',
          createdAt: new Date(),
        }
      ];

      jest.spyOn(Customer, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockCustomers),
      });

      const res = await request(app)
        .get('/api/v1/admin/customers?activationStatus=ACTIVATED&accountStatus=ACTIVE&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].activationStatus).toBe('ACTIVATED');
      expect(res.body.items[0].accountStatus).toBe('ACTIVE');
      expect(res.body.items[0].fullName).toBe('Nguyen Van A');
    });

    it('filters customers by branch activity for Manager', async () => {
      const mockCustomers = [
        {
          _id: new mongoose.Types.ObjectId(validCustomerId),
          activationStatus: 'NO_ACCOUNT',
          accountStatus: 'ACTIVE',
          activityBranchIds: [new mongoose.Types.ObjectId(branch1)],
          createdAt: new Date(),
        }
      ];

      jest.spyOn(Customer, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockCustomers),
      });

      const res = await request(app)
        .get('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].activationStatus).toBe('NO_ACCOUNT');
      expect(res.body.items[0].accountStatus).toBeNull(); // null for NO_ACCOUNT
    });

    it('rejects Receptionist trying to list customers (Manager/Admin only)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/customers')
        .set('Authorization', `Bearer ${receptionistToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('2. Customer Detail (GET /admin/customers/:id)', () => {
    it('retrieves customer detail with user info', async () => {
      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(validCustomerId),
        userId: {
          _id: new mongoose.Types.ObjectId(customerUserId),
          fullName: 'Tran Thi B',
          email: 'thib@example.com',
          status: 'ACTIVE',
          lastLogin: new Date(),
        },
        contactPhone: '0912345678',
        activationStatus: 'ACTIVATED',
        accountStatus: 'ACTIVE',
        activityBranchIds: [new mongoose.Types.ObjectId(branch1)],
        createdAt: new Date(),
      };

      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCustomer),
      });

      const res = await request(app)
        .get(`/api/v1/admin/customers/${validCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe('Tran Thi B');
      expect(res.body.activationStatus).toBe('ACTIVATED');
      expect(res.body.accountStatus).toBe('ACTIVE');
    });

    it('returns 404 if customer not found', async () => {
      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const res = await request(app)
        .get(`/api/v1/admin/customers/${validCustomerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('3. Block & Unblock Invariants (POST /admin/customers/:id/block & unblock)', () => {
    it('allows Admin to block customer and keeps activationStatus unchanged', async () => {
      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(validCustomerId),
        userId: new mongoose.Types.ObjectId(customerUserId),
        activationStatus: 'ACTIVATED',
        accountStatus: 'ACTIVE',
        auditHistory: [],
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCustomer),
      });
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const res = await request(app)
        .post(`/api/v1/admin/customers/${validCustomerId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'block-cust-001')
        .send({ reason: 'Spam đặt hẹn và hủy liên tục' });

      expect(res.status).toBe(200);
      expect(mockCustomer.accountStatus).toBe('BLOCKED');
      expect(mockCustomer.activationStatus).toBe('ACTIVATED'); // Invariant: activationStatus NOT changed
      expect(mockCustomer.blockReason).toBe('Spam đặt hẹn và hủy liên tục');
      expect(mockCustomer.auditHistory).toHaveLength(1);
      expect(mockCustomer.auditHistory[0].action).toBe('BLOCKED');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(mockCustomer.userId, { status: 'BLOCKED' });
    });

    it('rejects Manager attempting to block customer (Admin only)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${validCustomerId}/block`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'block-cust-002')
        .send({ reason: 'Unauthorized block attempt' });

      expect(res.status).toBe(403);
    });

    it('allows Admin to unblock customer and restores ACTIVE accountStatus', async () => {
      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(validCustomerId),
        userId: new mongoose.Types.ObjectId(customerUserId),
        activationStatus: 'ACTIVATED',
        accountStatus: 'BLOCKED',
        blockReason: 'Spam',
        auditHistory: [{ action: 'BLOCKED', reason: 'Spam' }],
        createdAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockCustomer),
      });
      jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue({});

      const res = await request(app)
        .post(`/api/v1/admin/customers/${validCustomerId}/unblock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'unblock-cust-001')
        .send({ reason: 'Khách hàng cam kết tuân thủ' });

      expect(res.status).toBe(200);
      expect(mockCustomer.accountStatus).toBe('ACTIVE');
      expect(mockCustomer.activationStatus).toBe('ACTIVATED'); // Invariant: activationStatus preserved
      expect(mockCustomer.blockReason).toBeNull();
      expect(mockCustomer.auditHistory).toHaveLength(2);
      expect(mockCustomer.auditHistory[1].action).toBe('UNBLOCKED');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(mockCustomer.userId, { status: 'ACTIVE' });
    });

    it('rejects block without a reason', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${validCustomerId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'block-cust-003')
        .send({ reason: '' });

      expect(res.status).toBe(400);
    });
  });
});
