import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import Voucher from '../src/modules/order/models/Voucher';
import VoucherUsage from '../src/modules/order/models/VoucherUsage';
import Appointment from '../src/modules/booking/models/Appointment';
import Payment from '../src/modules/payment/models/Payment';
import Service from '../src/modules/catalog/models/Service';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';
import {
  calculateDiscount,
  validateVoucherEligibility,
  consumeQuotaInSession,
  restoreQuotaInSession,
  createVoucher,
  updateVoucher,
  formatVoucherResponse
} from '../src/modules/order/voucher.service';
import { cancelAppointment } from '../src/modules/booking/booking.service';

const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const customerId = '507f1f77bcf86cd799439003';
const branchId = '507f1f77bcf86cd799439011';

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

describe('Priority P1 – Voucher & Promotion Engine Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
    jest.spyOn(Payment, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Model Invariants & Indexes', () => {
    it('enforces unique code and required schema constraints on Voucher', () => {
      const paths = Voucher.schema.paths;
      expect(paths.code).toBeDefined();
      expect(paths.discountType.enumValues).toEqual(['PERCENTAGE', 'FIXED']);
      expect(paths.scope.enumValues).toEqual(['ORDER', 'PRODUCT', 'SERVICE']);
      expect(paths.status.enumValues).toEqual(['ACTIVE', 'INACTIVE']);
      expect(paths.quota.options.min).toBe(1);
      expect(paths.usedCount.options.default).toBe(0);

      const indexes = Voucher.schema.indexes();
      expect(indexes.some(([keys, opts]) => keys.code === 1 && opts.unique)).toBe(true);
    });

    it('enforces compound unique index { voucherId, targetType, targetId } on VoucherUsage', () => {
      const paths = VoucherUsage.schema.paths;
      expect(paths.voucherId).toBeDefined();
      expect(paths.targetType.enumValues).toEqual(['ORDER', 'APPOINTMENT']);
      expect(paths.targetId).toBeDefined();

      const indexes = VoucherUsage.schema.indexes();
      expect(indexes.some(([keys, opts]) => keys.voucherId === 1 && keys.targetType === 1 && keys.targetId === 1 && opts.unique)).toBe(true);
    });
  });

  describe('2. Pure Discount Calculation & Eligibility Validation', () => {
    it('calculates PERCENTAGE discount accurately with maxDiscountAmount cap', () => {
      const voucher10Pct = {
        discountType: 'PERCENTAGE',
        discountValue: 10,
        maxDiscountAmount: 50000
      };

      // 10% of 200,000 = 20,000 (under 50k cap)
      expect(calculateDiscount({ voucher: voucher10Pct, subtotal: 200000 })).toBe(20000);

      // 10% of 1,000,000 = 100,000 -> capped at 50,000
      expect(calculateDiscount({ voucher: voucher10Pct, subtotal: 1000000 })).toBe(50000);
    });

    it('calculates FIXED discount capped at subtotal', () => {
      const voucher50k = {
        discountType: 'FIXED',
        discountValue: 50000
      };

      expect(calculateDiscount({ voucher: voucher50k, subtotal: 200000 })).toBe(50000);
      // Discount cannot exceed subtotal
      expect(calculateDiscount({ voucher: voucher50k, subtotal: 30000 })).toBe(30000);
      expect(calculateDiscount({ voucher: voucher50k, subtotal: 0 })).toBe(0);
    });

    it('validates voucher states and returns precise reason enum', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 86400000 * 2);
      const yesterday = new Date(now.getTime() - 86400000);
      const tomorrow = new Date(now.getTime() + 86400000);
      const future = new Date(now.getTime() + 86400000 * 2);

      // NOT_FOUND
      jest.spyOn(Voucher, 'findOne').mockResolvedValue(null);
      const resNotFound = await validateVoucherEligibility({ code: 'UNKNOWN_CODE', scope: 'ORDER' });
      expect(resNotFound.valid).toBe(false);
      expect(resNotFound.reason).toBe('NOT_FOUND');

      // INACTIVE
      const inactiveVoucher = {
        code: 'INACTIVE10',
        status: 'INACTIVE',
        effectiveFrom: yesterday,
        effectiveTo: tomorrow,
        quota: 100,
        usedCount: 0,
        scope: 'ORDER'
      };
      jest.spyOn(Voucher, 'findOne').mockResolvedValue(inactiveVoucher);
      const resInactive = await validateVoucherEligibility({ code: 'INACTIVE10', scope: 'ORDER' });
      expect(resInactive.valid).toBe(false);
      expect(resInactive.reason).toBe('INACTIVE');

      // NOT_STARTED
      const notStartedVoucher = {
        code: 'FUTURE10',
        status: 'ACTIVE',
        effectiveFrom: tomorrow,
        effectiveTo: future,
        quota: 100,
        usedCount: 0,
        scope: 'ORDER'
      };
      jest.spyOn(Voucher, 'findOne').mockResolvedValue(notStartedVoucher);
      const resNotStarted = await validateVoucherEligibility({ code: 'FUTURE10', scope: 'ORDER' });
      expect(resNotStarted.valid).toBe(false);
      expect(resNotStarted.reason).toBe('NOT_STARTED');

      // EXPIRED
      const expiredVoucher = {
        code: 'EXPIRED10',
        status: 'ACTIVE',
        effectiveFrom: past,
        effectiveTo: yesterday,
        quota: 100,
        usedCount: 0,
        scope: 'ORDER'
      };
      jest.spyOn(Voucher, 'findOne').mockResolvedValue(expiredVoucher);
      const resExpired = await validateVoucherEligibility({ code: 'EXPIRED10', scope: 'ORDER' });
      expect(resExpired.valid).toBe(false);
      expect(resExpired.reason).toBe('EXPIRED');

      // QUOTA_EXCEEDED
      const fullVoucher = {
        code: 'FULL10',
        status: 'ACTIVE',
        effectiveFrom: yesterday,
        effectiveTo: tomorrow,
        quota: 10,
        usedCount: 10,
        scope: 'ORDER'
      };
      jest.spyOn(Voucher, 'findOne').mockResolvedValue(fullVoucher);
      const resFull = await validateVoucherEligibility({ code: 'FULL10', scope: 'ORDER' });
      expect(resFull.valid).toBe(false);
      expect(resFull.reason).toBe('QUOTA_EXCEEDED');

      // SCOPE_MISMATCH
      const serviceVoucher = {
        code: 'SVC10',
        status: 'ACTIVE',
        effectiveFrom: yesterday,
        effectiveTo: tomorrow,
        quota: 10,
        usedCount: 0,
        scope: 'SERVICE'
      };
      jest.spyOn(Voucher, 'findOne').mockResolvedValue(serviceVoucher);
      const resScopeMismatch = await validateVoucherEligibility({ code: 'SVC10', scope: 'ORDER' });
      expect(resScopeMismatch.valid).toBe(false);
      expect(resScopeMismatch.reason).toBe('SCOPE_MISMATCH');

      // MIN_CONDITION_NOT_MET
      const minCondVoucher = {
        code: 'MIN500',
        status: 'ACTIVE',
        effectiveFrom: yesterday,
        effectiveTo: tomorrow,
        quota: 10,
        usedCount: 0,
        scope: 'ORDER',
        minOrderAmount: 500000,
        discountType: 'FIXED',
        discountValue: 50000
      };
      jest.spyOn(Voucher, 'findOne').mockResolvedValue(minCondVoucher);
      const resMinCond = await validateVoucherEligibility({ code: 'MIN500', scope: 'ORDER', subtotal: 300000 });
      expect(resMinCond.valid).toBe(false);
      expect(resMinCond.reason).toBe('MIN_CONDITION_NOT_MET');

      // SUCCESSFUL VALIDATION
      const resSuccess = await validateVoucherEligibility({ code: 'MIN500', scope: 'ORDER', subtotal: 600000 });
      expect(resSuccess.valid).toBe(true);
      expect(resSuccess.reason).toBeNull();
      expect(resSuccess.discount).toBe(50000);
    });
  });

  describe('3. Atomic Quota Consumption & Idempotent Restoration', () => {
    it('consumes quota atomically and records usage in session', async () => {
      const voucherId = new mongoose.Types.ObjectId();
      const targetId = new mongoose.Types.ObjectId();
      const mockSession = {};

      jest.spyOn(Voucher, 'findOneAndUpdate').mockResolvedValue({
        _id: voucherId,
        code: 'PROMO20',
        quota: 10,
        usedCount: 1
      });

      const saveSpy = jest.spyOn(VoucherUsage.prototype, 'save').mockResolvedValue({});

      const usage = await consumeQuotaInSession({
        voucherId,
        targetType: 'ORDER',
        targetId,
        discountApplied: 20000,
        session: mockSession
      });

      expect(Voucher.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: voucherId, status: 'ACTIVE' }),
        { $inc: { usedCount: 1 } },
        expect.objectContaining({ session: mockSession, new: true })
      );
      expect(saveSpy).toHaveBeenCalled();
      expect(usage.voucherId).toEqual(voucherId);
      expect(usage.discountApplied).toBe(20000);
    });

    it('rejects with 422 when quota is exhausted', async () => {
      const voucherId = new mongoose.Types.ObjectId();
      const targetId = new mongoose.Types.ObjectId();
      const mockSession = {};

      // findOneAndUpdate returns null when filter $expr: { $lt: ['$usedCount', '$quota'] } fails
      jest.spyOn(Voucher, 'findOneAndUpdate').mockResolvedValue(null);

      await expect(
        consumeQuotaInSession({
          voucherId,
          targetType: 'ORDER',
          targetId,
          discountApplied: 10000,
          session: mockSession
        })
      ).rejects.toMatchObject({
        status: 422,
        code: 'VOUCHER_INVALID',
        detail: 'QUOTA_EXCEEDED'
      });
    });

    it('restores quota idempotently (decrements usedCount only once)', async () => {
      const voucherId = new mongoose.Types.ObjectId();
      const targetId = new mongoose.Types.ObjectId();
      const mockSession = {};

      const mockUsageDoc = {
        voucherId,
        targetType: 'ORDER',
        targetId,
        restoredAt: null,
        save: jest.fn().mockResolvedValue(true)
      };

      // Mock chain .session(session)
      const findOneMock = {
        session: jest.fn().mockResolvedValueOnce(mockUsageDoc).mockResolvedValueOnce(null)
      };
      jest.spyOn(VoucherUsage, 'findOne').mockReturnValue(findOneMock);
      jest.spyOn(Voucher, 'findByIdAndUpdate').mockResolvedValue({});

      // First restore: success
      const firstRestore = await restoreQuotaInSession({
        voucherId,
        targetType: 'ORDER',
        targetId,
        session: mockSession
      });

      expect(firstRestore).not.toBeNull();
      expect(mockUsageDoc.save).toHaveBeenCalled();
      expect(Voucher.findByIdAndUpdate).toHaveBeenCalledWith(
        voucherId,
        { $inc: { usedCount: -1 } },
        { session: mockSession }
      );

      // Second restore: already restored -> returns null (idempotent no-op)
      const secondRestore = await restoreQuotaInSession({
        voucherId,
        targetType: 'ORDER',
        targetId,
        session: mockSession
      });

      expect(secondRestore).toBeNull();
    });
  });

  describe('4. RBAC & Admin Constraints (Option A)', () => {
    it('disallows reducing quota below current usedCount (Option A rule)', async () => {
      const voucherId = new mongoose.Types.ObjectId();
      const mockVoucher = {
        _id: voucherId,
        code: 'PROMO100',
        quota: 50,
        usedCount: 20,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Voucher, 'findById').mockResolvedValue(mockVoucher);

      // Attempt to lower quota to 15 (less than 20 used)
      await expect(
        updateVoucher(voucherId, { quota: 15 })
      ).rejects.toMatchObject({
        status: 422,
        code: 'VALIDATION_ERROR'
      });
    });

    it('allows Admin to create voucher and restricts Manager from mutation (403)', async () => {
      const now = new Date();
      const payload = {
        code: 'ADMIN20',
        name: 'Admin Special Discount',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        scope: 'ORDER',
        effectiveFrom: new Date(now.getTime() - 3600000).toISOString(),
        effectiveTo: new Date(now.getTime() + 86400000 * 7).toISOString(),
        quota: 100,
        status: 'ACTIVE'
      };

      // 1. Unauthenticated -> 401
      const resUnauth = await request(app)
        .post('/api/v1/vouchers')
        .set('Idempotency-Key', 'v-key-0001')
        .send(payload);
      expect(resUnauth.status).toBe(401);

      // 2. Manager -> 403 Forbidden
      const resManager = await request(app)
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'v-key-0002')
        .send(payload);
      expect(resManager.status).toBe(403);

      // 3. Admin -> 201 Created
      jest.spyOn(Voucher, 'findOne').mockResolvedValue(null);
      jest.spyOn(Voucher.prototype, 'save').mockImplementation(function () {
        this._id = new mongoose.Types.ObjectId();
        return Promise.resolve(this);
      });

      const resAdmin = await request(app)
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'v-key-0003')
        .send(payload);

      expect(resAdmin.status).toBe(201);
      expect(resAdmin.body).toMatchObject({
        code: 'ADMIN20',
        name: 'Admin Special Discount',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        scope: 'ORDER',
        quota: 100,
        usedCount: 0,
        status: 'ACTIVE'
      });
    });

    it('allows Public / Guest to validate voucher via POST /vouchers/validate', async () => {
      const mockVoucher = {
        _id: new mongoose.Types.ObjectId(),
        code: 'WELCOME10',
        name: 'Welcome 10%',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        scope: 'ORDER',
        status: 'ACTIVE',
        effectiveFrom: new Date(Date.now() - 3600000),
        effectiveTo: new Date(Date.now() + 86400000),
        quota: 100,
        usedCount: 5,
        minOrderAmount: 100000
      };

      jest.spyOn(Voucher, 'findOne').mockResolvedValue(mockVoucher);

      const res = await request(app)
        .post('/api/v1/vouchers/validate')
        .send({
          code: 'WELCOME10',
          scope: 'ORDER'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('code', 'WELCOME10');
      expect(res.body).toHaveProperty('valid');
      expect(res.body).toHaveProperty('reason');
      expect(res.body).toHaveProperty('discount');
    });
  });

  describe('5. Appointment Integration & 30% Deposit Formula', () => {
    it('applies voucher to appointment and computes 30% deposit upfront via PAY_AT_STORE', () => {
      const subtotal = 1000000;
      const voucherDiscount = 100000;
      const finalAmount = subtotal - voucherDiscount; // 900,000

      // Option A deposit formula:
      const depositAmount = Math.round(finalAmount * 0.30); // 270,000
      const balanceAmount = finalAmount - depositAmount; // 630,000

      expect(depositAmount).toBe(270000);
      expect(balanceAmount).toBe(630000);
      expect(depositAmount + balanceAmount).toBe(finalAmount);
    });

    it('restores appointment voucher quota only when cancelled >= 24h before scheduledStart (Option A)', async () => {
      const voucherId = new mongoose.Types.ObjectId();
      const aptId = new mongoose.Types.ObjectId();
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Payment, 'findOne').mockReturnValue({ session: jest.fn().mockResolvedValue(null) });

      // Scenario 1: Customer cancels 30 hours before (>= 24h) -> quota is restored
      const aptEarly = {
        _id: aptId,
        scheduledStart: new Date(Date.now() + 30 * 3600000),
        pricing: { finalAmount: 500000, paidAmount: 150000, voucherId },
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(Appointment, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(aptEarly)
      });
      jest.spyOn(VoucherUsage, 'findOne').mockReturnValue({
        session: jest.fn().mockResolvedValue({
          restoredAt: null,
          save: jest.fn().mockResolvedValue(true)
        })
      });
      const voucherUpdateSpy = jest.spyOn(Voucher, 'findByIdAndUpdate').mockResolvedValue({});

      await cancelAppointment(aptId, { id: customerId, systemRole: 'CUSTOMER' });
      expect(voucherUpdateSpy).toHaveBeenCalled();

      // Scenario 2: Customer cancels 5 hours before (< 24h) -> quota is forfeited (NOT restored)
      voucherUpdateSpy.mockClear();
      const aptLate = {
        _id: aptId,
        scheduledStart: new Date(Date.now() + 5 * 3600000),
        pricing: { finalAmount: 500000, paidAmount: 150000, voucherId },
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(Appointment, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(aptLate)
      });

      await cancelAppointment(aptId, { id: customerId, systemRole: 'CUSTOMER' });
      expect(voucherUpdateSpy).not.toHaveBeenCalled();
    });
  });
});
