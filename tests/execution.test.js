import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import config from '../src/shared/config';
import ServiceRecord from '../src/modules/execution/models/ServiceRecord';
import ServiceRecordRevision from '../src/modules/execution/models/ServiceRecordRevision';
import Appointment from '../src/modules/booking/models/Appointment';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';

const branchId = '507f1f77bcf86cd799439011';
const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const vetId = '507f1f77bcf86cd799439003';
const nurseId = '507f1f77bcf86cd799439004';
const groomerId = '507f1f77bcf86cd799439005';
const customerId = '507f1f77bcf86cd799439006';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const managerToken = jwt.sign(
  { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const vetToken = jwt.sign(
  { id: vetId, systemRole: 'STAFF', staffSubRole: 'VETERINARIAN', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const nurseToken = jwt.sign(
  { id: nurseId, systemRole: 'STAFF', staffSubRole: 'NURSE', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const groomerToken = jwt.sign(
  { id: groomerId, systemRole: 'STAFF', staffSubRole: 'CARE_STAFF_GROOMER', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

describe('Task 4.4: Service Record & Material Consumption Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validRecordId = '507f1f77bcf86cd799439050';
  const validAppointmentId = '507f1f77bcf86cd799439051';
  const validMaterialA = '507f1f77bcf86cd799439061';
  const validMaterialB = '507f1f77bcf86cd799439062';

  describe('1. Model Invariants & Status Transitions', () => {
    it('enforces schema enum and field defaults for ServiceRecord', () => {
      const paths = ServiceRecord.schema.paths;
      expect(paths.appointmentId).toBeDefined();
      expect(paths.status.enumValues).toEqual([
        'DRAFT',
        'IN_PROGRESS',
        'WAITING_VET_REVIEW',
        'FINALIZED',
        'REOPENED'
      ]);
      expect(paths.recordType.enumValues).toEqual(['GROOMING', 'MEDICAL']);
      expect(paths.reopenedBy).toBeDefined();
      expect(paths.reopenedAt).toBeDefined();
      expect(paths.reopenReason).toBeDefined();
    });

    it('enforces schema structure for ServiceRecordRevision', () => {
      const paths = ServiceRecordRevision.schema.paths;
      expect(paths.serviceRecordId).toBeDefined();
      expect(paths.recordVersion).toBeDefined();
      expect(paths.delta).toBeDefined();
      expect(paths.actorId).toBeDefined();
    });
  });

  describe('2. Service Record Query & Detail (GET /service-records)', () => {
    it('lists service records with pagination and filters', async () => {
      const mockRecords = [
        {
          _id: new mongoose.Types.ObjectId(validRecordId),
          appointmentId: new mongoose.Types.ObjectId(validAppointmentId),
          branchId: new mongoose.Types.ObjectId(branchId),
          recordType: 'MEDICAL',
          status: 'IN_PROGRESS',
          recordVersion: 0,
          version: 1,
          actualMaterials: [{ inventoryItemId: validMaterialA, actualQuantity: 2, unit: 'cái' }],
        }
      ];

      jest.spyOn(ServiceRecord, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockRecords),
      });

      const res = await request(app)
        .get(`/api/v1/service-records?appointmentId=${validAppointmentId}&limit=10`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].recordType).toBe('MEDICAL');
    });

    it('retrieves single service record detail', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        appointmentId: new mongoose.Types.ObjectId(validAppointmentId),
        branchId: new mongoose.Types.ObjectId(branchId),
        recordType: 'MEDICAL',
        status: 'IN_PROGRESS',
        recordVersion: 0,
        version: 1,
        assignedStaffIds: [new mongoose.Types.ObjectId(vetId)],
        actualMaterials: [{ inventoryItemId: validMaterialA, actualQuantity: 2, unit: 'cái' }],
      };

      jest.spyOn(ServiceRecord, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRecord),
      });

      const res = await request(app)
        .get(`/api/v1/service-records/${validRecordId}`)
        .set('Authorization', `Bearer ${vetToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.recordType).toBe('MEDICAL');
    });

    it('returns 403 when unauthorized staff tries to view record', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        appointmentId: new mongoose.Types.ObjectId(validAppointmentId),
        branchId: new mongoose.Types.ObjectId(branchId),
        recordType: 'MEDICAL',
        status: 'IN_PROGRESS',
        recordVersion: 0,
        version: 1,
        assignedStaffIds: [new mongoose.Types.ObjectId(vetId)], // groomer is NOT assigned
      };

      jest.spyOn(ServiceRecord, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRecord),
      });

      const res = await request(app)
        .get(`/api/v1/service-records/${validRecordId}`)
        .set('Authorization', `Bearer ${groomerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('3. Materials Update (PUT /service-records/:id/materials)', () => {
    it('allows assigned Groomer to update materials for GROOMING record', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        appointmentId: new mongoose.Types.ObjectId(validAppointmentId),
        branchId: new mongoose.Types.ObjectId(branchId),
        recordType: 'GROOMING',
        status: 'IN_PROGRESS',
        recordVersion: 0,
        version: 1,
        actualMaterials: [],
        save: jest.fn().mockResolvedValue(true),
      };

      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(validAppointmentId),
        services: [
          {
            assignedStaffId: new mongoose.Types.ObjectId(groomerId),
            requiredStaffRole: 'CARE_STAFF_GROOMER',
          }
        ]
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(mockRecord);
      jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);

      const res = await request(app)
        .put(`/api/v1/service-records/${validRecordId}/materials`)
        .set('Authorization', `Bearer ${groomerToken}`)
        .send({
          materials: [
            { inventoryItemId: validMaterialA, actualQuantity: 3, unit: 'chai' }
          ],
          expectedVersion: 1
        });

      expect(res.status).toBe(200);
      expect(mockRecord.actualMaterials).toHaveLength(1);
      expect(mockRecord.version).toBe(2);
    });

    it('rejects materials update if version conflict occurs (CAS conflict)', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        status: 'IN_PROGRESS',
        recordType: 'GROOMING',
        recordVersion: 0,
        version: 2, // version is 2
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(mockRecord);

      const res = await request(app)
        .put(`/api/v1/service-records/${validRecordId}/materials`)
        .set('Authorization', `Bearer ${groomerToken}`)
        .send({
          materials: [{ inventoryItemId: validMaterialA, actualQuantity: 2, unit: 'chai' }],
          expectedVersion: 1 // expected 1
        });

      expect(res.status).toBe(409);
    });

    it('rejects Nurse trying to update materials on non-assigned segment', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        appointmentId: new mongoose.Types.ObjectId(validAppointmentId),
        recordType: 'MEDICAL',
        status: 'IN_PROGRESS',
        recordVersion: 0,
        version: 1,
      };

      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(validAppointmentId),
        services: [
          {
            assignedStaffId: new mongoose.Types.ObjectId(vetId),
            requiredStaffRole: 'VETERINARIAN', // vet segment, nurse not assigned
          }
        ]
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(mockRecord);
      jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);

      const res = await request(app)
        .put(`/api/v1/service-records/${validRecordId}/materials`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          materials: [{ inventoryItemId: validMaterialA, actualQuantity: 2, unit: 'chai' }],
          expectedVersion: 1
        });

      expect(res.status).toBe(403);
    });
  });

  describe('4. Professional Clinical Data (PUT /service-records/:id/professional)', () => {
    it('allows Veterinarian to update diagnosis and treatment for MEDICAL record', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        appointmentId: new mongoose.Types.ObjectId(validAppointmentId),
        branchId: new mongoose.Types.ObjectId(branchId),
        recordType: 'MEDICAL',
        status: 'WAITING_VET_REVIEW',
        recordVersion: 0,
        reviewerStaffId: new mongoose.Types.ObjectId(vetId),
        professional: {},
        version: 1,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(mockRecord);

      const res = await request(app)
        .put(`/api/v1/service-records/${validRecordId}/professional`)
        .set('Authorization', `Bearer ${vetToken}`)
        .send({
          diagnosis: 'Viêm da dị ứng nhẹ',
          treatment: 'Bôi kem kháng sinh 2 lần/ngày',
          result: 'Tiến triển tốt',
          notes: 'Tái khám sau 7 ngày',
          expectedVersion: 1
        });

      expect(res.status).toBe(200);
      expect(mockRecord.professional.diagnosis).toBe('Viêm da dị ứng nhẹ');
      expect(mockRecord.version).toBe(2);
    });

    it('rejects Nurse attempting to update clinical diagnosis', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        recordType: 'MEDICAL',
        status: 'WAITING_VET_REVIEW',
        recordVersion: 0,
        version: 1,
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(mockRecord);

      const res = await request(app)
        .put(`/api/v1/service-records/${validRecordId}/professional`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({
          diagnosis: 'Viêm da',
          expectedVersion: 1
        });

      expect(res.status).toBe(403);
    });
  });

  describe('5. Reopen Endpoint & Delta Inventory (POST /service-records/:id/reopen & Finalize)', () => {
    it('allows Manager to reopen FINALIZED record with mandatory reason and Idempotency-Key', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        appointmentId: new mongoose.Types.ObjectId(validAppointmentId),
        branchId: new mongoose.Types.ObjectId(branchId),
        recordType: 'MEDICAL',
        recordVersion: 1,
        status: 'FINALIZED',
        version: 2,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(mockRecord);

      const res = await request(app)
        .post(`/api/v1/service-records/${validRecordId}/reopen`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'reopen-key-001')
        .send({
          reason: 'Cần bổ sung thêm thuốc khử trùng do vết thương tái phát',
          expectedVersion: 2
        });

      expect(res.status).toBe(200);
      expect(mockRecord.status).toBe('REOPENED');
      expect(mockRecord.reopenReason).toContain('bổ sung thêm thuốc');
      expect(mockRecord.version).toBe(3);
    });

    it('rejects reopen without a valid reason (min 3 chars)', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        status: 'FINALIZED',
        recordType: 'MEDICAL',
        recordVersion: 1,
        version: 2,
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(mockRecord);

      const res = await request(app)
        .post(`/api/v1/service-records/${validRecordId}/reopen`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'reopen-key-002')
        .send({
          reason: 'ab',
          expectedVersion: 2
        });

      expect(res.status).toBe(400);
    });

    it('rejects reopen if record is not FINALIZED', async () => {
      const mockRecord = {
        _id: new mongoose.Types.ObjectId(validRecordId),
        status: 'IN_PROGRESS',
        recordType: 'MEDICAL',
        recordVersion: 0,
        version: 1,
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(mockRecord);

      const res = await request(app)
        .post(`/api/v1/service-records/${validRecordId}/reopen`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'reopen-key-003')
        .send({
          reason: 'Sai sot so lieu kiem kho',
          expectedVersion: 1
        });

      expect(res.status).toBe(409);
    });

    it('rejects reopen when called by Staff (Manager/Admin only)', async () => {
      const res = await request(app)
        .post(`/api/v1/service-records/${validRecordId}/reopen`)
        .set('Authorization', `Bearer ${nurseToken}`)
        .set('Idempotency-Key', 'reopen-key-004')
        .send({ reason: 'Reopen request from nurse', expectedVersion: 1 });

      expect(res.status).toBe(403);
    });

    it('retrieves revision history ordered by recordVersion', async () => {
      const mockRevisions = [
        {
          recordVersion: 1,
          previousActual: [],
          newActual: [{ inventoryItemId: new mongoose.Types.ObjectId(validMaterialA), actualQuantity: 2, unit: 'cái' }],
          delta: [{ inventoryItemId: new mongoose.Types.ObjectId(validMaterialA), delta: 2 }],
          actorId: new mongoose.Types.ObjectId(vetId),
          finalizedAt: new Date(),
        },
        {
          recordVersion: 2,
          previousActual: [{ inventoryItemId: new mongoose.Types.ObjectId(validMaterialA), actualQuantity: 2, unit: 'cái' }],
          newActual: [{ inventoryItemId: new mongoose.Types.ObjectId(validMaterialA), actualQuantity: 1, unit: 'cái' }],
          delta: [{ inventoryItemId: new mongoose.Types.ObjectId(validMaterialA), delta: -1 }],
          actorId: new mongoose.Types.ObjectId(vetId),
          finalizedAt: new Date(),
        },
      ];

      jest.spyOn(ServiceRecord, 'findById').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: validRecordId, branchId }),
      });
      jest.spyOn(ServiceRecordRevision, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockRevisions),
      });

      const res = await request(app)
        .get(`/api/v1/service-records/${validRecordId}/revisions`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].recordVersion).toBe(1);
      expect(res.body.items[1].recordVersion).toBe(2);
    });
  });
});
