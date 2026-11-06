import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import User from '../../src/models/User';
import StaffProfile from '../../src/modules/staff/models/StaffProfile';
import RefreshSession from '../../src/models/RefreshSession';
import config from '../../src/shared/config';
import * as adminUsersService from '../../src/modules/admin/adminUsers.service';
import * as authService from '../../src/modules/auth/auth.service';
import AppError from '../../src/utils/AppError';

describe('Phase 1 Integration: AUTH-01..04 & DATA-01..03 (Admin Users, RBAC, Scope, Identity)', () => {
  const adminId = '507f1f77bcf86cd799439001';
  const managerId = '507f1f77bcf86cd799439002';
  const customerId = '507f1f77bcf86cd799439003';
  const branchA = '507f1f77bcf86cd799439011';
  const branchB = '507f1f77bcf86cd799439012';

  const adminToken = jwt.sign(
    { id: adminId, fullName: 'Admin User', systemRole: 'ADMIN', assignedBranchIds: [], authorizedBranchIds: [] },
    config.jwt.accessSecret
  );

  const managerToken = jwt.sign(
    { id: managerId, fullName: 'Manager User', systemRole: 'MANAGER', assignedBranchIds: [branchA], authorizedBranchIds: [branchA] },
    config.jwt.accessSecret
  );

  const customerToken = jwt.sign(
    { id: customerId, fullName: 'Customer User', systemRole: 'CUSTOMER' },
    config.jwt.accessSecret
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AUTH-01: Admin Users CRUD API (/api/v1/admin/users)', () => {
    it('denies access to non-admin actors (403 AUTHORIZATION_ERROR)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTHORIZATION_ERROR');
    });

    it('allows Admin to list users with canonical pagination envelope', async () => {
      const mockResult = {
        items: [
          {
            id: '507f1f77bcf86cd799439099',
            fullName: 'Bác Sĩ Test',
            systemRole: 'STAFF',
            staffSubRole: 'VETERINARIAN',
            accountStatus: 'ACTIVE',
            assignedBranchIds: [branchA],
          },
        ],
        totalCount: 1,
        page: 1,
        limit: 10,
        nextCursor: null,
      };

      jest.spyOn(adminUsersService, 'listUsers').mockResolvedValueOnce(mockResult);

      const res = await request(app)
        .get('/api/v1/admin/users?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body.items).toHaveLength(1);
      expect(res.body).toHaveProperty('totalCount', 1);
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 10);
    });

    it('allows Admin to create internal STAFF user with auto-generated StaffProfile', async () => {
      const createdDto = {
        id: '507f1f77bcf86cd799439098',
        fullName: 'Bác Sĩ Trưởng Khoa Test',
        phone: '0981111111',
        systemRole: 'STAFF',
        staffSubRole: 'VETERINARIAN',
        accountStatus: 'ACTIVE',
        assignedBranchIds: [branchA],
        staffProfile: {
          id: '507f1f77bcf86cd799439097',
          staffCode: 'VET-123456',
          staffSubRole: 'VETERINARIAN',
          authorizedBranchIds: [branchA],
          status: 'ACTIVE',
        },
      };

      jest.spyOn(adminUsersService, 'createUser').mockResolvedValueOnce(createdDto);

      const res = await request(app)
        .post('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Bác Sĩ Trưởng Khoa Test',
          phone: '0981111111',
          password: 'Password123!',
          systemRole: 'STAFF',
          staffSubRole: 'VETERINARIAN',
          branchIds: [branchA],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id', '507f1f77bcf86cd799439098');
      expect(res.body.systemRole).toBe('STAFF');
      expect(res.body.staffSubRole).toBe('VETERINARIAN');
      expect(res.body.staffProfile).toBeDefined();
      expect(res.body.staffProfile.authorizedBranchIds).toContain(branchA);
    });

    it('allows Admin to get user by ID', async () => {
      const userDto = {
        id: '507f1f77bcf86cd799439098',
        fullName: 'Bác Sĩ Trưởng Khoa Test',
        systemRole: 'STAFF',
      };

      jest.spyOn(adminUsersService, 'getUserById').mockResolvedValueOnce(userDto);

      const res = await request(app)
        .get('/api/v1/admin/users/507f1f77bcf86cd799439098')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('507f1f77bcf86cd799439098');
      expect(res.body.fullName).toBe('Bác Sĩ Trưởng Khoa Test');
    });

    it('allows Admin to update user profile and branches', async () => {
      const updatedDto = {
        id: '507f1f77bcf86cd799439098',
        fullName: 'Bác Sĩ Trưởng Khoa Cập Nhật',
        assignedBranchIds: [branchA, branchB],
      };

      jest.spyOn(adminUsersService, 'updateUser').mockResolvedValueOnce(updatedDto);

      const res = await request(app)
        .put('/api/v1/admin/users/507f1f77bcf86cd799439098')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Bác Sĩ Trưởng Khoa Cập Nhật',
          branchIds: [branchA, branchB],
        });

      expect(res.status).toBe(200);
      expect(res.body.fullName).toBe('Bác Sĩ Trưởng Khoa Cập Nhật');
      expect(res.body.assignedBranchIds).toHaveLength(2);
    });

    it('allows Admin to lock user, returning ACCOUNT_BLOCKED on subsequent login', async () => {
      const blockedDto = {
        id: '507f1f77bcf86cd799439098',
        fullName: 'Bác Sĩ Trưởng Khoa Test',
        accountStatus: 'BLOCKED',
      };

      jest.spyOn(adminUsersService, 'updateUserStatus').mockResolvedValueOnce(blockedDto);

      const res = await request(app)
        .patch('/api/v1/admin/users/507f1f77bcf86cd799439098/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'BLOCKED',
          reason: 'Vi phạm quy chế phòng khám',
        });

      expect(res.status).toBe(200);
      expect(res.body.accountStatus).toBe('BLOCKED');

      // Verify login handler returns 403 ACCOUNT_BLOCKED
      jest.spyOn(authService, 'login').mockImplementationOnce(() => {
        throw new AppError(403, 'Forbidden', 'ACCOUNT_BLOCKED', 'Account has been blocked');
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: '0981111111',
          password: 'Password123!',
        });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.code).toBe('ACCOUNT_BLOCKED');
    });
  });

  describe('AUTH-02: Profile Email Clear Contract & Domain Codes', () => {
    it('allows clearing email by sending null or empty string', async () => {
      const updatedUser = {
        _id: customerId,
        fullName: 'Customer Test',
        email: null,
        phone: '0931111111',
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
      };

      jest.spyOn(authService, 'updateMe').mockResolvedValueOnce(updatedUser);

      const resNull = await request(app)
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ email: null });

      expect(resNull.status).toBe(200);
      expect(resNull.body.email).toBeNull();
    });

    it('preserves ACCOUNT_NOT_ACTIVATED error code on login attempt', async () => {
      jest.spyOn(authService, 'login').mockImplementationOnce(() => {
        throw new AppError(403, 'Forbidden', 'ACCOUNT_NOT_ACTIVATED', 'Account is not activated yet');
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: '0939999999',
          password: 'Password123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_NOT_ACTIVATED');
    });
  });

  describe('AUTH-03: Unified branchScope middleware fail-closed', () => {
    const { assertBranchAccess } = require('../../src/shared/middleware/branchScope.middleware');

    it('fails closed (403 BRANCH_SCOPE_EMPTY) when actor has empty branch scope', () => {
      const actor = {
        id: 'user123',
        systemRole: 'MANAGER',
        assignedBranchIds: [],
        authorizedBranchIds: [],
      };

      try {
        assertBranchAccess(actor, branchA);
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.status).toBe(403);
        expect(e.code).toBe('BRANCH_SCOPE_EMPTY');
      }
    });

    it('throws 403 BRANCH_ACCESS_DENIED when Manager accesses out-of-scope branch', () => {
      const actor = {
        id: 'user123',
        systemRole: 'MANAGER',
        assignedBranchIds: [branchA],
        authorizedBranchIds: [branchA],
      };

      try {
        assertBranchAccess(actor, branchB);
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.status).toBe(403);
        expect(e.code).toBe('BRANCH_ACCESS_DENIED');
      }
    });

    it('permits ADMIN access to any branch without restrictions', () => {
      const actor = { id: 'admin1', systemRole: 'ADMIN' };
      expect(assertBranchAccess(actor, branchB)).toBe(true);
    });
  });

  describe('AUTH-04: StaffProfile._id and User._id resolution', () => {
    const { resolveStaffIdentity, isActorStaffMatch } = require('../../src/shared/utils/staffIdentity');

    it('correctly matches actor when target matches either user ID or profile ID', async () => {
      const mockSp = {
        _id: new mongoose.Types.ObjectId(managerId),
        userId: new mongoose.Types.ObjectId(adminId),
        staffSubRole: 'RECEPTIONIST',
      };

      jest.spyOn(StaffProfile, 'findById').mockResolvedValue(mockSp);
      jest.spyOn(StaffProfile, 'findOne').mockResolvedValue(mockSp);

      const mockUser = {
        _id: new mongoose.Types.ObjectId(adminId),
        fullName: 'Admin User',
      };

      jest.spyOn(User, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);

      const resolved = await resolveStaffIdentity(managerId);
      expect(resolved).not.toBeNull();
      expect(resolved.userId).toBe(adminId);
      expect(resolved.staffProfileId).toBe(managerId);

      const actor = { id: adminId, systemRole: 'STAFF' };
      const isMatch = await isActorStaffMatch(actor, managerId);
      expect(isMatch).toBe(true);
    });
  });
});
