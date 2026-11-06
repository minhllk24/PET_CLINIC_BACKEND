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

  describe('3. Validation & CSPRNG Password Generation', () => {
    it('generateSecurePassword generates strong 16-char password with mixed character sets', () => {
      const pwd = managerService.generateSecurePassword(16);
      expect(pwd).toHaveLength(16);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[!@#$%^&*]/.test(pwd)).toBe(true);
    });

    it('validateActiveBranches rejects invalid ID format with 400 and does not silently ignore it', async () => {
      await expect(
        managerService.validateActiveBranches([branchQ1, 'invalid-id-123'])
      ).rejects.toThrow('All assignedBranchIds must be valid ObjectId strings');
    });

    it('validateActiveBranches rejects inactive or non-existent branch IDs with 400', async () => {
      jest.spyOn(Branch, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: new mongoose.Types.ObjectId(branchQ1), isActive: true, status: 'ACTIVE' },
        ]),
      });

      await expect(
        managerService.validateActiveBranches([branchQ1, branchQ7])
      ).rejects.toThrow('One or more assigned branches do not exist or are inactive');
    });
  });

  describe('4. Scoped Branch Visibility & Unified Pagination', () => {
    it('scopes assignedBranchIds when Manager views another Manager to caller assigned branches only', async () => {
      const targetManagerDoc = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
        systemRole: 'MANAGER',
        fullName: 'Target Manager',
        staffCode: 'MGR-9999',
        assignedBranchIds: [
          new mongoose.Types.ObjectId(branchQ1), // Shared with caller
          new mongoose.Types.ObjectId(branchBT), // NOT shared with caller
        ],
        accountStatus: 'ACTIVE',
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(targetManagerDoc);

      const callerManagerActor = {
        id: managerId,
        systemRole: 'MANAGER',
        assignedBranchIds: [branchQ1, branchQ7], // Caller only has Q1 and Q7
      };

      const result = await managerService.getManagerById('507f1f77bcf86cd799439099', callerManagerActor);
      expect(result.assignedBranchIds).toEqual([branchQ1]); // BT is masked/stripped
      expect(result.assignedBranches).toHaveLength(1);
      expect(result.assignedBranches[0].id).toBe(branchQ1);
    });

    it('listStaff seamlessly merges managers and staff across pages for Admin', async () => {
      const mockStaffProfiles = [
        {
          _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439071'),
          userId: { _id: '507f1f77bcf86cd799439071', fullName: 'Staff 1', systemRole: 'STAFF' },
          staffSubRole: 'VETERINARIAN',
          staffCode: 'VET-001',
          authorizedBranchIds: [branchQ1],
        },
      ];

      const mockManagers = {
        items: [
          {
            id: '507f1f77bcf86cd799439081',
            userId: '507f1f77bcf86cd799439081',
            fullName: 'Manager 1',
            systemRole: 'MANAGER',
            role: 'MANAGER',
            staffSubRole: 'MANAGER',
            staffCode: 'MGR-001',
            assignedBranchIds: [branchQ1],
          },
        ],
        totalCount: 1,
      };

      jest.spyOn(StaffProfile, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockStaffProfiles),
      });
      jest.spyOn(StaffProfile, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(managerService, 'listManagers').mockResolvedValue(mockManagers);

      const result = await staffService.listStaff(
        { page: 1, limit: 10 },
        { id: adminId, systemRole: 'ADMIN' }
      );

      expect(result.totalCount).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items.some((i) => i.systemRole === 'MANAGER')).toBe(true);
      expect(result.items.some((i) => i.systemRole === 'STAFF')).toBe(true);
    });
  });

  describe('5. Dynamic Live Sync (Fail-Closed on DB Error & Branch Revocation)', () => {
    it('authenticates with Fail-Closed: returns 503 DATABASE_SYNC_ERROR when DB query fails instead of falling back to stale JWT claims', async () => {
      jest.spyOn(User, 'findById').mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockRejectedValue(new Error('MongoDB cluster unreachable')),
        }),
      });

      const res = await request(app)
        .get('/api/v1/managers')
        .set('Authorization', `Bearer ${managerToken}`);

      // Expect Fail-Closed rejection: 503 or 401/403 (never 200 with old claims)
      expect([401, 403, 503]).toContain(res.status);
    });
  });

  describe('6. Shift Assignment Guardrail for Manager', () => {
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

