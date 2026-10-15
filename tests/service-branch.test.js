import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import Branch from '../src/modules/branch/models/Branch';
import BranchServiceConfig from '../src/modules/branch/models/BranchServiceConfig';
import Service from '../src/modules/catalog/models/Service';
import Shift from '../src/modules/staff/models/Shift';
import StaffProfile from '../src/modules/staff/models/StaffProfile';
import Appointment from '../src/modules/booking/models/Appointment';
import * as serviceCatalogService from '../src/modules/catalog/serviceCatalog.service';
import * as branchService from '../src/modules/branch/branch.service';
import * as branchServiceConfigService from '../src/modules/branch/branchServiceConfig.service';
import * as availabilityService from '../src/modules/booking/availability.service';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';
import AppError from '../src/utils/AppError';

const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const customerId = '507f1f77bcf86cd799439003';
const branch1Id = '507f1f77bcf86cd799439011';
const branch2Id = '507f1f77bcf86cd799439012';
const serviceGroomingId = '507f1f77bcf86cd799439021';
const serviceMedicalId = '507f1f77bcf86cd799439022';
const serviceSurgeryId = '507f1f77bcf86cd799439023';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branch1Id, branch2Id], authorizedBranchIds: [branch1Id, branch2Id] },
  config.jwt.accessSecret
);

const managerToken = jwt.sign(
  { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branch1Id], authorizedBranchIds: [branch1Id] },
  config.jwt.accessSecret
);

const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

