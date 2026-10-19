import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import Shift from '../src/modules/staff/models/Shift';
import StaffProfile from '../src/modules/staff/models/StaffProfile';
import Branch from '../src/modules/branch/models/Branch';
import Appointment from '../src/modules/booking/models/Appointment';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';
import * as shiftService from '../src/modules/staff/shift.service';

const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const customerId = '507f1f77bcf86cd799439003';
const staffId = '507f1f77bcf86cd799439005';
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

describe('Wave 1 Buffer – Shift Management & Overlap Guardrail Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Model & Concurrency Guardrails', () => {
    it('enforces compound index on Shift { staffId, status, startAt, endAt }', () => {
      const indexes = Shift.schema.indexes();
      const staffIdx = indexes.find(
        (idx) =>
          idx[0].staffId === 1 &&
          idx[0].status === 1 &&
          idx[0].startAt === 1 &&
          idx[0].endAt === 1
      );
      expect(staffIdx).toBeDefined();
    });

    it('rejects shift creation with invalid time range (startAt >= endAt)', async () => {
      await expect(
        shiftService.createShift({
          staffId,
          branchId,
          startAt: '2026-10-25T12:00:00.000Z',
          endAt: '2026-10-25T10:00:00.000Z',
        })
      ).rejects.toThrow('startAt must be before endAt');
    });

    it('throws 409 SHIFT_OVERLAP if staff already has an active overlapping shift', async () => {
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(staffId),
        status: 'ACTIVE',
        authorizedBranchIds: [new mongoose.Types.ObjectId(branchId)],
        staffSubRole: 'VETERINARIAN',
      });

      jest.spyOn(Branch, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(branchId),
        status: 'ACTIVE',
      });

      jest.spyOn(Shift, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        staffId,
        branchId,
        startAt: new Date('2026-10-25T08:00:00.000Z'),
        endAt: new Date('2026-10-25T12:00:00.000Z'),
        status: 'ACTIVE',
      });

      await expect(
        shiftService.createShift({
          staffId,
          branchId,
          startAt: '2026-10-25T10:00:00.000Z',
          endAt: '2026-10-25T14:00:00.000Z',
        })
      ).rejects.toThrow('Staff already has an active shift overlapping this time window');
    });
  });

  describe('2. RBAC Scope & REST Endpoint Integration with Supertest', () => {
    it('POST /api/v1/shifts rejects Customer with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'test-shift-001')
        .send({
          staffId,
          branchId,
          startAt: '2026-10-25T08:00:00.000Z',
          endAt: '2026-10-25T12:00:00.000Z',
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/shifts rejects Manager attempting to create shift outside assignedBranchIds', async () => {
      const res = await request(app)
        .post('/api/v1/shifts')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'test-shift-002')
        .send({
          staffId,
          branchId: otherBranchId,
          startAt: '2026-10-25T08:00:00.000Z',
          endAt: '2026-10-25T12:00:00.000Z',
        });

      expect(res.status).toBe(403);
    });

    it('GET /api/v1/shifts returns 200 and matches OpenAPI ShiftPage schema', async () => {
      const mockShift = {
        _id: new mongoose.Types.ObjectId(),
        staffId: {
          _id: new mongoose.Types.ObjectId(staffId),
          staffSubRole: 'VETERINARIAN',
        },
        branchId: new mongoose.Types.ObjectId(branchId),
        startAt: new Date('2026-10-25T08:00:00.000Z'),
        endAt: new Date('2026-10-25T12:00:00.000Z'),
        status: 'ACTIVE',
      };

      jest.spyOn(shiftService, 'listShifts').mockResolvedValue({
        items: [shiftService.formatShift(mockShift)],
        nextCursor: null,
      });

      const res = await request(app)
        .get(`/api/v1/shifts?branchId=${branchId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].staffSubRole).toBe('VETERINARIAN');
      expect(res.body.items[0].status).toBe('ACTIVE');
    });

    it('POST /api/v1/shifts/:id/cancel rejects cancellation if confirmed appointment exists', async () => {
      jest.spyOn(Shift, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: new mongoose.Types.ObjectId(),
          staffId: new mongoose.Types.ObjectId(staffId),
          branchId: new mongoose.Types.ObjectId(branchId),
          startAt: new Date('2026-10-25T08:00:00.000Z'),
          endAt: new Date('2026-10-25T12:00:00.000Z'),
          status: 'ACTIVE',
        }),
      });

      jest.spyOn(Appointment, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-123',
        status: 'CONFIRMED',
      });

      const shiftId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .post(`/api/v1/shifts/${shiftId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'test-shift-003')
        .send({ reason: 'Emergency leave' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });
});
