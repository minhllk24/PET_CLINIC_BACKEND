import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import User from '../../src/models/User';
import StaffProfile from '../../src/modules/staff/models/StaffProfile';
import Branch from '../../src/modules/branch/models/Branch';
import ServiceRecord from '../../src/modules/execution/models/ServiceRecord';
import Pet from '../../src/modules/customer/models/Pet';
import Service from '../../src/modules/catalog/models/Service';
import config from '../../src/shared/config';
import * as managerService from '../../src/modules/staff/manager.service';
import * as staffService from '../../src/modules/staff/staff.service';
import * as shiftService from '../../src/modules/staff/shift.service';
import * as executionService from '../../src/modules/execution/execution.service';

describe('Multi-Branch Manager & ServiceRecord Data Enrichment Suite', () => {
  const adminId = '507f1f77bcf86cd799439001';
  const managerId = '507f1f77bcf86cd799439002';
  const customerId = '507f1f77bcf86cd799439003';
  const branchQ1 = '507f1f77bcf86cd799439011';
  const branchQ7 = '507f1f77bcf86cd799439012';
  const branchBT = '507f1f77bcf86cd799439013';

  const adminToken = jwt.sign(
    { id: adminId, fullName: 'Admin User', systemRole: 'ADMIN', assignedBranchIds: [], authorizedBranchIds: [] },
    config.jwt.accessSecret
  );

  const managerToken = jwt.sign(
    { id: managerId, fullName: 'Manager User', systemRole: 'MANAGER', assignedBranchIds: [branchQ1, branchQ7], authorizedBranchIds: [branchQ1, branchQ7] },
    config.jwt.accessSecret
  );

  const customerToken = jwt.sign(
    { id: customerId, fullName: 'Customer User', systemRole: 'CUSTOMER' },
    config.jwt.accessSecret
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Manager Account Creation & Scope (/api/v1/managers)', () => {
    it('allows Admin to create Manager with multiple assignedBranchIds without homeBranchId', async () => {
      const mockCreated = {
        id: '507f1f77bcf86cd799439020',
        userId: '507f1f77bcf86cd799439020',
        fullName: 'Nguyễn Văn Quản Lý',
        email: 'manager.multi@clinic.com',
        phone: '0909111222',
        username: 'mgr_nguyenvan2026',
        systemRole: 'MANAGER',
        role: 'MANAGER',
        staffSubRole: 'MANAGER',
        assignedBranchIds: [branchQ1, branchQ7],
        authorizedBranchIds: [branchQ1, branchQ7],
        assignedBranches: [
          { id: branchQ1, code: 'Q1', name: 'Chi nhánh Quận 1' },
          { id: branchQ7, code: 'Q7', name: 'Chi nhánh Quận 7' },
        ],
        homeBranchId: null,
        homeBranch: null,
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        credentials: {
          username: 'mgr_nguyenvan2026',
          password: 'GeneratedSecurePassword123!',
        },
      };

      jest.spyOn(managerService, 'createManager').mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/v1/managers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Nguyễn Văn Quản Lý',
          email: 'manager.multi@clinic.com',
          phone: '0909111222',
          assignedBranchIds: [branchQ1, branchQ7],
        });

      expect(res.status).toBe(201);
      expect(res.body.systemRole).toBe('MANAGER');
      expect(res.body.assignedBranchIds).toEqual([branchQ1, branchQ7]);
      expect(res.body.homeBranchId).toBeNull();
      expect(res.body.credentials).toBeDefined();
      expect(res.body.credentials.username).toBe('mgr_nguyenvan2026');
      expect(res.body.credentials.password).toBeDefined();
    });

    it('rejects Manager creation by non-admin actors with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/managers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          fullName: 'Kẻ mạo danh',
          assignedBranchIds: [branchQ1],
        });

      expect(res.status).toBe(403);
    });

    it('delegates POST /api/v1/staff to createManager when systemRole is MANAGER', async () => {
      const mockCreated = {
        id: '507f1f77bcf86cd799439021',
        userId: '507f1f77bcf86cd799439021',
        fullName: 'Trần Thị Quản Lý',
        systemRole: 'MANAGER',
        role: 'MANAGER',
        assignedBranchIds: [branchQ1, branchBT],
        homeBranchId: null,
        status: 'ACTIVE',
        credentials: {
          username: 'mgr_tranthi345',
          password: 'Password@2026!',
        },
      };

      const createSpy = jest.spyOn(managerService, 'createManager').mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Trần Thị Quản Lý',
          systemRole: 'MANAGER',
          assignedBranchIds: [branchQ1, branchBT],
        });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalled();
      expect(res.body.systemRole).toBe('MANAGER');
      expect(res.body.homeBranchId).toBeNull();
    });
  });

  describe('2. Manager Querying, Updating & Scoping', () => {
    it('GET /api/v1/managers lists managers with assigned branches', async () => {
      const mockList = {
        items: [
          {
            id: managerId,
            fullName: 'Manager User',
            systemRole: 'MANAGER',
            assignedBranchIds: [branchQ1, branchQ7],
            assignedBranches: [
              { id: branchQ1, code: 'Q1', name: 'Chi nhánh Quận 1' },
              { id: branchQ7, code: 'Q7', name: 'Chi nhánh Quận 7' },
            ],
            status: 'ACTIVE',
          },
        ],
        totalCount: 1,
        page: 1,
        limit: 20,
        nextCursor: null,
      };

      jest.spyOn(managerService, 'listManagers').mockResolvedValue(mockList);

      const res = await request(app)
        .get('/api/v1/managers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].systemRole).toBe('MANAGER');
      expect(res.body.items[0].assignedBranches).toHaveLength(2);
    });

    it('PUT /api/v1/managers/:id/assigned-branches updates manager branch scope', async () => {
      const mockUpdated = {
        id: managerId,
        assignedBranchIds: [branchQ7, branchBT],
        assignedBranches: [
          { id: branchQ7, code: 'Q7', name: 'Chi nhánh Quận 7' },
          { id: branchBT, code: 'BT', name: 'Chi nhánh Bình Thạnh' },
        ],
      };

      jest.spyOn(managerService, 'updateManagerBranches').mockResolvedValue(mockUpdated);

      const res = await request(app)
        .put(`/api/v1/managers/${managerId}/assigned-branches`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          assignedBranchIds: [branchQ7, branchBT],
        });

      expect(res.status).toBe(200);
      expect(res.body.assignedBranchIds).toEqual([branchQ7, branchBT]);
    });

    it('GET /api/v1/staff?role=MANAGER delegates to manager listing', async () => {
      const mockManagers = {
        items: [
          {
            id: managerId,
            fullName: 'Manager User',
            systemRole: 'MANAGER',
            role: 'MANAGER',
            staffSubRole: 'MANAGER',
            assignedBranchIds: [branchQ1],
          },
        ],
        totalCount: 1,
        nextCursor: null,
      };

      const listSpy = jest.spyOn(managerService, 'listManagers').mockResolvedValue(mockManagers);

      const res = await request(app)
        .get('/api/v1/staff?role=MANAGER')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(listSpy).toHaveBeenCalled();
      expect(res.body.items[0].systemRole).toBe('MANAGER');
    });

    it('GET /api/v1/staff/:id retrieves manager profile without 404', async () => {
      const mockManager = {
        id: managerId,
        userId: managerId,
        fullName: 'Manager User',
        systemRole: 'MANAGER',
        role: 'MANAGER',
        staffSubRole: 'MANAGER',
        assignedBranchIds: [branchQ1, branchQ7],
        homeBranchId: null,
        status: 'ACTIVE',
      };

      jest.spyOn(StaffProfile, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      jest.spyOn(StaffProfile, 'findOne').mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      jest.spyOn(User, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(managerId),
        systemRole: 'MANAGER',
      });
      jest.spyOn(managerService, 'getManagerById').mockResolvedValue(mockManager);

      const res = await request(app)
        .get(`/api/v1/staff/${managerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.systemRole).toBe('MANAGER');
    });
  });

  describe('3. Shift Assignment Guardrail for Manager', () => {
    it('rejects creating a shift for a Manager (Managers do not require shifts)', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(managerId),
          systemRole: 'MANAGER',
        }),
      });

      await expect(
        shiftService.createShift(
          {
            staffId: managerId,
            branchId: branchQ1,
            startAt: '2026-11-10T08:00:00.000Z',
            endAt: '2026-11-10T12:00:00.000Z',
          },
          { id: adminId, systemRole: 'ADMIN' }
        )
      ).rejects.toThrow('Quản lý không cần phân ca làm việc');
    });
  });

  describe('4. ServiceRecord Data Enrichment (/api/v1/service-records)', () => {
    it('enriches service record response with petName, serviceName, branchName, and primaryStaffName', async () => {
      const recordId = '507f1f77bcf86cd799439050';
      const petId = '507f1f77bcf86cd799439052';
      const serviceId = '507f1f77bcf86cd799439053';
      const staffProfileId = '507f1f77bcf86cd799439054';

      const mockRecord = {
        _id: new mongoose.Types.ObjectId(recordId),
        code: 'SR-503597',
        appointmentId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439051'),
        branchId: new mongoose.Types.ObjectId(branchQ1),
        petId: new mongoose.Types.ObjectId(petId),
        serviceIds: [new mongoose.Types.ObjectId(serviceId)],
        assignedStaffIds: [new mongoose.Types.ObjectId(staffProfileId)],
        reviewerStaffId: new mongoose.Types.ObjectId(staffProfileId),
        status: 'WAITING_VET_REVIEW',
        recordType: 'MEDICAL',
        recordVersion: 0,
        version: 1,
        actualStartAt: new Date('2026-11-01T09:00:00.000Z'),
        petName: 'Bé Mochi',
        serviceName: 'Khám tổng quát định kỳ',
        branchName: 'Chi nhánh Quận 1',
        primaryStaffName: 'BS. Nguyễn Hoàng An',
        reviewerName: 'BS. Nguyễn Hoàng An',
      };

      jest.spyOn(ServiceRecord, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockRecord]),
      });

      const res = await request(app)
        .get('/api/v1/service-records?limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      const item = res.body.items[0];
      expect(item.petName).toBe('Bé Mochi');
      expect(item.serviceName).toBe('Khám tổng quát định kỳ');
      expect(item.branchName).toBe('Chi nhánh Quận 1');
      expect(item.staffName).toBe('BS. Nguyễn Hoàng An');
      expect(item.primaryStaffName).toBe('BS. Nguyễn Hoàng An');
      expect(item.reviewerName).toBe('BS. Nguyễn Hoàng An');
    });
  });
});

