import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import config from '../src/shared/config';
import Appointment from '../src/modules/booking/models/Appointment';
import SlotReservation from '../src/modules/booking/models/SlotReservation';
import BookingRefund from '../src/modules/payment/models/BookingRefund';
import Payment from '../src/modules/payment/models/Payment';
import StaffProfile from '../src/modules/staff/models/StaffProfile';
import * as bookingRefundService from '../src/modules/booking/bookingRefund.service';
import * as bookingService from '../src/modules/booking/booking.service';
import { processAppointmentHoldExpiries } from '../src/worker/cronjobs';

const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const receptionistId = '507f1f77bcf86cd799439004';
const customerId = '507f1f77bcf86cd799439003';
const vetStaffId = '507f1f77bcf86cd799439005';
const branchId = '507f1f77bcf86cd799439011';

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

describe('Task 4.3: Appointment E2E & BookingRefund Lifecycle Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. BookingRefund Model Invariants & Guardrails', () => {
    it('enforces schema paths and allowed status enum values for BookingRefund', () => {
      const paths = BookingRefund.schema.paths;
      expect(paths.paymentId).toBeDefined();
      expect(paths.appointmentId).toBeDefined();
      expect(paths.amount).toBeDefined();
      expect(paths.rule.enumValues).toEqual([
        'CUSTOMER_EARLY_FULL',
        'CUSTOMER_LATE_RETAIN_30',
        'SYSTEM_FULL',
      ]);
      expect(paths.status.enumValues).toEqual([
        'REQUESTED',
        'PROCESSING',
        'APPROVED',
        'REJECTED',
        'REFUNDED',
      ]);
    });

    it('requires positive amount and required payment/appointment references', () => {
      const invalidDoc = new BookingRefund({});
      const err = invalidDoc.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.paymentId).toBeDefined();
      expect(err.errors.appointmentId).toBeDefined();
      expect(err.errors.amount).toBeDefined();
      expect(err.errors.rule).toBeDefined();
    });
  });

  describe('2. BookingRefund Service & State Transitions', () => {
    const mockPaymentId = new mongoose.Types.ObjectId();
    const mockAptId = new mongoose.Types.ObjectId();

    it('requestRefund creates BookingRefund in REQUESTED state for cancelled appointment', async () => {
      const mockAppointment = {
        _id: mockAptId,
        customerId,
        status: 'CANCELLED',
        cancellationReason: 'CUSTOMER_CANCEL',
        scheduledStart: new Date(Date.now() + 48 * 3600000), // > 24h
        pricing: { finalAmount: 200000 },
      };

      const mockPayment = {
        _id: mockPaymentId,
        paidAmount: 200000,
        status: 'PAID',
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);
      jest.spyOn(Payment, 'findOne').mockResolvedValue(mockPayment);
      jest.spyOn(BookingRefund, 'findOne').mockResolvedValue(null);
      jest.spyOn(BookingRefund.prototype, 'save').mockResolvedValue(true);

      const result = await bookingRefundService.requestRefund(
        { appointmentId: mockAptId.toString(), reason: 'Customer change plans' },
        { id: customerId, systemRole: 'CUSTOMER' }
      );

      expect(result).toHaveProperty('id');
      expect(result.amount).toBe(200000);
      expect(result.rule).toBe('CUSTOMER_EARLY_FULL');
      expect(result.status).toBe('REQUESTED');
    });

    it('receiveRefund transitions REQUESTED -> PROCESSING by Receptionist', async () => {
      const mockRefund = {
        _id: new mongoose.Types.ObjectId(),
        paymentId: mockPaymentId,
        appointmentId: mockAptId,
        amount: 200000,
        status: 'REQUESTED',
        history: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(BookingRefund, 'findById').mockResolvedValue(mockRefund);

      const result = await bookingRefundService.receiveRefund(
        mockRefund._id.toString(),
        'Receptionist verified details',
        { id: receptionistId, systemRole: 'STAFF', staffSubRole: 'RECEPTIONIST' }
      );

      expect(mockRefund.status).toBe('PROCESSING');
      expect(mockRefund.history).toHaveLength(1);
      expect(result.status).toBe('PROCESSING');
    });

    it('rejectRefund transitions PROCESSING -> REJECTED with mandatory reason', async () => {
      const mockRefund = {
        _id: new mongoose.Types.ObjectId(),
        paymentId: mockPaymentId,
        appointmentId: mockAptId,
        amount: 200000,
        status: 'PROCESSING',
        history: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(BookingRefund, 'findById').mockResolvedValue(mockRefund);

      const result = await bookingRefundService.rejectRefund(
        mockRefund._id.toString(),
        'Already used service at branch',
        { id: managerId, systemRole: 'MANAGER' }
      );

      expect(mockRefund.status).toBe('REJECTED');
      expect(mockRefund.rejectedReason).toBe('Already used service at branch');
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('3. Hold Expiry Background Job (ADR-41)', () => {
    it('cancels expired appointment holds, releases SlotReservation, and issues full refund', async () => {
      const mockExpiredApt = {
        _id: new mongoose.Types.ObjectId(),
        status: 'PENDING_CONFIRMATION',
        holdExpiresAt: new Date(Date.now() - 60000), // Expired 1 min ago
        pricing: { paidAmount: 60000 },
        cancel: null,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        target: { id: mockExpiredApt._id },
        paidAmount: 60000,
      };

      jest.spyOn(Appointment, 'find').mockResolvedValue([mockExpiredApt]);
      jest.spyOn(SlotReservation, 'updateMany').mockResolvedValue({ modifiedCount: 2 });
      jest.spyOn(Payment, 'findOne').mockResolvedValue(mockPayment);
      jest.spyOn(BookingRefund, 'findOne').mockResolvedValue(null);
      jest.spyOn(BookingRefund.prototype, 'save').mockResolvedValue(true);

      const processedIds = await processAppointmentHoldExpiries();

      expect(processedIds).toContain(mockExpiredApt._id.toString());
      expect(mockExpiredApt.status).toBe('CANCELLED');
      expect(mockExpiredApt.cancel.by).toBe('SYSTEM');
      expect(mockExpiredApt.cancel.reason).toBe('HOLD_EXPIRED_TIMEOUT');
      expect(SlotReservation.updateMany).toHaveBeenCalledWith(
        { appointmentId: mockExpiredApt._id, status: 'HELD' },
        { $set: { status: 'RELEASED' } }
      );
    });
  });

  describe('4. Reviewer Assignment (PUT /appointments/:id/reviewer)', () => {
    const mockAptId = new mongoose.Types.ObjectId();

    it('rejects reviewer assignment if user is not authorized (Customer)', async () => {
      const res = await request(app)
        .put(`/api/v1/appointments/${mockAptId}/reviewer`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ staffId: vetStaffId, expectedVersion: 1 });

      expect(res.status).toBe(403);
    });

    it('rejects reviewer assignment if expectedVersion does not match (CAS conflict)', async () => {
      const mockAppointment = {
        _id: mockAptId,
        status: 'CONFIRMED',
        version: 2, // version mismatch: request sends 1
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);

      const res = await request(app)
        .put(`/api/v1/appointments/${mockAptId}/reviewer`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ staffId: vetStaffId, expectedVersion: 1 });

      expect(res.status).toBe(409);
    });

    it('successfully assigns reviewer when staff is active Veterinarian and version matches', async () => {
      const mockAppointment = {
        _id: mockAptId,
        status: 'CONFIRMED',
        version: 1,
        branchId,
        serviceType: 'MEDICAL',
        services: [
          {
            serviceId: new mongoose.Types.ObjectId(),
            serviceName: 'Khám thú y tổng quát',
            serviceType: 'MEDICAL',
            unitPrice: 150000,
            durationMinutes: 60,
            requiredStaffRole: 'VETERINARIAN',
            bookingMode: 'BOOKABLE',
            sequence: 1,
            scheduledStart: new Date(),
            scheduledEnd: new Date(Date.now() + 3600000),
            assignedStaffId: new mongoose.Types.ObjectId(),
            executionStatus: 'NOT_STARTED',
          },
        ],
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 3600000),
        scheduledDurationMinutes: 60,
        paymentMethod: 'PAY_AT_STORE',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockVetProfile = {
        _id: new mongoose.Types.ObjectId(vetStaffId),
        staffSubRole: 'VETERINARIAN',
        status: 'ACTIVE',
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValue(mockAppointment);
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue(mockVetProfile);

      const res = await request(app)
        .put(`/api/v1/appointments/${mockAptId}/reviewer`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ staffId: vetStaffId, expectedVersion: 1 });

      expect(res.status).toBe(200);
      expect(mockAppointment.reviewerStaffId).toBe(vetStaffId);
      expect(mockAppointment.version).toBe(2);
    });
  });

  describe('5. REST Endpoints for BookingRefund', () => {
    const validRefundId = '507f1f77bcf86cd799439090';
    const validPaymentId = '507f1f77bcf86cd799439091';
    const validAppointmentId = '507f1f77bcf86cd799439092';

    it('POST /api/v1/booking-refunds creates refund request', async () => {
      jest.spyOn(bookingRefundService, 'requestRefund').mockResolvedValue({
        id: validRefundId,
        paymentId: validPaymentId,
        appointmentId: validAppointmentId,
        amount: 150000,
        rule: 'CUSTOMER_EARLY_FULL',
        status: 'REQUESTED',
        history: [],
      });

      const res = await request(app)
        .post('/api/v1/booking-refunds')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'refund-req-001')
        .send({ appointmentId: validAppointmentId, reason: 'Customer changed plans' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('REQUESTED');
      expect(res.body.amount).toBe(150000);
    });

    it('POST /api/v1/booking-refunds/:id/receive transitions to PROCESSING for Receptionist', async () => {
      jest.spyOn(bookingRefundService, 'receiveRefund').mockResolvedValue({
        id: validRefundId,
        paymentId: validPaymentId,
        appointmentId: validAppointmentId,
        amount: 150000,
        rule: 'CUSTOMER_EARLY_FULL',
        status: 'PROCESSING',
        history: [],
      });

      const res = await request(app)
        .post(`/api/v1/booking-refunds/${validRefundId}/receive`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .set('Idempotency-Key', 'refund-recv-001')
        .send({ note: 'Receptionist receiving refund' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PROCESSING');
    });

    it('POST /api/v1/booking-refunds/:id/approve transitions to REFUNDED for Manager', async () => {
      jest.spyOn(bookingRefundService, 'approveRefund').mockResolvedValue({
        id: validRefundId,
        paymentId: validPaymentId,
        appointmentId: validAppointmentId,
        amount: 150000,
        rule: 'CUSTOMER_EARLY_FULL',
        status: 'REFUNDED',
        history: [],
      });

      const res = await request(app)
        .post(`/api/v1/booking-refunds/${validRefundId}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'refund-appr-001')
        .send({ note: 'Approved by branch manager' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REFUNDED');
    });

    it('POST /api/v1/booking-refunds/:id/reject transitions to REJECTED for Admin', async () => {
      jest.spyOn(bookingRefundService, 'rejectRefund').mockResolvedValue({
        id: validRefundId,
        paymentId: validPaymentId,
        appointmentId: validAppointmentId,
        amount: 150000,
        rule: 'CUSTOMER_EARLY_FULL',
        status: 'REJECTED',
        history: [],
      });

      const res = await request(app)
        .post(`/api/v1/booking-refunds/${validRefundId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'refund-rej-001')
        .send({ reason: 'Invalid claim' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('REJECTED');
    });
  });
});
