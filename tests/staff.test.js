import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';
import * as staffService from '../src/modules/staff/staff.service';

const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const customerId = '507f1f77bcf86cd799439003';
const staffUserId = '507f1f77bcf86cd799439005';
const branchId = '507f1f77bcf86cd799439011';
const otherBranchId = '507f1f77bcf86cd799439012';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const managerToken = jwt.sign(
  { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

describe('Staff Management Suite (BE-05 & T10, T17)', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Model & DTO Guardrails', () => {
    it('formatStaff serializes StaffProfile conforming to OpenAPI schema', () => {
      const mockProfile = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439050'),
        staffSubRole: 'VETERINARIAN',
        status: 'ACTIVE',
        authorizedBranchIds: [new mongoose.Types.ObjectId(branchId)],
        homeBranchId: new mongoose.Types.ObjectId(branchId),
        userId: {
          _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439051'),
          fullName: 'Bác sĩ A',
          email: 'bs.a@clinic.com',
        },
      };

      const dto = staffService.formatStaff(mockProfile);
      expect(dto.id).toBe('507f1f77bcf86cd799439050');
      expect(dto.userId).toBe('507f1f77bcf86cd799439051');
      expect(dto.fullName).toBe('Bác sĩ A');
      expect(dto.staffSubRole).toBe('VETERINARIAN');
      expect(dto.status).toBe('ACTIVE');
      expect(dto.authorizedBranchIds).toContain(branchId);
      expect(dto.homeBranchId).toBe(branchId);
    });
  });

  describe('2. RBAC & REST Endpoints', () => {
    it('GET /api/v1/staff rejects Customer with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/staff returns list for Admin conforming to StaffPage schema', async () => {
      const mockProfile = {
        _id: new mongoose.Types.ObjectId(),
        staffSubRole: 'RECEPTIONIST',
        status: 'ACTIVE',
        authorizedBranchIds: [new mongoose.Types.ObjectId(branchId)],
        homeBranchId: new mongoose.Types.ObjectId(branchId),
        userId: {
          _id: new mongoose.Types.ObjectId(),
          fullName: 'Lễ tân B',
        },
      };

      jest.spyOn(staffService, 'listStaff').mockResolvedValue({
        items: [staffService.formatStaff(mockProfile)],
        nextCursor: null,
      });

      const res = await request(app)
        .get('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].staffSubRole).toBe('RECEPTIONIST');
      expect(res.body.items[0].fullName).toBe('Lễ tân B');
      expect(res.body.nextCursor).toBeNull();
    });

    it('POST /api/v1/staff creates new staff user + profile atomically for Admin', async () => {
      const mockResult = {
        id: '507f1f77bcf86cd799439060',
        userId: '507f1f77bcf86cd799439061',
        fullName: 'Bác sĩ C',
        staffSubRole: 'VETERINARIAN',
        status: 'ACTIVE',
        authorizedBranchIds: [branchId],
        homeBranchId: branchId,
      };

      jest.spyOn(staffService, 'createStaff').mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'test-staff-create-001')
        .send({
          fullName: 'Bác sĩ C',
          email: 'bsc@clinic.com',
          phone: '0912345678',
          staffSubRole: 'VETERINARIAN',
          homeBranchId: branchId,
          authorizedBranchIds: [branchId],
        });

      expect(res.status).toBe(201);
      expect(res.body.fullName).toBe('Bác sĩ C');
      expect(res.body.staffSubRole).toBe('VETERINARIAN');
      expect(res.body.authorizedBranchIds).toContain(branchId);
    });

    it('POST /api/v1/staff allows creating only-text staff without email and phone', async () => {
      const mockResult = {
        id: '507f1f77bcf86cd799439070',
        userId: '507f1f77bcf86cd799439071',
        fullName: 'Y tá E',
        staffSubRole: 'NURSE',
        status: 'ACTIVE',
        authorizedBranchIds: [branchId],
        homeBranchId: branchId,
        credentials: {
          username: 'nur_ytae102',
          password: 'mock_strong_password',
        },
      };

      jest.spyOn(staffService, 'createStaff').mockResolvedValue(mockResult);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'test-staff-create-no-email')
        .send({
          fullName: 'Y tá E',
          staffSubRole: 'NURSE',
          homeBranchId: branchId,
          authorizedBranchIds: [branchId],
        });

      expect(res.status).toBe(201);
      expect(res.body.fullName).toBe('Y tá E');
      expect(res.body.staffSubRole).toBe('NURSE');
      expect(res.body).toHaveProperty('credentials');
      expect(res.body.credentials).toHaveProperty('username');
    });

    it('POST /api/v1/staff rejects Manager assigning branch outside managed branches', async () => {
      await expect(
        staffService.createStaff(
          {
            fullName: 'Bác sĩ D',
            email: 'bsd@clinic.com',
            staffSubRole: 'VETERINARIAN',
            homeBranchId: otherBranchId,
            authorizedBranchIds: [otherBranchId],
          },
          { systemRole: 'MANAGER', assignedBranchIds: [branchId] }
        )
      ).rejects.toThrow('Cannot assign staff home branch outside managed branches');
    });
  });
});