describe('Priority P0 – Service Catalog & Branch Management Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Model & Schema Guardrails (Stock & Capacity Isolation)', () => {
    it('Branch schema must not store slotCapacity (ADR-38)', () => {
      const paths = Object.keys(Branch.schema.paths);
      expect(paths).not.toContain('slotCapacity');
      expect(paths).toContain('code');
      expect(paths).toContain('name');
      expect(paths).toContain('address');
      expect(paths).toContain('openingHours');
      expect(paths).toContain('holidays');
    });

    it('BranchServiceConfig requires branchId, serviceId, capacity >= 1 and compound unique index', () => {
      expect(BranchServiceConfig.schema.paths.branchId).toBeDefined();
      expect(BranchServiceConfig.schema.paths.serviceId).toBeDefined();
      expect(BranchServiceConfig.schema.paths.capacity).toBeDefined();
      expect(BranchServiceConfig.schema.paths.enabled).toBeDefined();
      expect(BranchServiceConfig.schema.paths.availability).toBeDefined();
    });

    it('Service schema must not store branchId or deposit configuration', () => {
      const paths = Object.keys(Service.schema.paths);
      expect(paths).not.toContain('branchId');
      expect(paths).not.toContain('contactInfo.branchId');
      expect(paths).not.toContain('deposit');
      expect(paths).not.toContain('depositPercentage');
      expect(paths).not.toContain('depositConfig');
    });

    it('Service schema has compound indexes matching 06-mongodb-index-workload-v7.md (Q22)', () => {
      const indexes = Service.schema.indexes();
      const indexKeys = indexes.map(([fields]) => Object.keys(fields).join('_'));
      expect(indexKeys).toContain('status_bookingMode');
      expect(indexKeys).toContain('status_serviceType');
      expect(indexKeys).toContain('requiredStaffRole_status');
    });
  });

  describe('2. Business Rules & Guardrails Validation', () => {
    it('Enforces Surgery to be REQUEST_ONLY (Throws 422 if set to BOOKABLE)', () => {
      expect(() => {
        serviceCatalogService.validateServiceGuardrails({
          name: 'Phẫu thuật triệt sản chó mèo',
          category: 'Phẫu thuật',
          bookingMode: 'BOOKABLE',
        });
      }).toThrow(AppError);

      try {
        serviceCatalogService.validateServiceGuardrails({
          name: 'Phẫu thuật triệt sản chó mèo',
          category: 'Phẫu thuật',
          bookingMode: 'BOOKABLE',
        });
      } catch (err) {
        expect(err.status).toBe(422);
        expect(err.code).toBe('SURGERY_REQUIRES_REQUEST_ONLY');
      }
    });

    it('Enforces Emergency to be CONTACT_ONLY (Throws 422 if set to BOOKABLE)', () => {
      expect(() => {
        serviceCatalogService.validateServiceGuardrails({
          name: 'Cấp cứu 24/7',
          category: 'Cấp cứu',
          bookingMode: 'BOOKABLE',
        });
      }).toThrow(AppError);

      try {
        serviceCatalogService.validateServiceGuardrails({
          name: 'Cấp cứu 24/7',
          category: 'Cấp cứu',
          bookingMode: 'BOOKABLE',
        });
      } catch (err) {
        expect(err.status).toBe(422);
        expect(err.code).toBe('EMERGENCY_REQUIRES_CONTACT_ONLY');
      }
    });

    it('Rejects deposit configuration on Service definition (Throws 422)', () => {
      expect(() => {
        serviceCatalogService.validateServiceGuardrails({
          name: 'Khám sức khỏe',
          depositPercentage: 30,
        });
      }).toThrow(AppError);
    });

    it('Archive service sets status to INACTIVE and deactivates related BranchServiceConfigs', async () => {
      const mockService = {
        _id: new mongoose.Types.ObjectId(serviceGroomingId),
        name: 'Tắm & Sấy',
        serviceType: 'GROOMING',
        basePrice: 100000,
        durationMinutes: 60,
        requiredStaffRole: 'CARE_STAFF_GROOMER',
        bookingMode: 'BOOKABLE',
        status: 'ACTIVE',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Service, 'findById').mockResolvedValue(mockService);
      const updateManySpy = jest.spyOn(BranchServiceConfig, 'updateMany').mockResolvedValue({ modifiedCount: 2 });

      const result = await serviceCatalogService.archiveService(serviceGroomingId);

      expect(mockService.status).toBe('INACTIVE');
      expect(mockService.save).toHaveBeenCalled();
      expect(updateManySpy).toHaveBeenCalledWith(
        { serviceId: mockService._id },
        { $set: { enabled: false } }
      );
      expect(result.status).toBe('INACTIVE');
    });
  });

  describe('3. RBAC & Scope Isolation for Service & Branch', () => {
    it('Manager attempting to update global Service receives 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/services/${serviceGroomingId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Tắm & Sấy VIP',
          serviceType: 'GROOMING',
          basePrice: 150000,
          durationMinutes: 60,
          requiredStaffRole: 'CARE_STAFF_GROOMER',
          bookingMode: 'BOOKABLE',
        });

      expect(res.status).toBe(403);
    });

    it('Admin can create global Service with valid guardrails', async () => {
      const mockCreated = {
        id: serviceGroomingId,
        name: 'Tắm & Sấy khô',
        serviceType: 'GROOMING',
        category: 'Vệ sinh',
        basePrice: 100000,
        durationMinutes: 60,
        requiredStaffRole: 'CARE_STAFF_GROOMER',
        bookingMode: 'BOOKABLE',
        status: 'ACTIVE',
      };

      jest.spyOn(serviceCatalogService, 'createService').mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/v1/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'idemp-srv-create-01')
        .send({
          name: 'Tắm & Sấy khô',
          serviceType: 'GROOMING',
          category: 'Vệ sinh',
          basePrice: 100000,
          durationMinutes: 60,
          requiredStaffRole: 'CARE_STAFF_GROOMER',
          bookingMode: 'BOOKABLE',
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Tắm & Sấy khô');
    });

    it('Manager can update BranchServiceConfig for assigned branch', async () => {
      const mockConfig = {
        branchId: branch1Id,
        serviceId: serviceGroomingId,
        enabled: true,
        capacity: 3,
        availability: [{ dayOfWeek: 1, open: '08:00', close: '17:00' }],
        updatedAt: new Date().toISOString(),
      };

      jest.spyOn(branchServiceConfigService, 'upsertBranchServiceConfig').mockResolvedValue(mockConfig);

      const res = await request(app)
        .put(`/api/v1/branches/${branch1Id}/service-configs/${serviceGroomingId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          enabled: true,
          capacity: 3,
          availability: [{ dayOfWeek: 1, open: '08:00', close: '17:00' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.capacity).toBe(3);
    });

    it('Manager cannot update BranchServiceConfig for unassigned branch (403 Forbidden)', async () => {
      jest.spyOn(Branch, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(branch2Id) });
      jest.spyOn(Service, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(serviceGroomingId) });

      // manager has only branch1Id assigned
      const res = await request(app)
        .put(`/api/v1/branches/${branch2Id}/service-configs/${serviceGroomingId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          enabled: true,
          capacity: 3,
        });

      expect(res.status).toBe(403);
    });

    it('Admin can deactivate a branch with reason (status becomes INACTIVE)', async () => {
      const mockBranch = {
        _id: new mongoose.Types.ObjectId(branch1Id),
        code: 'BR-000001',
        name: 'Chi nhánh Quận 1',
        address: '123 Nguyễn Thị Minh Khai',
        status: 'ACTIVE',
        openingHours: [],
        holidays: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Branch, 'findById').mockResolvedValue(mockBranch);

      const res = await request(app)
        .post(`/api/v1/branches/${branch1Id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'idemp-branch-deact-01')
        .send({ reason: 'Tạm dừng nâng cấp cơ sở vật chất' });

      expect(res.status).toBe(200);
      expect(mockBranch.status).toBe('INACTIVE');
      expect(mockBranch.save).toHaveBeenCalled();
      expect(res.body.status).toBe('INACTIVE');
    });

    it('Manager or Customer cannot deactivate a branch (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/v1/branches/${branch1Id}/deactivate`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'idemp-branch-deact-mgr')
        .send({ reason: 'Tạm dừng nâng cấp' });

      expect(res.status).toBe(403);
    });

    it('Admin can activate an inactive branch', async () => {
      const mockBranch = {
        _id: new mongoose.Types.ObjectId(branch1Id),
        code: 'BR-000001',
        name: 'Chi nhánh Quận 1',
        address: '123 Nguyễn Thị Minh Khai',
        status: 'INACTIVE',
        openingHours: [],
        holidays: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Branch, 'findById').mockResolvedValue(mockBranch);

      const res = await request(app)
        .post(`/api/v1/branches/${branch1Id}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'idemp-branch-act-01');

      expect(res.status).toBe(200);
      expect(mockBranch.status).toBe('ACTIVE');
      expect(mockBranch.save).toHaveBeenCalled();
      expect(res.body.status).toBe('ACTIVE');
    });

    it('Public or Customer can get branch details by ID', async () => {
      const mockBranch = {
        _id: new mongoose.Types.ObjectId(branch1Id),
        code: 'BR-000001',
        name: 'Chi nhánh Quận 1',
        address: '123 Nguyễn Thị Minh Khai',
        status: 'ACTIVE',
        openingHours: [{ dayOfWeek: 1, open: '08:00', close: '20:00' }],
        holidays: [],
      };
      jest.spyOn(Branch, 'findById').mockResolvedValue(mockBranch);

      const res = await request(app).get(`/api/v1/branches/${branch1Id}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(branch1Id);
      expect(res.body.name).toBe('Chi nhánh Quận 1');
    });
  });

  describe('4. Dynamic Availability Engine (BF10)', () => {
    const testDate = '2026-10-20'; // Tuesday (dayOfWeek = 2 in UTC)

    it('Returns empty slots when Branch is inactive or on holiday', async () => {
      jest.spyOn(Branch, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(branch1Id),
        status: 'ACTIVE',
        holidays: [{ date: testDate, note: 'Bảo trì' }],
      });

      const result = await availabilityService.getAvailability({
        serviceIds: [serviceGroomingId],
        branchId: branch1Id,
        date: testDate,
      });

      expect(result.slots).toEqual([]);
    });

    it('Returns empty slots when service is disabled in BranchServiceConfig', async () => {
      jest.spyOn(Branch, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(branch1Id),
        status: 'ACTIVE',
        openingHours: [{ dayOfWeek: 2, open: '08:00', close: '18:00' }],
        holidays: [],
      });

      jest.spyOn(Service, 'find').mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(serviceGroomingId),
          name: 'Tắm & Sấy',
          serviceType: 'GROOMING',
          durationMinutes: 60,
          requiredStaffRole: 'CARE_STAFF_GROOMER',
          bookingMode: 'BOOKABLE',
          status: 'ACTIVE',
        },
      ]);

      // Config disabled
      jest.spyOn(BranchServiceConfig, 'find').mockResolvedValue([
        {
          branchId: new mongoose.Types.ObjectId(branch1Id),
          serviceId: new mongoose.Types.ObjectId(serviceGroomingId),
          enabled: false,
          capacity: 2,
        },
      ]);

      const result = await availabilityService.getAvailability({
        serviceIds: [serviceGroomingId],
        branchId: branch1Id,
        date: testDate,
      });

      expect(result.slots).toEqual([]);
    });

    it('Calculates available slots when staff has active shift and capacity is available', async () => {
      jest.spyOn(Branch, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(branch1Id),
        status: 'ACTIVE',
        openingHours: [{ dayOfWeek: 2, open: '08:00', close: '12:00' }],
        holidays: [],
      });

      jest.spyOn(Service, 'find').mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(serviceGroomingId),
          name: 'Tắm & Sấy',
          serviceType: 'GROOMING',
          durationMinutes: 60,
          requiredStaffRole: 'CARE_STAFF_GROOMER',
          bookingMode: 'BOOKABLE',
          status: 'ACTIVE',
        },
      ]);

      jest.spyOn(BranchServiceConfig, 'find').mockResolvedValue([
        {
          branchId: new mongoose.Types.ObjectId(branch1Id),
          serviceId: new mongoose.Types.ObjectId(serviceGroomingId),
          enabled: true,
          capacity: 2,
        },
      ]);

      // Groomer staff shift from 08:00 to 12:00 UTC
      jest.spyOn(Shift, 'find').mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            branchId: new mongoose.Types.ObjectId(branch1Id),
            startAt: new Date(`${testDate}T08:00:00.000Z`),
            endAt: new Date(`${testDate}T12:00:00.000Z`),
            status: 'ACTIVE',
            staffId: {
              _id: new mongoose.Types.ObjectId(),
              staffSubRole: 'CARE_STAFF_GROOMER',
              status: 'ACTIVE',
            },
          },
        ]),
      });

      // No existing appointments
      jest.spyOn(Appointment, 'find').mockResolvedValue([]);

      const result = await availabilityService.getAvailability({
        serviceIds: [serviceGroomingId],
        branchId: branch1Id,
        date: testDate,
      });

      expect(result.scheduledDurationMinutes).toBe(60);
      expect(result.slots.length).toBeGreaterThan(0);
      expect(result.slots[0].remaining).toBeGreaterThanOrEqual(1);
      expect(result.slots[0].segments).toHaveLength(1);
      expect(result.slots[0].segments[0].serviceId).toBe(serviceGroomingId);
    });

    it('Excludes slots when concurrent segments reach capacity', async () => {
      jest.spyOn(Branch, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(branch1Id),
        status: 'ACTIVE',
        openingHours: [{ dayOfWeek: 2, open: '08:00', close: '10:00' }],
        holidays: [],
      });

      jest.spyOn(Service, 'find').mockResolvedValue([
        {
          _id: new mongoose.Types.ObjectId(serviceGroomingId),
          name: 'Tắm & Sấy',
          serviceType: 'GROOMING',
          durationMinutes: 60,
          requiredStaffRole: 'CARE_STAFF_GROOMER',
          bookingMode: 'BOOKABLE',
          status: 'ACTIVE',
        },
      ]);

      // Capacity = 1
      jest.spyOn(BranchServiceConfig, 'find').mockResolvedValue([
        {
          branchId: new mongoose.Types.ObjectId(branch1Id),
          serviceId: new mongoose.Types.ObjectId(serviceGroomingId),
          enabled: true,
          capacity: 1,
        },
      ]);

      jest.spyOn(Shift, 'find').mockReturnValue({
        populate: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            branchId: new mongoose.Types.ObjectId(branch1Id),
            startAt: new Date(`${testDate}T08:00:00.000Z`),
            endAt: new Date(`${testDate}T10:00:00.000Z`),
            status: 'ACTIVE',
            staffId: {
              _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
              staffSubRole: 'CARE_STAFF_GROOMER',
              status: 'ACTIVE',
            },
          },
        ]),
      });

      // Existing appointment occupying 08:00 - 09:00
      jest.spyOn(Appointment, 'find').mockResolvedValue([
        {
          status: 'CONFIRMED',
          services: [
            {
              serviceId: new mongoose.Types.ObjectId(serviceGroomingId),
              assignedStaffId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
              scheduledStart: new Date(`${testDate}T08:00:00.000Z`),
              scheduledEnd: new Date(`${testDate}T09:00:00.000Z`),
            },
          ],
        },
      ]);

      const result = await availabilityService.getAvailability({
        serviceIds: [serviceGroomingId],
        branchId: branch1Id,
        date: testDate,
      });

      // 08:00 start slot must NOT be available because capacity is 1 and already occupied
      const start8Slot = result.slots.find((s) => s.start.includes('08:00:00'));
      expect(start8Slot).toBeUndefined();

      // 09:00 start slot should be available
      const start9Slot = result.slots.find((s) => s.start.includes('09:00:00'));
      expect(start9Slot).toBeDefined();
    });
  });

  describe('5. GET /api/v1/availability Route Integration', () => {
    it('Responds with 200 and matches OpenAPI AvailabilityResponse schema', async () => {
      const mockResult = {
        serviceIds: [serviceGroomingId],
        branchId: branch1Id,
        date: '2026-10-20',
        serviceType: 'GROOMING',
        scheduledDurationMinutes: 60,
        slots: [
          {
            start: '2026-10-20T08:00:00.000Z',
            end: '2026-10-20T09:00:00.000Z',
            remaining: 2,
            segments: [
              {
                serviceId: serviceGroomingId,
                start: '2026-10-20T08:00:00.000Z',
                end: '2026-10-20T09:00:00.000Z',
              },
            ],
          },
        ],
      };

      jest.spyOn(availabilityService, 'getAvailability').mockResolvedValue(mockResult);

      const res = await request(app)
        .get(`/api/v1/availability?serviceIds=${serviceGroomingId}&branchId=${branch1Id}&date=2026-10-20`);

      expect(res.status).toBe(200);
      expect(res.body.slots).toHaveLength(1);
      expect(res.body.scheduledDurationMinutes).toBe(60);
      expect(res.body.serviceType).toBe('GROOMING');
    });
  });
});
