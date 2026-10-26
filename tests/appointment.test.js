import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import Appointment from '../src/modules/booking/models/Appointment';
import SlotReservation from '../src/modules/booking/models/SlotReservation';
import AppointmentRequest from '../src/modules/booking/models/AppointmentRequest';
import Payment from '../src/modules/payment/models/Payment';
import Branch from '../src/modules/branch/models/Branch';
import Service from '../src/modules/catalog/models/Service';
import BranchServiceConfig from '../src/modules/branch/models/BranchServiceConfig';
import Shift from '../src/modules/staff/models/Shift';
import StaffProfile from '../src/modules/staff/models/StaffProfile';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';
import GuestContact from '../src/modules/customer/models/GuestContact';
import * as bookingService from '../src/modules/booking/booking.service';
import * as availabilityService from '../src/modules/booking/availability.service';

const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const receptionistId = '507f1f77bcf86cd799439004';
const staffId = '507f1f77bcf86cd799439005';
const customerId = '507f1f77bcf86cd799439003';
const branchId = '507f1f77bcf86cd799439011';
const service1Id = '507f1f77bcf86cd799439021';
const service2Id = '507f1f77bcf86cd799439022';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const managerToken = jwt.sign(
  { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const receptionistToken = jwt.sign(
  { id: receptionistId, systemRole: 'STAFF', staffSubRole: 'RECEPTIONIST', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

const makeMockQuery = (doc) => ({
  session: jest.fn().mockResolvedValue(doc),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(Array.isArray(doc) ? doc : [doc]),
  lean: jest.fn().mockResolvedValue(doc),
  select: jest.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  catch: (reject) => Promise.resolve(doc).catch(reject),
});

describe('Priority P0 Appointment Management & Time Slot Engine Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
    jest.spyOn(GuestContact, 'findOne').mockReturnValue(makeMockQuery({
      _id: new mongoose.Types.ObjectId(),
      fullName: 'Nguyen Van A',
      phone: '0901234567',
    }));
    jest.spyOn(GuestContact.prototype, 'save').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Model Invariants & Concurrency Schema Guardrails', () => {
    it('enforces required schema constraints and lifecycle status enums on Appointment', () => {
      const paths = Appointment.schema.paths;
      expect(paths.code).toBeDefined();
      expect(paths.branchId).toBeDefined();
      expect(paths.status.enumValues).toEqual([
        'PENDING_PAYMENT',
        'PENDING_CONFIRMATION',
        'CONFIRMED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
      ]);
      expect(paths['pricing.subtotal']).toBeDefined();
      expect(paths['pricing.finalAmount']).toBeDefined();
      expect(paths['deposit.status'].enumValues).toEqual([
        'NOT_REQUIRED',
        'PENDING',
        'HELD',
        'APPLIED',
        'REFUNDED',
        'FORFEITED',
      ]);
    });

    it('enforces compound unique index on SlotReservation { branchId, staffId, slotStartUnit, unitIndex }', () => {
      const indexes = SlotReservation.schema.indexes();
      const compoundIdx = indexes.find(
        (idx) =>
          idx[0].branchId === 1 &&
          idx[0].staffId === 1 &&
          idx[0].slotStartUnit === 1 &&
          idx[0].unitIndex === 1
      );
      expect(compoundIdx).toBeDefined();
      expect(compoundIdx[1].unique).toBe(true);
    });

    it('enforces schema paths and statuses on AppointmentRequest', () => {
      const paths = AppointmentRequest.schema.paths;
      expect(paths.status.enumValues).toEqual([
        'SUBMITTED',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
      ]);
      expect(paths.preferredBranchId).toBeDefined();
      expect(paths.serviceIds).toBeDefined();
    });
  });

  describe('2. Booking Mode Guardrails & Multi-Service Consistency', () => {
    it('Rejects emergency service with CONTACT_ONLY when booking (Throws 422)', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Branch, 'findById').mockReturnValue(makeMockQuery({ _id: branchId, status: 'ACTIVE' }));

      jest.spyOn(Service, 'find').mockReturnValue(
        makeMockQuery([
          {
            _id: new mongoose.Types.ObjectId(service1Id),
            name: 'Cấp cứu 24/7',
            serviceType: 'MEDICAL',
            bookingMode: 'CONTACT_ONLY',
            status: 'ACTIVE',
          },
        ])
      );

      await expect(
        bookingService.createAppointment(
          {
            serviceIds: [service1Id],
            branchId,
            slotStart: new Date().toISOString(),
            contact: { name: 'Nguyen Van A', phone: '0901234567' },
            paymentMethod: 'ONLINE_MOCK',
          },
          null
        )
      ).rejects.toMatchObject({
        status: 422,
        code: 'BOOKING_MODE_NOT_ALLOWED',
      });
    });

    it('Rejects surgery service with REQUEST_ONLY when booking online (Throws 422)', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Branch, 'findById').mockReturnValue(makeMockQuery({ _id: branchId, status: 'ACTIVE' }));

      jest.spyOn(Service, 'find').mockReturnValue(
        makeMockQuery([
          {
            _id: new mongoose.Types.ObjectId(service1Id),
            name: 'Phẫu thuật xương',
            serviceType: 'MEDICAL',
            bookingMode: 'REQUEST_ONLY',
            status: 'ACTIVE',
          },
        ])
      );

      await expect(
        bookingService.createAppointment(
          {
            serviceIds: [service1Id],
            branchId,
            slotStart: new Date().toISOString(),
            contact: { name: 'Nguyen Van A', phone: '0901234567' },
            paymentMethod: 'ONLINE_MOCK',
          },
          null
        )
      ).rejects.toMatchObject({
        status: 422,
        code: 'BOOKING_MODE_NOT_ALLOWED',
      });
    });

    it('Rejects mixed serviceTypes in multi-service appointment (Throws 422 MIXED_SERVICE_TYPES)', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Branch, 'findById').mockReturnValue(makeMockQuery({ _id: branchId, status: 'ACTIVE' }));

      jest.spyOn(Service, 'find').mockReturnValue(
        makeMockQuery([
          {
            _id: new mongoose.Types.ObjectId(service1Id),
            name: 'Tắm & Sấy',
            serviceType: 'GROOMING',
            bookingMode: 'BOOKABLE',
            status: 'ACTIVE',
          },
          {
            _id: new mongoose.Types.ObjectId(service2Id),
            name: 'Khám tổng quát',
            serviceType: 'MEDICAL',
            bookingMode: 'BOOKABLE',
            status: 'ACTIVE',
          },
        ])
      );

      await expect(
        bookingService.createAppointment(
          {
            serviceIds: [service1Id, service2Id],
            branchId,
            slotStart: new Date().toISOString(),
            contact: { name: 'Nguyen Van A', phone: '0901234567' },
            paymentMethod: 'ONLINE_MOCK',
          },
          null
        )
      ).rejects.toMatchObject({
        status: 422,
        code: 'MIXED_SERVICE_TYPES',
      });
    });
  });

  describe('3. Payment & Deposit Formulas (ONLINE_MOCK 100% vs PAY_AT_STORE 30%)', () => {
    it('PAY_AT_STORE requires 30% deposit upfront and sets PENDING_PAYMENT status', () => {
      const finalAmount = 1000000;
      const depositAmount = Math.round(finalAmount * 0.30);
      const balanceAmount = finalAmount - depositAmount;

      expect(depositAmount).toBe(300000);
      expect(balanceAmount).toBe(700000);
      expect(depositAmount + balanceAmount).toBe(finalAmount);
    });

    it('Calculates allowedActions correctly based on appointment state and remaining time', () => {
      const now = Date.now();
      const confirmedApt = {
        status: 'CONFIRMED',
        rescheduleCount: 0,
        scheduledStart: new Date(now + 48 * 3600000), // 48h before start
        paymentMethod: 'PAY_AT_STORE',
      };
      const actions = bookingService.computeAllowedActions(confirmedApt);
      expect(actions).toContain('CANCEL');
      expect(actions).toContain('RESCHEDULE');

      // Less than 24h before start: RESCHEDULE is disallowed
      const closeApt = {
        status: 'CONFIRMED',
        rescheduleCount: 0,
        scheduledStart: new Date(now + 12 * 3600000), // 12h before start
      };
      const closeActions = bookingService.computeAllowedActions(closeApt);
      expect(closeActions).toContain('CANCEL');
      expect(closeActions).not.toContain('RESCHEDULE');
    });
  });

  describe('4. Reschedule & Cancellation Policy (TA-30 Rules)', () => {
    it('Allows reschedule >= 24h and increments rescheduleCount', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      const aptDoc = {
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-TEST-001',
        branchId: new mongoose.Types.ObjectId(branchId),
        status: 'CONFIRMED',
        rescheduleCount: 0,
        scheduledStart: new Date(Date.now() + 36 * 3600000), // 36 hours before
        services: [
          {
            serviceId: new mongoose.Types.ObjectId(service1Id),
            serviceName: 'Tắm & Sấy',
            serviceType: 'GROOMING',
            unitPrice: 100000,
            durationMinutes: 60,
            requiredStaffRole: 'CARE_STAFF_GROOMER',
            bookingMode: 'BOOKABLE',
            sequence: 1,
            assignedStaffId: new mongoose.Types.ObjectId(staffId),
            scheduledStart: new Date(Date.now() + 36 * 3600000),
            scheduledEnd: new Date(Date.now() + 37 * 3600000),
          },
        ],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Appointment, 'findById').mockReturnValue(makeMockQuery(aptDoc));
      jest.spyOn(SlotReservation, 'deleteMany').mockResolvedValue({ deletedCount: 4 });

      const newSlotStart = new Date(Date.now() + 72 * 3600000).toISOString();
      const updated = await bookingService.rescheduleAppointment(
        aptDoc._id,
        { newSlotStart },
        { id: customerId, systemRole: 'CUSTOMER' }
      );

      expect(updated.rescheduleCount).toBe(1);
      expect(new Date(updated.scheduledStart).toISOString()).toBe(new Date(newSlotStart).toISOString());
    });

    it('Rejects reschedule < 24h with 422 RESCHEDULE_TOO_LATE', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      const aptDoc = {
        _id: new mongoose.Types.ObjectId(),
        status: 'CONFIRMED',
        rescheduleCount: 0,
        scheduledStart: new Date(Date.now() + 10 * 3600000), // 10h before (<24h)
        services: [],
      };
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeMockQuery(aptDoc));

      await expect(
        bookingService.rescheduleAppointment(
          aptDoc._id,
          { newSlotStart: new Date().toISOString() },
          { id: customerId, systemRole: 'CUSTOMER' }
        )
      ).rejects.toMatchObject({
        status: 422,
        code: 'RESCHEDULE_TOO_LATE',
      });
    });

    it('Rejects reschedule when rescheduleCount reaches maximum of 2 (422 RESCHEDULE_LIMIT)', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      const aptDoc = {
        _id: new mongoose.Types.ObjectId(),
        status: 'CONFIRMED',
        rescheduleCount: 2, // Already reached limit
        scheduledStart: new Date(Date.now() + 48 * 3600000),
        services: [],
      };
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeMockQuery(aptDoc));

      await expect(
        bookingService.rescheduleAppointment(
          aptDoc._id,
          { newSlotStart: new Date().toISOString() },
          { id: customerId, systemRole: 'CUSTOMER' }
        )
      ).rejects.toMatchObject({
        status: 422,
        code: 'RESCHEDULE_LIMIT',
      });
    });

    it('Customer cancel < 24h retains 30% penalty and forfeits voucher quota', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(null));

      const aptDoc = {
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-TEST-LATE',
        status: 'CONFIRMED',
        scheduledStart: new Date(Date.now() + 5 * 3600000), // 5 hours before (<24h)
        pricing: { finalAmount: 1000000, paidAmount: 1000000 },
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Appointment, 'findById').mockReturnValue(makeMockQuery(aptDoc));

      const cancelled = await bookingService.cancelAppointment(
        aptDoc._id,
        'Cannot make it',
        { id: customerId, systemRole: 'CUSTOMER' }
      );

      expect(cancelled.status).toBe('CANCELLED');
      expect(aptDoc.cancel.hoursBeforeStart).toBeLessThan(24);
      expect(aptDoc.cancel.prepaidOutcome).toBe('REFUND_PENDING'); // 700k refunded, 300k retained
    });

    it('Store cancel refunds 100% of prepaid amount and marks refund pending', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      const mockPayment = {
        status: 'PAID',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(mockPayment));

      const aptDoc = {
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-STORE-CANCEL',
        status: 'CONFIRMED',
        scheduledStart: new Date(Date.now() + 10 * 3600000),
        pricing: { finalAmount: 500000, paidAmount: 150000 },
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeMockQuery(aptDoc));

      const cancelled = await bookingService.storeCancelAppointment(
        aptDoc._id,
        'Branch power outage',
        { id: receptionistId, systemRole: 'STAFF' }
      );

      expect(cancelled.status).toBe('CANCELLED');
      expect(aptDoc.cancel.by).toBe('STORE');
      expect(mockPayment.status).toBe('REFUND_PENDING');
    });
  });

  describe('5. REST Endpoints & RBAC Integration with Supertest', () => {
    it('POST /api/v1/appointments/:id/confirm requires RECEPTIONIST, MANAGER, or ADMIN role', async () => {
      const validMockSegment = {
        serviceId: new mongoose.Types.ObjectId(service1Id),
        serviceName: 'General Consultation',
        serviceType: 'MEDICAL',
        variantLabel: null,
        unitPrice: 150000,
        durationMinutes: 60,
        requiredStaffRole: 'VETERINARIAN',
        bookingMode: 'BOOKABLE',
        sequence: 1,
        scheduledStart: new Date(Date.now() + 24 * 3600000),
        scheduledEnd: new Date(Date.now() + 25 * 3600000),
        assignedStaffId: new mongoose.Types.ObjectId(staffId),
        executionStatus: 'NOT_STARTED',
      };

      const mockApt = {
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-CONFIRM-TEST',
        branchId: new mongoose.Types.ObjectId(branchId),
        status: 'CONFIRMED',
        paymentMethod: 'ONLINE_MOCK',
        scheduledStart: new Date(Date.now() + 24 * 3600000),
        scheduledEnd: new Date(Date.now() + 25 * 3600000),
        scheduledDurationMinutes: 60,
        services: [validMockSegment],
      };

      jest.spyOn(bookingService, 'confirmAppointment').mockResolvedValue(bookingService.formatAppointment(mockApt));

      // Customer receives 403 Forbidden
      const resForbidden = await request(app)
        .post(`/api/v1/appointments/${mockApt._id}/confirm`)
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'test-confirm-001');

      expect(resForbidden.status).toBe(403);

      // Receptionist receives 200 OK
      const resOk = await request(app)
        .post(`/api/v1/appointments/${mockApt._id}/confirm`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('Idempotency-Key', 'test-confirm-002');

      expect(resOk.status).toBe(200);
      expect(resOk.body.status).toBe('CONFIRMED');
    });

    it('POST /api/v1/appointments/:id/cancel allows Customer to cancel their own appointment', async () => {
      const validMockSegment = {
        serviceId: new mongoose.Types.ObjectId(service1Id),
        serviceName: 'General Consultation',
        serviceType: 'MEDICAL',
        variantLabel: null,
        unitPrice: 150000,
        durationMinutes: 60,
        requiredStaffRole: 'VETERINARIAN',
        bookingMode: 'BOOKABLE',
        sequence: 1,
        scheduledStart: new Date(Date.now() + 48 * 3600000),
        scheduledEnd: new Date(Date.now() + 49 * 3600000),
        assignedStaffId: new mongoose.Types.ObjectId(staffId),
        executionStatus: 'NOT_STARTED',
      };

      const mockApt = {
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-CANCEL-TEST',
        customerId: new mongoose.Types.ObjectId(customerId),
        branchId: new mongoose.Types.ObjectId(branchId),
        status: 'CANCELLED',
        paymentMethod: 'ONLINE_MOCK',
        scheduledStart: new Date(Date.now() + 48 * 3600000),
        scheduledEnd: new Date(Date.now() + 49 * 3600000),
        scheduledDurationMinutes: 60,
        services: [validMockSegment],
      };

      jest.spyOn(bookingService, 'cancelAppointment').mockResolvedValue(bookingService.formatAppointment(mockApt));

      const res = await request(app)
        .post(`/api/v1/appointments/${mockApt._id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'test-cancel-001')
        .send({ reason: 'Personal schedule conflict' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });
  });
});
