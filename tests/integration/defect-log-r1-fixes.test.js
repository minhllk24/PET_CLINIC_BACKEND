import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import config from '../../src/shared/config';
import { hashOtp } from '../../src/utils/otpHelpers';
import User from '../../src/models/User';
import OtpChallenge from '../../src/models/OtpChallenge';
import RefreshSession from '../../src/models/RefreshSession';
import AuditLog from '../../src/models/AuditLog';
import Pet from '../../src/modules/customer/models/Pet';
import Customer from '../../src/modules/customer/models/Customer';
import GuestContact from '../../src/modules/customer/models/GuestContact';
import Order from '../../src/modules/order/models/Order';
import Cart from '../../src/modules/cart/models/Cart';
import SystemSetting from '../../src/modules/settings/models/SystemSetting';
import OrderReturn from '../../src/modules/order/models/OrderReturn';
import Voucher from '../../src/modules/order/models/Voucher';
import Branch from '../../src/modules/branch/models/Branch';
import BranchServiceConfig from '../../src/modules/branch/models/BranchServiceConfig';
import Service from '../../src/modules/catalog/models/Service';
import Product from '../../src/modules/catalog/models/Product';
import InventoryItem from '../../src/modules/inventory/models/InventoryItem';
import InventoryStock from '../../src/modules/inventory/models/InventoryStock';
import InventoryTransaction from '../../src/modules/inventory/models/InventoryTransaction';
import Payment from '../../src/modules/payment/models/Payment';
import Appointment from '../../src/modules/booking/models/Appointment';
import BookingRefund from '../../src/modules/payment/models/BookingRefund';
import SlotReservation from '../../src/modules/booking/models/SlotReservation';
import Shift from '../../src/modules/staff/models/Shift';
import StaffProfile from '../../src/modules/staff/models/StaffProfile';
import ServiceRecord from '../../src/modules/execution/models/ServiceRecord';
import Review from '../../src/modules/review/models/Review';
import AdoptionRequest from '../../src/modules/content/models/AdoptionRequest';
import RescuePet from '../../src/modules/content/models/RescuePet';
import CommunityPost from '../../src/modules/content/models/CommunityPost';
import CommunityComment from '../../src/modules/content/models/CommunityComment';

import * as guestService from '../../src/modules/customer/guest.service';
import * as catalogService from '../../src/modules/catalog/catalog.service';
import * as recommendationService from '../../src/modules/recommendation/recommendation.service';
import * as reviewService from '../../src/modules/review/review.service';
import * as bookingService from '../../src/modules/booking/booking.service';
import * as bookingRefundService from '../../src/modules/booking/bookingRefund.service';
import * as availabilityService from '../../src/modules/booking/availability.service';
import * as paymentService from '../../src/modules/payment/payment.service';
import * as returnService from '../../src/modules/order/return.service';
import * as executionService from '../../src/modules/execution/execution.service';
import * as inventoryService from '../../src/modules/inventory/inventory.service';
import * as voucherService from '../../src/modules/order/voucher.service';

const makeToken = (payload) =>
  jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '1h' });

const makeSession = () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn(),
  withTransaction: jest.fn(async (fn) => fn()),
});

const makeChainQuery = (val) => {
  const q = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(val),
    then: (resolve, reject) => Promise.resolve(val).then(resolve, reject),
  };
  return q;
};

describe('Defect Log R1 & Test Execution Regression Suite', () => {
  const customerAId = new mongoose.Types.ObjectId();
  const customerBId = new mongoose.Types.ObjectId();
  const branch1Id = new mongoose.Types.ObjectId();
  const branch2Id = new mongoose.Types.ObjectId();
  const staff1Id = new mongoose.Types.ObjectId();
  const staffProfile1Id = new mongoose.Types.ObjectId();

  const customerAToken = makeToken({
    id: customerAId.toString(),
    systemRole: 'CUSTOMER',
    email: 'customera@test.com',
    name: 'Customer A',
  });
  const customerBToken = makeToken({
    id: customerBId.toString(),
    systemRole: 'CUSTOMER',
    email: 'customerb@test.com',
    name: 'Customer B',
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. AUTH & GUEST SECURITY (QA-R1-14, QA-R1-15, QA-R1-26, R08)
  // =========================================================================
  describe('1. Auth & Guest Security', () => {
    it('QA-R1-14: POST /api/v1/auth/register accepts OpenAPI payload without confirmPassword', async () => {
      jest.spyOn(User, 'findOne').mockReturnValue(makeChainQuery(null));
      jest.spyOn(User, 'create').mockImplementation(async (doc) => ({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
        status: 'ACTIVE',
      }));
      jest.spyOn(Customer, 'findOneAndUpdate').mockReturnValue(makeChainQuery({ _id: new mongoose.Types.ObjectId() }));
      jest.spyOn(OtpChallenge, 'findOne').mockReturnValue(makeChainQuery(null));
      jest.spyOn(OtpChallenge, 'deleteMany').mockResolvedValue({ deletedCount: 0 });
      jest.spyOn(OtpChallenge, 'create').mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Nguyen Van An',
          phone: '0901234567',
          email: 'nguyenvanan@test.com',
          password: 'Password@123',
          acceptTerms: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.message || res.body.user?.email || res.body.email).toBeTruthy();
    });

    it('QA-R1-15: POST /api/v1/auth/reset-password accepts { identifier, otp, newPassword } and invalidates OTP', async () => {
      const userDoc = {
        _id: new mongoose.Types.ObjectId(),
        email: 'reset@test.com',
        phone: '0909998888',
        passwordHash: 'old_hash',
        save: jest.fn().mockResolvedValue(true),
      };
      const challengeDoc = {
        _id: new mongoose.Types.ObjectId(),
        identifier: 'reset@test.com',
        purpose: 'FORGOT_PASSWORD',
        otpHash: hashOtp('123456'),
        attemptCount: 0,
        expiresAt: new Date(Date.now() + 60000),
        verifiedAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockReturnValue(makeChainQuery(userDoc));
      jest.spyOn(OtpChallenge, 'findOne').mockReturnValue(makeChainQuery(challengeDoc));
      jest.spyOn(OtpChallenge, 'deleteMany').mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(OtpChallenge, 'updateMany').mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(RefreshSession, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          identifier: 'reset@test.com',
          otp: '123456',
          newPassword: 'NewPassword@123',
        });

      expect(res.status).toBe(204);
      expect(userDoc.save).toHaveBeenCalled();
      expect(OtpChallenge.deleteMany).toHaveBeenCalled();
    });

    it('QA-R1-26: Guest transactions enforce verified channel and block unauthenticated / unauthorized order access', async () => {
      const noTokenRes = await request(app).get('/api/v1/guest/transactions');
      expect(noTokenRes.status).toBe(401);

      const unauthOrderRes = await request(app).get(`/api/v1/orders/${new mongoose.Types.ObjectId()}`);
      expect(unauthOrderRes.status).toBe(401);

      const aptFindSpy = jest.spyOn(Appointment, 'find').mockReturnValue(makeChainQuery([]));
      const orderFindSpy = jest.spyOn(Order, 'find').mockReturnValue(makeChainQuery([]));
      jest.spyOn(GuestContact, 'findOne').mockReturnValue(makeChainQuery(null));

      await guestService.getGuestTransactions({
        guestContactId: new mongoose.Types.ObjectId().toString(),
        phone: '0911222333',
        email: 'unverified@test.com',
        phoneVerified: true,
        emailVerified: false,
      });

      const orderFilter = orderFindSpy.mock.calls[0][0];
      const filterStr = JSON.stringify(orderFilter);
      expect(filterStr).toContain('0911222333');
      expect(filterStr).not.toContain('unverified@test.com');
      expect(aptFindSpy).toHaveBeenCalled();
    });

    it('R08 / FT-M02-05: completeActivation does not link contactSnapshot.email when emailVerifiedAt is null (while phone is verified)', async () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      const guestDoc = {
        _id: new mongoose.Types.ObjectId(),
        email: 'guest@test.com',
        phone: '0900111222',
        activationToken: 'valid-invite-token',
        activationExpiresAt: new Date(Date.now() + 60000),
        emailVerifiedAt: null,
        phoneVerifiedAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(GuestContact, 'findOne').mockResolvedValue(guestDoc);
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      const orderFindSpy = jest.spyOn(Order, 'find').mockReturnValue(makeChainQuery([]));
      const aptFindSpy = jest.spyOn(Appointment, 'find').mockReturnValue(makeChainQuery([]));
      jest.spyOn(User.prototype, 'save').mockResolvedValue(true);
      jest.spyOn(Customer.prototype, 'save').mockResolvedValue(true);
      const orderUpdateSpy = jest.spyOn(Order, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
      const aptUpdateSpy = jest.spyOn(Appointment, 'updateMany').mockResolvedValue({ modifiedCount: 0 });

      await guestService.completeActivation({
        token: 'valid-invite-token',
        password: 'Password@123',
        acceptTerms: true,
        fullName: 'Guest Activated',
      });

      expect(JSON.stringify(orderFindSpy.mock.calls[0][0])).not.toContain('contactSnapshot.email');
      expect(JSON.stringify(aptFindSpy.mock.calls[0][0])).toContain('contactSnapshot.phone');
      expect(JSON.stringify(orderUpdateSpy.mock.calls[0][0])).not.toContain('contactSnapshot.email');
      expect(JSON.stringify(aptUpdateSpy.mock.calls[0][0])).not.toContain('contactSnapshot.email');
    });

    it('QA-R1-30 / FT-M02-04: Rejects activation (401) and creates no User/Customer or order links when guest contact is not OTP-verified', async () => {
      const guestDoc = {
        _id: new mongoose.Types.ObjectId(),
        email: 'unverified-guest@test.com',
        phone: '0909998887',
        activationStatus: 'PENDING_ACTIVATION',
        activationToken: 'unverified-valid-invite-token',
        activationExpiresAt: new Date(Date.now() + 60000),
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(GuestContact, 'findOne').mockResolvedValue(guestDoc);
      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(OtpChallenge, 'findOne').mockReturnValue(makeChainQuery(null));
      const userSaveSpy = jest.spyOn(User.prototype, 'save').mockResolvedValue(true);
      const customerSaveSpy = jest.spyOn(Customer.prototype, 'save').mockResolvedValue(true);
      const orderUpdateSpy = jest.spyOn(Order, 'updateMany').mockResolvedValue({ modifiedCount: 0 });
      const aptUpdateSpy = jest.spyOn(Appointment, 'updateMany').mockResolvedValue({ modifiedCount: 0 });

      // 1. Missing OTP on unverified guest contact via HTTP /api/v1/activation/complete -> 401
      const resNoOtp = await request(app)
        .post('/api/v1/activation/complete')
        .send({
          token: 'unverified-valid-invite-token',
          password: 'Password@123',
          acceptTerms: true,
          fullName: 'Unverified Guest',
        });
      expect(resNoOtp.status).toBe(401);

      // 2. Legacy alias /api/v1/auth/activate-guest without OTP -> 401
      const resAliasNoOtp = await request(app)
        .post('/api/v1/auth/activate-guest')
        .send({
          token: 'unverified-valid-invite-token',
          password: 'Password@123',
          acceptTerms: true,
        });
      expect(resAliasNoOtp.status).toBe(401);

      // 3. Invalid inline OTP against active OtpChallenge -> 401
      jest.spyOn(OtpChallenge, 'findOne').mockReturnValue(
        makeChainQuery({
          _id: new mongoose.Types.ObjectId(),
          identifier: '0909998887',
          purpose: 'GUEST_LOOKUP',
          otpHash: hashOtp('654321'),
          expiresAt: new Date(Date.now() + 60000),
          attemptCount: 0,
          save: jest.fn().mockResolvedValue(true),
        })
      );
      const resBadOtp = await request(app)
        .post('/api/v1/activation/complete')
        .send({
          token: 'unverified-valid-invite-token',
          otp: '000000',
          password: 'Password@123',
          acceptTerms: true,
        });
      expect(resBadOtp.status).toBe(401);

      expect(userSaveSpy).not.toHaveBeenCalled();
      expect(customerSaveSpy).not.toHaveBeenCalled();
      expect(orderUpdateSpy).not.toHaveBeenCalled();
      expect(aptUpdateSpy).not.toHaveBeenCalled();

      // 4. Valid inline OTP on unverified phone -> verifies phone ONLY, creates account, excludes unverified email
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      jest.spyOn(OtpChallenge, 'findOne').mockReturnValue(
        makeChainQuery({
          _id: new mongoose.Types.ObjectId(),
          identifier: '0909998887',
          purpose: 'GUEST_LOOKUP',
          otpHash: hashOtp('654321'),
          expiresAt: new Date(Date.now() + 60000),
          attemptCount: 0,
          save: jest.fn().mockResolvedValue(true),
        })
      );
      jest.spyOn(OtpChallenge, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      const orderFindSpy = jest.spyOn(Order, 'find').mockReturnValue(makeChainQuery([]));
      jest.spyOn(Appointment, 'find').mockReturnValue(makeChainQuery([]));

      const resValidOtp = await request(app)
        .post('/api/v1/activation/complete')
        .send({
          token: 'unverified-valid-invite-token',
          otp: '654321',
          password: 'Password@123',
          acceptTerms: true,
          fullName: 'Verified Inline Guest',
        });

      expect(resValidOtp.status).toBe(200);
      expect(resValidOtp.body.user?.activationStatus).toBe('ACTIVATED');
      expect(guestDoc.phoneVerifiedAt).toBeTruthy();
      expect(guestDoc.emailVerifiedAt).toBeNull();
      expect(JSON.stringify(orderFindSpy.mock.calls[0][0])).toContain('0909998887');
      expect(JSON.stringify(orderFindSpy.mock.calls[0][0])).not.toContain('unverified-guest@test.com');
    });
  });

  // =========================================================================
  // 2. PET & CUSTOMER VALIDATION & RBAC (QA-R1-06, R07)
  // =========================================================================
  describe('2. Pet Validation & Ownership RBAC', () => {
    it('QA-R1-06: Rejects invalid pet fields (weightKg <= 0, missing/invalid species, empty name)', async () => {
      const schemaBadPet = new Pet({ customerId: customerAId, name: 'Zero', species: 'INVALID', weightKg: 0 });
      const err = schemaBadPet.validateSync();
      expect(err).toBeTruthy();
      expect(err.errors.species).toBeTruthy();
      expect(err.errors.weightKg).toBeTruthy();

      const resMissingSpecies = await request(app)
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ name: 'Milo', weightKg: 2 });
      expect(resMissingSpecies.status).toBe(400);

      const res = await request(app)
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ name: '   ', species: 'DOG', weightKg: 2 });
      expect(res.status).toBe(400);

      const resNegWeight = await request(app)
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ name: 'Milo', species: 'DOG', weightKg: 0 });
      expect(resNegWeight.status).toBe(400);
    });

    it('R07: Enforces strict 401/403 ownership on Pet & Customer Address routes', async () => {
      const petId = new mongoose.Types.ObjectId();
      const petOfA = { _id: petId, customerId: customerAId, name: 'Milo', species: 'DOG', status: 'ACTIVE' };
      jest.spyOn(Pet, 'findById').mockResolvedValue(petOfA);

      const noAuth = await request(app).get(`/api/v1/pets/${petId}`);
      expect(noAuth.status).toBe(401);

      const otherCustomer = await request(app)
        .get(`/api/v1/pets/${petId}`)
        .set('Authorization', `Bearer ${customerBToken}`);
      expect(otherCustomer.status).toBe(403);

      const otherCustomerAddr = await request(app)
        .get(`/api/v1/customers/${customerAId}/addresses`)
        .set('Authorization', `Bearer ${customerBToken}`);
      expect(otherCustomerAddr.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. CHECKOUT QUOTE & ONLINE_MOCK BOOKING PAYMENT (QA-R1-11, QA-R1-08, QA-R1-04)
  // =========================================================================
  describe('3. Checkout Quote & Payment Mock Lifecycle', () => {
    it('QA-R1-11: POST /api/v1/checkout/quote computes pricing with zero Order/Stock side effects', async () => {
      const prodId = new mongoose.Types.ObjectId();
      const varId = new mongoose.Types.ObjectId();
      jest.spyOn(Product, 'findById').mockResolvedValue({
        _id: prodId,
        name: 'Pate Meo',
        status: 'ACTIVE',
        variants: [{ _id: varId, label: '80g', price: 30000, finalPrice: 30000, status: 'ACTIVE' }],
      });
      const saveSpy = jest.spyOn(Order.prototype, 'save');

      const res = await request(app)
        .post('/api/v1/checkout/quote')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          items: [{ productId: prodId.toString(), variantId: varId.toString(), quantity: 2 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.pricing.merchandiseSubtotal).toBe(60000);
      expect(res.body.pricing.totalAmount).toBe(90000); // 60000 + 30000 default flat shipping
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('QA-R1-08: ONLINE_MOCK appointment payment mock/complete confirms or rejects expired hold with 409', async () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      const aptId = new mongoose.Types.ObjectId();
      const payId = new mongoose.Types.ObjectId();

      const aptDoc = {
        _id: aptId,
        code: 'APT-MOCK-01',
        customerId: customerAId,
        branchId: branch1Id,
        status: 'PENDING_PAYMENT',
        paymentMethod: 'ONLINE_MOCK',
        holdExpiresAt: new Date(Date.now() + 10 * 60000),
        pricing: { finalAmount: 200000, paidAmount: 0 },
        deposit: { status: 'NOT_REQUIRED' },
        services: [],
        save: jest.fn().mockResolvedValue(true),
      };
      const payDoc = {
        _id: payId,
        code: 'PAY-MOCK-01',
        target: { type: 'APPOINTMENT', id: aptId },
        targetType: 'APPOINTMENT',
        targetId: aptId,
        method: 'ONLINE_MOCK',
        kind: 'FULL',
        status: 'PENDING',
        amount: 200000,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Payment, 'findById').mockReturnValue(makeChainQuery(payDoc));
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeChainQuery(aptDoc));
      jest.spyOn(SlotReservation, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      const paidRes = await request(app)
        .post(`/api/v1/payments/${payId}/mock/complete`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `idemp-pay-ok-${Date.now()}`)
        .send({ outcome: 'PAID' });

      expect(paidRes.status).toBe(200);
      expect(paidRes.body.status).toBe('PAID');
      expect(aptDoc.status).toBe('CONFIRMED');
      expect(aptDoc.pricing.paidAmount).toBe(200000);
      expect(aptDoc.holdExpiresAt).toBeNull();

      payDoc.status = 'PENDING';
      aptDoc.status = 'PENDING_PAYMENT';
      aptDoc.holdExpiresAt = new Date(Date.now() - 5000);
      aptDoc.pricing.paidAmount = 0;
      jest.spyOn(SlotReservation, 'deleteMany').mockResolvedValue({ deletedCount: 1 });

      const expiredRes = await request(app)
        .post(`/api/v1/payments/${payId}/mock/complete`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `idemp-pay-exp-${Date.now()}`)
        .send({ outcome: 'PAID' });

      expect(expiredRes.status).toBe(409);
      expect(payDoc.status).toBe('EXPIRED');
    });

    it('QA-R1-04: Slot duplicate key E11000 / WriteConflict 112 maps cleanly to 409 SLOT_UNAVAILABLE', async () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      jest.spyOn(Appointment, 'findById').mockReturnValue(
        makeChainQuery({
          _id: new mongoose.Types.ObjectId(),
          customerId: customerAId,
          branchId: branch1Id,
          status: 'CONFIRMED',
          rescheduleCount: 0,
          scheduledStart: new Date(Date.now() + 48 * 3600000),
          services: [{ serviceId: new mongoose.Types.ObjectId(), durationMinutes: 30, assignedStaffId: staffProfile1Id }],
          save: jest.fn().mockResolvedValue(true),
        })
      );
      jest.spyOn(SlotReservation, 'deleteMany').mockResolvedValue({ deletedCount: 0 });
      const err11000 = new Error('E11000 duplicate key error collection: test.slotreservations dup key: { capacitySlot: 0 }');
      err11000.code = 11000;
      err11000.keyPattern = { branchId: 1, serviceId: 1, slotStartUnit: 1, capacitySlot: 1 };
      jest.spyOn(SlotReservation.prototype, 'save').mockRejectedValue(err11000);

      await expect(
        bookingService.rescheduleAppointment(
          new mongoose.Types.ObjectId(),
          { newSlotStart: new Date(Date.now() + 72 * 3600000).toISOString() },
          { id: customerAId.toString(), systemRole: 'CUSTOMER' }
        )
      ).rejects.toMatchObject({ status: 409, code: 'SLOT_UNAVAILABLE' });
    });
  });

  // =========================================================================
  // 4. BOOKING SCHEDULE, CAPACITY VS STAFF, REFUND, NO-SHOW, OVERRIDE
  // =========================================================================
  describe('4. Booking Rules, Refunds, State Machine & Audit', () => {
    it('QA-R1-07: Rejects schedule outside branch openingHours or on holidays', () => {
      const monday = new Date('2026-11-23T08:00:00.000Z');
      const branch = {
        openingHours: [{ dayOfWeek: 1, open: '09:00', close: '18:00' }],
        holidays: [{ date: '2026-12-25', reason: 'Christmas' }],
      };

      expect(() =>
        availabilityService.validateScheduleAgainstBranchRules({
          branch,
          orderedServices: [],
          startDate: monday,
          endDate: new Date('2026-11-23T08:30:00.000Z'),
        })
      ).toThrow(/operating hours/i);

      expect(() =>
        availabilityService.validateScheduleAgainstBranchRules({
          branch,
          orderedServices: [],
          startDate: new Date('2026-12-25T10:00:00.000Z'),
          endDate: new Date('2026-12-25T10:30:00.000Z'),
        })
      ).toThrow(/holiday/i);
    });

    it('QA-R1-16: Zero active shifts on branch returns 0 available slots (no cross-branch fallback)', async () => {
      const svcId = new mongoose.Types.ObjectId();
      jest.spyOn(Branch, 'findById').mockReturnValue(
        makeChainQuery({ _id: branch1Id, status: 'ACTIVE', openingHours: [{ dayOfWeek: 3, open: '09:00', close: '12:00' }] })
      );
      jest.spyOn(Service, 'find').mockReturnValue(
        makeChainQuery([{ _id: svcId, name: 'Grooming', status: 'ACTIVE', durationMinutes: 60, requiredStaffRole: 'CARE_STAFF_GROOMER' }])
      );
      jest.spyOn(BranchServiceConfig, 'find').mockReturnValue(
        makeChainQuery([{ branchId: branch1Id, serviceId: svcId, enabled: true, capacity: 2 }])
      );
      jest.spyOn(Shift, 'find').mockReturnValue(makeChainQuery([]));
      jest.spyOn(Appointment, 'find').mockReturnValue(makeChainQuery([]));
      jest.spyOn(SlotReservation, 'find').mockResolvedValue([]);

      const avail = await availabilityService.getAvailability({
        branchId: branch1Id.toString(),
        serviceIds: [svcId.toString()],
        date: '2026-11-25',
        includeFull: true,
      });

      expect(avail.slots.every((s) => s.remaining === 0 && !s.available)).toBe(true);
    });

    it('QA-R1-09: Availability separates per-service capacity from branch staff supply', async () => {
      const svcA = new mongoose.Types.ObjectId();
      const svcB = new mongoose.Types.ObjectId();
      const staffOne = new mongoose.Types.ObjectId();
      const staffTwo = new mongoose.Types.ObjectId();

      jest.spyOn(Branch, 'findById').mockReturnValue(
        makeChainQuery({ _id: branch1Id, status: 'ACTIVE', openingHours: [{ dayOfWeek: 3, open: '09:00', close: '11:00' }] })
      );
      jest.spyOn(Service, 'find').mockReturnValue(
        makeChainQuery([{ _id: svcB, name: 'Bath B', status: 'ACTIVE', bookingMode: 'BOOKABLE', durationMinutes: 60, requiredStaffRole: 'CARE_STAFF_GROOMER' }])
      );
      jest.spyOn(BranchServiceConfig, 'find').mockReturnValue(
        makeChainQuery([{ branchId: branch1Id, serviceId: svcB, enabled: true, capacity: 2 }])
      );
      jest.spyOn(Shift, 'find').mockReturnValue(
        makeChainQuery([
          {
            branchId: branch1Id,
            staffId: { _id: staffOne, staffSubRole: 'CARE_STAFF_GROOMER', status: 'ACTIVE' },
            startAt: new Date('2026-11-25T08:00:00.000Z'),
            endAt: new Date('2026-11-25T18:00:00.000Z'),
          },
          {
            branchId: branch1Id,
            staffId: { _id: staffTwo, staffSubRole: 'CARE_STAFF_GROOMER', status: 'ACTIVE' },
            startAt: new Date('2026-11-25T08:00:00.000Z'),
            endAt: new Date('2026-11-25T18:00:00.000Z'),
          },
        ])
      );
      jest.spyOn(SlotReservation, 'find').mockResolvedValue([]);
      jest.spyOn(Appointment, 'find').mockReturnValue(
        makeChainQuery([
          {
            status: 'CONFIRMED',
            services: [
              {
                serviceId: svcA,
                assignedStaffId: staffOne,
                scheduledStart: new Date('2026-11-25T09:00:00.000Z'),
                scheduledEnd: new Date('2026-11-25T10:00:00.000Z'),
              },
            ],
          },
        ])
      );

      const avail = await availabilityService.getAvailability({
        branchId: branch1Id.toString(),
        serviceIds: [svcB.toString()],
        date: '2026-11-25',
      });
      const nineAm = avail.slots.find((s) => s.start === '2026-11-25T09:00:00.000Z');
      expect(nineAm).toBeTruthy();
      expect(nineAm.remaining).toBe(1);
    });

    it('QA-R1-10 / R01: markNoShow enforces CONFIRMED + not ARRIVED + 30m grace + branch scope', async () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      jest.spyOn(Appointment, 'findById').mockReturnValue(
        makeChainQuery({
          _id: new mongoose.Types.ObjectId(),
          branchId: branch1Id,
          status: 'CONFIRMED',
          checkInStatus: 'ARRIVED',
          scheduledStart: new Date(Date.now() - 45 * 60000),
          pricing: { finalAmount: 100000, paidAmount: 30000 },
        })
      );

      await expect(
        bookingService.markNoShow(new mongoose.Types.ObjectId(), {
          id: new mongoose.Types.ObjectId().toString(),
          systemRole: 'RECEPTIONIST',
          authorizedBranchIds: [branch1Id.toString()],
        })
      ).rejects.toMatchObject({ status: 422, code: 'INVALID_STATE' });
    });

    it('R02 / R06 / QA-R1-12 / QA-R1-13: Booking refund calculates from cancel.at and accepts REFUND_PENDING target.id payments', async () => {
      const aptId = new mongoose.Types.ObjectId();
      const cancelAt = new Date(Date.now() - 2 * 3600000);
      const scheduledStart = new Date(cancelAt.getTime() + 30 * 3600000);

      jest.spyOn(Appointment, 'findById').mockResolvedValue({
        _id: aptId,
        code: 'APT-REF-01',
        customerId: customerAId,
        branchId: branch1Id,
        status: 'CANCELLED',
        scheduledStart,
        pricing: { finalAmount: 500000, paidAmount: 500000 },
        cancel: { by: 'CUSTOMER', at: cancelAt, reason: 'Plans changed' },
      });
      jest.spyOn(BookingRefund, 'findOne').mockResolvedValue(null);
      jest.spyOn(Payment, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        target: { type: 'APPOINTMENT', id: aptId },
        status: 'REFUND_PENDING',
        amount: 500000,
      });
      jest.spyOn(BookingRefund.prototype, 'save').mockResolvedValue(true);

      const refund = await bookingRefundService.requestRefund(
        { appointmentId: aptId.toString(), reason: 'Huy som >= 24h' },
        { id: customerAId.toString(), systemRole: 'CUSTOMER' }
      );
      expect(refund.amount).toBe(500000);
      expect(refund.rule).toBe('CUSTOMER_EARLY_FULL');
    });

    it('QA-R1-24: rescheduleOverride requires reason & CONFIRMED status and updates rescheduleHistory', async () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      await expect(
        bookingService.rescheduleOverride(
          new mongoose.Types.ObjectId(),
          { newSlotStart: new Date(Date.now() + 86400000).toISOString(), reason: '  ' },
          { id: new mongoose.Types.ObjectId().toString(), systemRole: 'MANAGER', assignedBranchIds: [branch1Id.toString()] }
        )
      ).rejects.toMatchObject({ status: 400 });

      jest.spyOn(AuditLog, 'create').mockResolvedValue({});
      const aptDoc = {
        _id: new mongoose.Types.ObjectId(),
        code: 'APT-OVR-01',
        branchId: branch1Id,
        status: 'CONFIRMED',
        scheduledStart: new Date(Date.now() + 3600000),
        scheduledEnd: new Date(Date.now() + 7200000),
        services: [{ serviceId: new mongoose.Types.ObjectId(), durationMinutes: 60, assignedStaffId: staffProfile1Id }],
        rescheduleHistory: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeChainQuery(aptDoc));
      jest.spyOn(SlotReservation, 'deleteMany').mockResolvedValue({ deletedCount: 1 });

      await bookingService.rescheduleOverride(
        aptDoc._id,
        { newSlotStart: new Date(Date.now() + 48 * 3600000).toISOString(), reason: 'Bac si kham ban dot xuat' },
        { id: new mongoose.Types.ObjectId().toString(), systemRole: 'MANAGER', assignedBranchIds: [branch1Id.toString()] }
      );

      expect(aptDoc.rescheduleHistory).toHaveLength(1);
      expect(aptDoc.rescheduleHistory[0].reason).toBe('Bac si kham ban dot xuat');
    });
  });

  // =========================================================================
  // 5. RETURNS & MEDICAL RECORD INVENTORY / AUDIT (QA-R1-19,20,22,23)
  // =========================================================================
  describe('5. Order Returns & Medical Record Inventory Audit', () => {
    it('QA-R1-19 / QA-R1-22: Zero receivedQty rejects 422 ZERO_RECEIVED_QUANTITY; DISCARDED has restockedQty 0', async () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      const retId = new mongoose.Types.ObjectId();
      const orderId = new mongoose.Types.ObjectId();
      jest.spyOn(OrderReturn, 'findById').mockReturnValue(
        makeChainQuery({
          _id: retId,
          code: 'RET-01',
          orderId,
          status: 'RECEIVED',
          items: [{ orderItemId: new mongoose.Types.ObjectId(), requestedQty: 1, receivedQty: 0, quality: 'DISCARDED' }],
          refundBreakdown: { total: 100000 },
        })
      );
      jest.spyOn(Order, 'findById').mockReturnValue(
        makeChainQuery({
          _id: orderId,
          fulfillmentBranchId: branch1Id,
          items: [],
        })
      );

      await expect(
        returnService.approveReturn(
          retId.toString(),
          {},
          { id: new mongoose.Types.ObjectId().toString(), systemRole: 'MANAGER', assignedBranchIds: [branch1Id.toString()] }
        )
      ).rejects.toMatchObject({ status: 422, code: 'ZERO_RECEIVED_QUANTITY' });

      const formatted = returnService.formatOrderReturn({
        _id: retId,
        code: 'RET-02',
        orderId,
        status: 'RECEIVED',
        items: [
          { orderItemId: new mongoose.Types.ObjectId(), requestedQty: 2, receivedQty: 2, quality: 'DISCARDED' },
          { orderItemId: new mongoose.Types.ObjectId(), requestedQty: 1, receivedQty: 1, quality: 'RESELLABLE' },
        ],
      });
      expect(formatted.items[0].restockedQty).toBe(0);
      expect(formatted.items[1].restockedQty).toBe(1);
    });

    it('QA-R1-20 / QA-R1-23: applyServiceRecordDelta emits ISSUE on delta > 0 (initial & reopen) and ADJUSTMENT on delta < 0; updateMaterials tracks actor', async () => {
      const itemA = new mongoose.Types.ObjectId();
      const itemB = new mongoose.Types.ObjectId();
      const itemC = new mongoose.Types.ObjectId();
      jest.spyOn(InventoryTransaction, 'findOne').mockReturnValue(makeChainQuery(null));
      jest.spyOn(InventoryStock, 'findOne')
        .mockReturnValueOnce(makeChainQuery({ _id: new mongoose.Types.ObjectId(), quantity: 11, version: 1 }))
        .mockReturnValueOnce(makeChainQuery({ _id: new mongoose.Types.ObjectId(), quantity: 10, version: 1 }))
        .mockReturnValueOnce(makeChainQuery({ _id: new mongoose.Types.ObjectId(), quantity: 17, version: 1 }));
      jest.spyOn(InventoryStock, 'findOneAndUpdate')
        .mockResolvedValueOnce({ quantityOnHand: 9 })
        .mockResolvedValueOnce({ quantityOnHand: 11 })
        .mockResolvedValueOnce({ quantityOnHand: 15 });
      const txSpy = jest.spyOn(InventoryTransaction, 'create').mockImplementation(async (docs) => docs);

      await inventoryService.applyServiceRecordDelta({
        serviceRecordId: new mongoose.Types.ObjectId(),
        serviceRecordCode: 'SR-01',
        recordVersion: 1,
        branchId: branch1Id,
        deltas: [
          { inventoryItemId: itemA, delta: 2 },
        ],
      });

      await inventoryService.applyServiceRecordDelta({
        serviceRecordId: new mongoose.Types.ObjectId(),
        serviceRecordCode: 'SR-01',
        recordVersion: 2,
        branchId: branch1Id,
        deltas: [
          { inventoryItemId: itemB, delta: -1 },
        ],
      });

      await inventoryService.applyServiceRecordDelta({
        serviceRecordId: new mongoose.Types.ObjectId(),
        serviceRecordCode: 'SR-01',
        recordVersion: 2,
        branchId: branch1Id,
        deltas: [
          { inventoryItemId: itemC, delta: 2 },
        ],
      });

      const createdDocs = txSpy.mock.calls.flatMap((c) => (Array.isArray(c[0]) ? c[0] : [c[0]]));
      expect(createdDocs[0].transactionType).toBe('ISSUE');
      expect(createdDocs[0].changeQty).toBe(-2);
      expect(createdDocs[1].transactionType).toBe('ADJUSTMENT');
      expect(createdDocs[1].changeQty).toBe(1);
      expect(createdDocs[2].transactionType).toBe('ISSUE');
      expect(createdDocs[2].changeQty).toBe(-2);

      const recDoc = {
        _id: new mongoose.Types.ObjectId(),
        code: 'SR-AUD-1',
        appointmentId: new mongoose.Types.ObjectId(),
        branchId: branch1Id,
        status: 'IN_PROGRESS',
        version: 1,
        assignedStaffIds: [staff1Id],
        actualMaterials: [],
        materialAudit: [],
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(recDoc);
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeChainQuery({ _id: recDoc.appointmentId, services: [] }));

      const updated = await executionService.updateMaterials(
        recDoc._id.toString(),
        { materials: [{ inventoryItemId: itemA.toString(), quantity: 2 }] },
        { id: staff1Id.toString(), fullName: 'BS Hung', systemRole: 'STAFF', staffSubRole: 'VETERINARIAN' }
      );
      expect(updated.materialsUpdatedBy).toBe(staff1Id.toString());
      expect(updated.updatedBy.name).toBe('BS Hung');
      expect(recDoc.materialAudit).toHaveLength(1);
      expect(recDoc.materialAudit[0].actorId.toString()).toBe(staff1Id.toString());
      expect(updated.materialAudit[0].actorId).toBe(staff1Id.toString());
    });
  });

  // =========================================================================
  // 6. CATALOG, RECOMMENDATION, REVIEW, ADOPTION, COMMUNITY (QA-R1-17,25,21,18,03,FT-M21-03)
  // =========================================================================
  describe('6. Catalog, Recommendation, Review, Adoption & Community', () => {
    it('QA-R1-17: Catalog cursor pagination preserves PRICE_ASC without skipping tied prices', async () => {
      const id1 = new mongoose.Types.ObjectId('660000000000000000000001');
      const id2 = new mongoose.Types.ObjectId('660000000000000000000002');
      const id3 = new mongoose.Types.ObjectId('660000000000000000000003');
      const docs = [
        { _id: id1, name: 'A', status: 'ACTIVE', minPrice: 10000, variants: [{ _id: new mongoose.Types.ObjectId(), price: 10000, finalPrice: 10000, status: 'ACTIVE' }] },
        { _id: id2, name: 'B', status: 'ACTIVE', minPrice: 10000, variants: [{ _id: new mongoose.Types.ObjectId(), price: 10000, finalPrice: 10000, status: 'ACTIVE' }] },
        { _id: id3, name: 'C', status: 'ACTIVE', minPrice: 20000, variants: [{ _id: new mongoose.Types.ObjectId(), price: 20000, finalPrice: 20000, status: 'ACTIVE' }] },
      ];
      const findSpy = jest.spyOn(Product, 'find').mockReturnValue(makeChainQuery([docs[0], docs[1], docs[2]]));
      jest.spyOn(Product, 'countDocuments').mockResolvedValue(3);

      const page1 = await catalogService.listProducts({ sort: 'PRICE_ASC', limit: 2 });
      expect(page1.items.map((i) => i.id)).toEqual([id1.toString(), id2.toString()]);
      expect(page1.nextCursor).toBeTruthy();

      const decodedCursor = JSON.parse(Buffer.from(page1.nextCursor, 'base64').toString('utf8'));
      expect(decodedCursor).toMatchObject({ s: 'PRICE_ASC', k: 10000, id: id2.toString() });

      findSpy.mockReturnValue(makeChainQuery([docs[2]]));
      const page2 = await catalogService.listProducts({
        sort: 'PRICE_ASC',
        limit: 2,
        cursor: page1.nextCursor,
      });
      expect(page2.items.map((i) => i.id)).toEqual([id3.toString()]);
    });

    it('QA-R1-25: Recommendation filters by real InventoryStock when variants reference inventoryItemId', async () => {
      const inStockItem = new mongoose.Types.ObjectId();
      const outStockItem = new mongoose.Types.ObjectId();
      jest.spyOn(Product, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'In Stock Toy',
            status: 'ACTIVE',
            variants: [{ _id: new mongoose.Types.ObjectId(), label: 'S', price: 50000, finalPrice: 50000, status: 'ACTIVE', inventoryItemId: inStockItem }],
          },
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Zero Stock Toy',
            status: 'ACTIVE',
            variants: [{ _id: new mongoose.Types.ObjectId(), label: 'S', price: 50000, finalPrice: 50000, status: 'ACTIVE', inventoryItemId: outStockItem }],
          },
        ])
      );
      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([{ _id: inStockItem, totalQty: 5 }]);

      const recs = await recommendationService.getRecommendations({ type: 'PRODUCT', branchId: branch1Id.toString(), limit: 10 });
      expect(recs.recommendations.some((p) => p.item.name === 'Zero Stock Toy')).toBe(false);
      expect(recs.recommendations.some((p) => p.item.name === 'In Stock Toy')).toBe(true);
    });

    it('QA-R1-25 / FT-M24-01: Recommendation evaluates service suggestions and populated pet appointment/order history context', async () => {
      const petObjId = new mongoose.Types.ObjectId();
      const catObjId = new mongoose.Types.ObjectId();
      const svcGroomId = new mongoose.Types.ObjectId();
      const svcMedId = new mongoose.Types.ObjectId();
      const stockedInvId = new mongoose.Types.ObjectId();

      jest.spyOn(Pet, 'findById').mockReturnValue(
        makeChainQuery({
          _id: petObjId,
          customerId: customerAId,
          name: 'Milo',
          species: 'DOG',
          breed: 'Poodle',
          ageYears: 3,
          medicalNotes: 'da nhạy cảm',
        })
      );
      jest.spyOn(Appointment, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new mongoose.Types.ObjectId(),
            status: 'COMPLETED',
            services: [{ serviceId: { _id: svcGroomId, serviceType: 'GROOMING' } }],
          },
        ])
      );
      jest.spyOn(Order, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new mongoose.Types.ObjectId(),
            status: 'COMPLETED',
            items: [{ categoryId: catObjId }],
          },
        ])
      );
      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([{ _id: stockedInvId, totalQty: 4 }]);
      jest.spyOn(Product, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Sữa tắm skin cho chó Poodle',
            categoryId: { _id: catObjId, name: 'Chăm sóc da' },
            status: 'ACTIVE',
            variants: [{ _id: new mongoose.Types.ObjectId(), price: 120000, status: 'ACTIVE', inventoryItemId: stockedInvId }],
          },
        ])
      );
      jest.spyOn(Service, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: svcGroomId,
            code: 'GRM01',
            name: 'Tắm cắt tạo kiểu Poodle',
            serviceType: 'GROOMING',
            status: 'ACTIVE',
            basePrice: 250000,
          },
          {
            _id: svcMedId,
            code: 'MED01',
            name: 'Khám tổng quát',
            serviceType: 'MEDICAL',
            status: 'ACTIVE',
            basePrice: 150000,
          },
        ])
      );
      jest.spyOn(BranchServiceConfig, 'find').mockReturnValue(
        makeChainQuery([{ serviceId: svcGroomId }, { serviceId: svcMedId }])
      );

      const recs = await recommendationService.getRecommendations({
        petId: petObjId.toString(),
        type: 'ALL',
        branchId: branch1Id.toString(),
        limit: 10,
      });

      const groomingRec = recs.recommendations.find((r) => r.type === 'SERVICE' && r.item.code === 'GRM01');
      expect(groomingRec).toBeTruthy();
      expect(groomingRec.signals).toEqual(expect.arrayContaining(['PET_PROFILE_MATCH', 'BREED_GROOMING_FIT', 'SERVICE_LOYALTY']));

      const prodRec = recs.recommendations.find((r) => r.type === 'PRODUCT');
      expect(prodRec).toBeTruthy();
      expect(prodRec.signals).toEqual(expect.arrayContaining(['SPECIES_MATCH', 'CATEGORY_REPURCHASE']));
    });

    it('QA-R1-21: getReviewById handles public null actor without crashing and enforces Manager branch scope', async () => {
      const revId = new mongoose.Types.ObjectId();
      const orderId = new mongoose.Types.ObjectId();
      jest.spyOn(Review, 'findById').mockReturnValue(
        makeChainQuery({
          _id: revId,
          targetType: 'ORDER',
          targetId: orderId,
          customerId: customerAId,
          rating: 5,
          comment: 'Rat tot',
          status: 'PUBLISHED',
        })
      );
      jest.spyOn(Order, 'findById').mockReturnValue(
        makeChainQuery({ _id: orderId, fulfillmentBranchId: branch2Id })
      );

      const publicRes = await reviewService.getReviewById(revId.toString(), null);
      expect(publicRes.rating).toBe(5);

      await expect(
        reviewService.getReviewById(revId.toString(), {
          id: new mongoose.Types.ObjectId().toString(),
          systemRole: 'MANAGER',
          assignedBranchIds: [branch1Id.toString()],
        })
      ).rejects.toMatchObject({ status: 403 });
    });

    it('QA-R1-18: Duplicate active AdoptionRequest returns 409 DUPLICATE_ADOPTION_REQUEST', async () => {
      const rescuePetId = new mongoose.Types.ObjectId();
      jest.spyOn(RescuePet, 'findById').mockResolvedValue({
        _id: rescuePetId,
        petName: 'Lucky',
        branchId: branch1Id,
        adoptionStatus: 'AVAILABLE',
      });
      jest.spyOn(AdoptionRequest, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          _id: new mongoose.Types.ObjectId(),
          rescuePetId,
          status: 'PENDING',
        });

      const res = await request(app)
        .post('/api/v1/public/rescue/requests')
        .set('Idempotency-Key', `idemp-adopt-${Date.now()}`)
        .send({
          rescuePetId: rescuePetId.toString(),
          fullName: 'Minh',
          phone: '0901234567',
          email: 'minh@test.com',
          address: '123 Le Loi, Q1',
          housingType: 'APARTMENT',
          hasPetExperience: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_ADOPTION_REQUEST');
    });

    it('QA-R1-03 & FT-M21-03: Community post public replies/comments return valid JSON and author can edit own post', async () => {
      const postId = new mongoose.Types.ObjectId();
      const postDoc = {
        _id: postId,
        authorUserId: customerAId,
        authorId: customerAId,
        title: 'Old title',
        content: 'Old content',
        tags: [],
        images: [],
        likesCount: 0,
        commentsCount: 0,
        status: 'ACTIVE',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(CommunityPost, 'findById').mockResolvedValue(postDoc);
      jest.spyOn(CommunityComment, 'create').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        postId,
        authorName: 'Guest',
        content: 'Bai hay qua',
        createdAt: new Date(),
      });

      const invalidIdRes = await request(app).get('/api/v1/public/community/posts/not-an-id/comments');
      expect([200, 400]).toContain(invalidIdRes.status);
      if (invalidIdRes.status === 200) {
        expect(Array.isArray(invalidIdRes.body.comments || invalidIdRes.body.items || invalidIdRes.body.data)).toBe(true);
      }

      const editByOther = await request(app)
        .put(`/api/v1/community/posts/${postId}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ title: 'Hack' });
      expect(editByOther.status).toBe(403);

      const editByOwner = await request(app)
        .put(`/api/v1/community/posts/${postId}`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ title: 'Updated title', content: 'Updated content here' });
      expect(editByOwner.status).toBe(200);
      expect(postDoc.title).toBe('Updated title');
    });
  });

  // =========================================================================
  // 8. GROUP 1 COMPLETION TESTS (QA-R1-01, QA-R1-02, QA-R1-05)
  // =========================================================================
  describe('8. Execution Check-In Guard, Rescue Branch Scope & Guest Canonical Checkout', () => {
    it('QA-R1-01: Blocks creating ServiceRecord (409) when appointment checkInStatus !== ARRIVED and allows when ARRIVED', async () => {
      const apptId = new mongoose.Types.ObjectId();
      const unarrivedAppt = {
        _id: apptId,
        code: 'APT-R1-01',
        branchId: branch1Id,
        serviceType: 'GROOMING',
        status: 'CONFIRMED',
        checkInStatus: 'PENDING',
        services: [{ serviceId: new mongoose.Types.ObjectId(), assignedStaffId: staffProfile1Id }],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValue(unarrivedAppt);
      jest.spyOn(StaffProfile, 'findOne').mockReturnValue(makeChainQuery({ _id: staffProfile1Id, userId: staff1Id }));
      const createSpy = jest.spyOn(ServiceRecord.prototype, 'save');

      await expect(
        executionService.createRecord(
          { appointmentId: apptId.toString(), actualMaterials: [] },
          { id: staff1Id.toString(), systemRole: 'STAFF', staffSubRole: 'CARE_STAFF_GROOMER', assignedBranchIds: [branch1Id.toString()] }
        )
      ).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE_TRANSITION' });

      expect(unarrivedAppt.status).toBe('CONFIRMED');
      expect(createSpy).not.toHaveBeenCalled();

      // Now mark ARRIVED -> succeeds
      unarrivedAppt.checkInStatus = 'ARRIVED';
      jest.spyOn(ServiceRecord, 'findOne').mockResolvedValue(null);
      jest.spyOn(ServiceRecord.prototype, 'save').mockImplementation(function () {
        this._id = new mongoose.Types.ObjectId();
        return Promise.resolve(this);
      });
      jest.spyOn(Customer, 'findById').mockReturnValue(makeChainQuery(null));
      jest.spyOn(Pet, 'findById').mockReturnValue(makeChainQuery(null));
      jest.spyOn(Branch, 'findById').mockReturnValue(makeChainQuery({ _id: branch1Id, name: 'Q1' }));
      jest.spyOn(StaffProfile, 'find').mockReturnValue(makeChainQuery([{ _id: staffProfile1Id, fullName: 'Groomer A' }]));
      jest.spyOn(Service, 'find').mockReturnValue(makeChainQuery([]));

      const created = await executionService.createRecord(
        { appointmentId: apptId.toString(), actualMaterials: [] },
        { id: staff1Id.toString(), systemRole: 'STAFF', staffSubRole: 'CARE_STAFF_GROOMER', assignedBranchIds: [branch1Id.toString()] }
      );
      expect(created).toBeDefined();
    });

    it('QA-R1-02: Manager creating RescuePet requires assigned branchId (400 if missing, 403 if outside scope, 201 if valid)', async () => {
      const managerToken = makeToken({
        id: new mongoose.Types.ObjectId().toString(),
        systemRole: 'MANAGER',
        assignedBranchIds: [branch1Id.toString()],
        authorizedBranchIds: [branch1Id.toString()],
      });

      const createSpy = jest.spyOn(RescuePet, 'create').mockImplementation(async (doc) => ({
        _id: new mongoose.Types.ObjectId(),
        ...doc,
        toObject() { return this; },
      }));
      jest.spyOn(RescuePet, 'countDocuments').mockResolvedValue(0);

      // Missing branchId -> 400
      const missingRes = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          petName: 'Mun',
          species: 'CAT',
          healthStatus: 'Khỏe mạnh',
          rescueStory: 'Được cứu hộ tại công viên',
          images: ['https://cdn.petclinic.vn/rescue/mun.jpg'],
        });
      expect(missingRes.status).toBe(400);
      expect(createSpy).not.toHaveBeenCalled();

      // Unassigned branch2Id -> 403
      const forbiddenRes = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          petName: 'Mun',
          species: 'CAT',
          branchId: branch2Id.toString(),
          healthStatus: 'Khỏe mạnh',
          rescueStory: 'Được cứu hộ tại công viên',
          images: ['https://cdn.petclinic.vn/rescue/mun.jpg'],
        });
      expect(forbiddenRes.status).toBe(403);
      expect(createSpy).not.toHaveBeenCalled();

      // Assigned branch1Id -> 201
      jest.spyOn(Branch, 'findById').mockResolvedValue({ _id: branch1Id, name: 'Chi nhánh Q1' });
      const okRes = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          petName: 'Mun',
          species: 'CAT',
          branchId: branch1Id.toString(),
          healthStatus: 'Khỏe mạnh',
          rescueStory: 'Được cứu hộ tại công viên',
          images: ['https://cdn.petclinic.vn/rescue/mun.jpg'],
        });
      expect(okRes.status).toBe(201);
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('QA-R1-05: Guest checkout via canonical POST /api/v1/checkout succeeds (201) with X-Guest-Cart-Token and creates NO User', async () => {
      const cartId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const variantId = new mongoose.Types.ObjectId();
      const invItemId = new mongoose.Types.ObjectId();
      const guestContactDocId = new mongoose.Types.ObjectId();

      const guestCart = {
        _id: cartId,
        tokenHash: 'guest-cart-token-r1-05',
        items: [{ productId, variantId, quantity: 1 }],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Cart, 'findOne').mockReturnValue(makeChainQuery(guestCart));
      jest.spyOn(Cart, 'findById').mockReturnValue(makeChainQuery(guestCart));
      jest.spyOn(Product, 'findById').mockResolvedValue({
        _id: productId,
        name: 'Hạt Cho Chó',
        status: 'ACTIVE',
        variants: [{ _id: variantId, label: '1kg', sku: 'DOG-1KG', price: 150000, status: 'ACTIVE', inventoryItemId: invItemId }],
      });
      jest.spyOn(SystemSetting, 'findOne').mockReturnValue(
        makeChainQuery({ key: 'commerce', value: { fulfillmentBranchPriority: [branch1Id], freeShippingThreshold: 500000 } })
      );
      jest.spyOn(Branch, 'findOne').mockReturnValue(makeChainQuery({ _id: branch1Id, status: 'ACTIVE', name: 'Q1', code: 'Q1' }));
      jest.spyOn(Branch, 'findById').mockReturnValue(makeChainQuery({ _id: branch1Id, name: 'Q1', code: 'Q1' }));
      jest.spyOn(InventoryStock, 'find').mockReturnValue(makeChainQuery([{ branchId: branch1Id, inventoryItemId: invItemId, quantity: 10, version: 1 }]));
      jest.spyOn(InventoryStock, 'findOne').mockReturnValue(makeChainQuery({ _id: new mongoose.Types.ObjectId(), branchId: branch1Id, inventoryItemId: invItemId, quantity: 10, version: 1 }));
      jest.spyOn(InventoryStock, 'findOneAndUpdate').mockResolvedValue({ branchId: branch1Id, inventoryItemId: invItemId, quantity: 9, version: 2 });
      jest.spyOn(InventoryTransaction, 'findOne').mockReturnValue(makeChainQuery(null));
      jest.spyOn(InventoryTransaction, 'create').mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]);
      jest.spyOn(GuestContact, 'findOne').mockReturnValue(makeChainQuery(null));
      jest.spyOn(GuestContact.prototype, 'save').mockImplementation(function () {
        this._id = guestContactDocId;
        return Promise.resolve(this);
      });
      jest.spyOn(Order, 'findOne').mockReturnValue(makeChainQuery(null));
      jest.spyOn(Order.prototype, 'save').mockImplementation(function () {
        return Promise.resolve(this);
      });
      jest.spyOn(Payment.prototype, 'save').mockImplementation(function () {
        this._id = new mongoose.Types.ObjectId();
        return Promise.resolve(this);
      });
      const userCreateSpy = jest.spyOn(User, 'create');

      const res = await request(app)
        .post('/api/v1/checkout')
        .set('X-Guest-Cart-Token', 'guest-cart-token-r1-05')
        .set('Idempotency-Key', `idemp-guest-checkout-${Date.now()}`)
        .send({
          cartId: cartId.toString(),
          shippingAddress: {
            recipientName: 'Khách Vãng Lai',
            phone: '0912345678',
            line1: '123 Lê Lợi',
            city: 'Hồ Chí Minh',
          },
          contact: {
            name: 'Khách Vãng Lai',
            phone: '0912345678',
            email: 'guest.r105@test.com',
          },
          paymentMethod: 'COD',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('status', 'PENDING');
      expect(userCreateSpy).not.toHaveBeenCalled();
    });
  });

  describe('9. Payment Sync/Hold Expiry Guard & Guest Appointment Detail (QA-R1-27, QA-R1-29)', () => {
    it('QA-R1-27: mockCompletePayment resolves target link, syncs Appointment/SlotReservation before expiry, and blocks PAID after expiry or CANCELLED', async () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      const aptId = new mongoose.Types.ObjectId();
      const payId = new mongoose.Types.ObjectId();

      // Case 1: Legacy flat targetType/targetId link before expiry -> PAID + Appointment CONFIRMED + paidAmount synced + SlotReservation CONFIRMED
      const aptDoc = {
        _id: aptId,
        code: 'APT-R127-01',
        customerId: customerAId,
        branchId: branch1Id,
        status: 'PENDING_PAYMENT',
        paymentMethod: 'PAY_AT_STORE',
        holdExpiresAt: new Date(Date.now() + 10 * 60000),
        pricing: { finalAmount: 300000, depositAmount: 90000, paidAmount: 0 },
        deposit: { status: 'PENDING', paymentId: payId },
        prepaymentId: payId,
        services: [],
        save: jest.fn().mockResolvedValue(true),
      };
      const payDoc = {
        _id: payId,
        code: 'PAY-R127-01',
        targetType: 'APPOINTMENT',
        targetId: aptId,
        method: 'PAY_AT_STORE',
        kind: 'DEPOSIT',
        status: 'PENDING',
        amount: 90000,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Payment, 'findById').mockReturnValue(makeChainQuery(payDoc));
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeChainQuery(aptDoc));
      const slotConfirmSpy = jest.spyOn(SlotReservation, 'updateMany').mockResolvedValue({ modifiedCount: 2 });

      const cbRes = await request(app)
        .post(`/api/v1/payments/${payId}/callback`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ outcome: 'PAID' });

      expect(cbRes.status).toBe(200);
      expect(cbRes.body.status).toBe('PAID');
      expect(payDoc.status).toBe('PAID');
      expect(payDoc.target).toEqual({ type: 'APPOINTMENT', id: aptId });
      expect(aptDoc.status).toBe('CONFIRMED');
      expect(aptDoc.pricing.paidAmount).toBe(90000);
      expect(aptDoc.deposit.status).toBe('HELD');
      expect(aptDoc.holdExpiresAt).toBeNull();
      expect(slotConfirmSpy).toHaveBeenCalledWith(
        { appointmentId: aptId },
        { $set: { status: 'CONFIRMED', holdExpiresAt: null } },
        expect.anything()
      );

      // Case 2: Already CANCELLED appointment -> rejects 409 and never marks Payment as PAID
      const cancelPayDoc = {
        _id: payId,
        code: 'PAY-R127-02',
        target: { type: 'APPOINTMENT', id: aptId },
        method: 'ONLINE_MOCK',
        kind: 'FULL',
        status: 'PENDING',
        amount: 300000,
        save: jest.fn().mockResolvedValue(true),
      };
      const cancelledAptDoc = {
        _id: aptId,
        code: 'APT-R127-02',
        customerId: customerAId,
        branchId: branch1Id,
        status: 'CANCELLED',
        paymentMethod: 'ONLINE_MOCK',
        holdExpiresAt: null,
        pricing: { finalAmount: 300000, paidAmount: 0 },
        deposit: { status: 'NOT_REQUIRED' },
        services: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Payment, 'findById').mockReturnValue(makeChainQuery(cancelPayDoc));
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeChainQuery(cancelledAptDoc));

      const cancelPayRes = await request(app)
        .post(`/api/v1/payments/${payId}/mock/complete`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `idemp-r127-cancel-${Date.now()}`)
        .send({ outcome: 'PAID' });

      expect(cancelPayRes.status).toBe(409);
      expect(cancelPayDoc.status).toBe('CANCELLED');
      expect(cancelledAptDoc.pricing.paidAmount).toBe(0);

      // Case 3: Pending appointment past holdExpiresAt via direct paymentService call -> 409, EXPIRED (not PAID), apt CANCELLED
      const expiredPayDoc = {
        _id: payId,
        code: 'PAY-R127-03',
        method: 'ONLINE_MOCK',
        kind: 'FULL',
        status: 'PENDING',
        amount: 300000,
        save: jest.fn().mockResolvedValue(true),
      };
      const expiredAptDoc = {
        _id: aptId,
        code: 'APT-R127-03',
        customerId: customerAId,
        branchId: branch1Id,
        prepaymentId: payId,
        status: 'PENDING_PAYMENT',
        paymentMethod: 'ONLINE_MOCK',
        holdExpiresAt: new Date(Date.now() - 60000),
        pricing: { finalAmount: 300000, paidAmount: 0 },
        deposit: { status: 'NOT_REQUIRED' },
        services: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Payment, 'findById').mockReturnValue(makeChainQuery(expiredPayDoc));
      jest.spyOn(Appointment, 'findOne').mockReturnValue(makeChainQuery({ _id: aptId }));
      jest.spyOn(Appointment, 'findById').mockReturnValue(makeChainQuery(expiredAptDoc));
      jest.spyOn(SlotReservation, 'deleteMany').mockResolvedValue({ deletedCount: 1 });

      await expect(paymentService.mockCompletePayment(payId.toString(), { outcome: 'PAID' }))
        .rejects.toMatchObject({ status: 409, code: 'PAYMENT_STATE_ERROR' });
      expect(expiredPayDoc.status).toBe('EXPIRED');
      expect(expiredAptDoc.status).toBe('CANCELLED');
      expect(expiredAptDoc.pricing.paidAmount).toBe(0);
    });

    it('QA-R1-29: Verified Guest OTP opens own appointment detail (200) and denies another guest (403)', async () => {
      const guestAId = new mongoose.Types.ObjectId();
      const guestBId = new mongoose.Types.ObjectId();
      const aptId = new mongoose.Types.ObjectId();

      const guestAToken = jwt.sign(
        { guestContactId: guestAId.toString(), phone: '0901112233', phoneVerified: true, isGuest: true },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );
      const guestBToken = jwt.sign(
        { guestContactId: guestBId.toString(), phone: '0909998877', phoneVerified: true, isGuest: true },
        config.jwt.accessSecret,
        { expiresIn: '15m' }
      );

      const aptDoc = {
        _id: aptId,
        code: 'APT-GUEST-29',
        guestContactId: guestAId,
        contactSnapshot: { name: 'Guest A', phone: '0901112233' },
        branchId: branch1Id,
        serviceType: 'GROOMING',
        paymentMethod: 'PAY_AT_STORE',
        status: 'PENDING_PAYMENT',
        scheduledStart: new Date(Date.now() + 48 * 3600000),
        scheduledEnd: new Date(Date.now() + 49 * 3600000),
        scheduledDurationMinutes: 60,
        pricing: { subtotal: 200000, finalAmount: 200000, depositAmount: 60000, balanceAmount: 140000, paidAmount: 0 },
        deposit: { status: 'PENDING' },
        services: [],
      };

      jest.spyOn(Appointment, 'findById').mockReturnValue(makeChainQuery(aptDoc));

      const okRes = await request(app)
        .get(`/api/v1/appointments/${aptId}`)
        .set('X-Guest-Lookup-Token', guestAToken);

      expect(okRes.status).toBe(200);
      expect(okRes.body).toHaveProperty('id', aptId.toString());
      expect(okRes.body).toHaveProperty('code', 'APT-GUEST-29');

      const forbiddenRes = await request(app)
        .get(`/api/v1/appointments/${aptId}`)
        .set('X-Guest-Lookup-Token', guestBToken);

      expect(forbiddenRes.status).toBe(403);
    });
  });

  describe('10. Defect Log 19-11 Regression Fixes (QA-R1-08 Order FAILED, QA-R1-27 WriteConflict, QA-R1-17 Cursor, QA-R1-23 Nurse/Audit)', () => {
    it('QA-R1-08: Order callback FAILED handles compensation cleanly without VersionError (returns 200 FAILED & idempotent replay)', async () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(makeSession());
      const orderId = new mongoose.Types.ObjectId();
      const payId = new mongoose.Types.ObjectId();
      const branchObjId = new mongoose.Types.ObjectId(branch1Id);

      // Simulate stale initial order instance whose save() would throw VersionError if called after compensation
      let compensateSaved = false;
      const staleOrderDoc = {
        _id: orderId,
        code: 'ORD-FAIL-08',
        customerId: customerAId,
        fulfillmentBranchId: branchObjId,
        status: 'PENDING',
        items: [],
        save: jest.fn().mockImplementation(async () => {
          if (compensateSaved) {
            throw new Error('VersionError: stale order save should not be called');
          }
          compensateSaved = true;
          return staleOrderDoc;
        }),
      };
      const compensatedOrderDoc = {
        _id: orderId,
        code: 'ORD-FAIL-08',
        customerId: customerAId,
        fulfillmentBranchId: branchObjId,
        status: 'PENDING',
        items: [],
        save: jest.fn().mockImplementation(async () => {
          compensateSaved = true;
          return compensatedOrderDoc;
        }),
      };
      const payDoc = {
        _id: payId,
        code: 'PAY-ORD-08',
        target: { type: 'ORDER', id: orderId },
        method: 'ONLINE_MOCK',
        kind: 'ORDER',
        status: 'PENDING',
        amount: 250000,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Payment, 'findById').mockReturnValue(makeChainQuery(payDoc));
      jest.spyOn(Order, 'findById')
        .mockReturnValueOnce(makeChainQuery(staleOrderDoc)) // assertPaymentTargetAccess (.lean)
        .mockReturnValueOnce(makeChainQuery(staleOrderDoc)) // paymentService initial Order load
        .mockReturnValueOnce(makeChainQuery(compensatedOrderDoc)); // compensateOrderPaymentFailure load
      jest.spyOn(InventoryTransaction, 'find').mockReturnValue(makeChainQuery([]));

      const failRes = await request(app)
        .post(`/api/v1/payments/${payId}/mock/complete`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `idemp-ord-fail-1-${Date.now()}`)
        .send({ outcome: 'FAILED', failureReason: 'User cancelled mock gateway' });

      expect(failRes.status).toBe(200);
      expect(failRes.body.status).toBe('FAILED');
      expect(compensatedOrderDoc.status).toBe('CANCELLED');
      expect(compensatedOrderDoc.payment.status).toBe('FAILED');

      // Replay FAILED callback -> 200 idempotent FAILED
      jest.spyOn(Order, 'findById').mockReturnValue(makeChainQuery(compensatedOrderDoc));
      const replayRes = await request(app)
        .post(`/api/v1/payments/${payId}/mock/complete`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `idemp-ord-fail-2-${Date.now()}`)
        .send({ outcome: 'FAILED' });

      expect(replayRes.status).toBe(200);
      expect(replayRes.body.status).toBe('FAILED');
    });

    it('QA-R1-27: Concurrent WriteConflict (112) with hold-expiry worker maps to 409 PAYMENT_STATE_ERROR instead of 500', async () => {
      const sessionMock = makeSession();
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(sessionMock);
      const aptId = new mongoose.Types.ObjectId();
      const payId = new mongoose.Types.ObjectId();

      const writeConflictErr = Object.assign(new Error('WriteConflict error: this operation conflicted with another operation'), {
        code: 112,
        codeName: 'WriteConflict',
        errorLabels: ['TransientTransactionError'],
      });

      const activeAptDoc = {
        _id: aptId,
        code: 'APT-WC-27',
        customerId: customerAId,
        branchId: branch1Id,
        status: 'PENDING_PAYMENT',
        paymentMethod: 'ONLINE_MOCK',
        holdExpiresAt: new Date(Date.now() + 5 * 60000),
        pricing: { finalAmount: 200000, paidAmount: 0 },
        deposit: { status: 'NOT_REQUIRED' },
        services: [],
        save: jest.fn().mockRejectedValue(writeConflictErr),
      };
      const cancelledAptDoc = {
        ...activeAptDoc,
        status: 'CANCELLED',
        holdExpiresAt: null,
      };
      const payDoc = {
        _id: payId,
        code: 'PAY-WC-27',
        target: { type: 'APPOINTMENT', id: aptId },
        method: 'ONLINE_MOCK',
        kind: 'FULL',
        status: 'PENDING',
        amount: 200000,
        save: jest.fn().mockResolvedValue(true),
      };
      const expiredPayDoc = {
        ...payDoc,
        status: 'EXPIRED',
      };

      jest.spyOn(Payment, 'findById')
        .mockReturnValueOnce(makeChainQuery(payDoc))
        .mockReturnValueOnce(makeChainQuery(expiredPayDoc));
      jest.spyOn(Appointment, 'findById')
        .mockReturnValueOnce(makeChainQuery(activeAptDoc)) // assertPaymentTargetAccess
        .mockReturnValueOnce(makeChainQuery(activeAptDoc)) // inside tx before save throws 112
        .mockReturnValueOnce(makeChainQuery(cancelledAptDoc)); // fresh state after abort

      const res = await request(app)
        .post(`/api/v1/payments/${payId}/mock/complete`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', `idemp-wc-27-${Date.now()}`)
        .send({ outcome: 'PAID' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PAYMENT_STATE_ERROR');
      expect(sessionMock.abortTransaction).toHaveBeenCalled();
    });

    it('QA-R1-17: GET /api/v1/products cursor pagination ignores OpenAPI default page=1 for PRICE_ASC and PRICE_DESC', async () => {
      const ids = [
        new mongoose.Types.ObjectId('660000000000000000000011'),
        new mongoose.Types.ObjectId('660000000000000000000012'),
        new mongoose.Types.ObjectId('660000000000000000000013'),
      ];
      const docs = ids.map((id, idx) => ({
        _id: id,
        name: `Prod ${idx + 1}`,
        status: 'ACTIVE',
        minPrice: (idx + 1) * 10000,
        variants: [{ _id: new mongoose.Types.ObjectId(), price: (idx + 1) * 10000, finalPrice: (idx + 1) * 10000, status: 'ACTIVE' }],
      }));

      const chain = makeChainQuery([docs[0], docs[1], docs[2]]);
      const findSpy = jest.spyOn(Product, 'find').mockReturnValue(chain);
      jest.spyOn(Product, 'countDocuments').mockResolvedValue(3);

      const page1Res = await request(app)
        .get('/api/v1/products?sort=PRICE_ASC&limit=2');

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.items.map((i) => i.id)).toEqual([ids[0].toString(), ids[1].toString()]);
      expect(page1Res.body.nextCursor).toBeTruthy();

      const chain2 = makeChainQuery([docs[2]]);
      findSpy.mockReturnValue(chain2);

      // Even though OpenAPI defaults query.page to 1 when omitted, cursor MUST prevent skip(0) and apply cursor query
      const page2Res = await request(app)
        .get(`/api/v1/products?sort=PRICE_ASC&limit=2&cursor=${encodeURIComponent(page1Res.body.nextCursor)}`);

      expect(page2Res.status).toBe(200);
      expect(chain2.skip).not.toHaveBeenCalled();
      expect(findSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          $and: expect.arrayContaining([
            expect.objectContaining({
              $or: [
                { 'variants.price': { $gt: 20000 } },
                { 'variants.price': 20000, _id: { $gt: ids[1] } },
              ],
            }),
          ]),
        })
      );
      expect(page2Res.body.items.map((i) => i.id)).toEqual([ids[2].toString()]);
    });

    it('QA-R1-23: Blocks Nurse from updating materials on a Veterinarian segment ServiceRecord (403 ASSIGNMENT_SCOPE_ERROR)', async () => {
      const nurseUserId = new mongoose.Types.ObjectId();
      const nurseProfileId = new mongoose.Types.ObjectId();
      const vetProfileId = new mongoose.Types.ObjectId();
      const nurseSvcId = new mongoose.Types.ObjectId();
      const vetSvcId = new mongoose.Types.ObjectId();
      const vetRecordId = new mongoose.Types.ObjectId();
      const itemA = new mongoose.Types.ObjectId();

      const vetRecDoc = {
        _id: vetRecordId,
        code: 'SR-VET-23',
        appointmentId: new mongoose.Types.ObjectId(),
        branchId: branch1Id,
        recordType: 'MEDICAL',
        status: 'IN_PROGRESS',
        serviceIds: [vetSvcId],
        assignedStaffIds: [vetProfileId],
        version: 1,
        actualMaterials: [],
        materialAudit: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue(vetRecDoc);
      jest.spyOn(StaffProfile, 'findOne').mockReturnValue(makeChainQuery({ _id: nurseProfileId, userId: nurseUserId }));
      jest.spyOn(Appointment, 'findById').mockResolvedValue({
        _id: vetRecDoc.appointmentId,
        services: [
          { serviceId: nurseSvcId, requiredStaffRole: 'NURSE', assignedStaffId: nurseProfileId },
          { serviceId: vetSvcId, requiredStaffRole: 'VETERINARIAN', assignedStaffId: vetProfileId },
        ],
      });

      await expect(
        executionService.updateMaterials(
          vetRecordId.toString(),
          { materials: [{ inventoryItemId: itemA.toString(), quantity: 1 }] },
          { id: nurseUserId.toString(), fullName: 'Y ta Lan', systemRole: 'STAFF', staffSubRole: 'NURSE' }
        )
      ).rejects.toMatchObject({ status: 403, code: 'ASSIGNMENT_SCOPE_ERROR' });
    });
  });

  // =========================================================================
  // 11. FE HANDOFF 19-11: OpenAPI PetInline speciesDetail & Preview Pricing Voucher Customer Context
  // =========================================================================
  describe('11. OpenAPI PetInline speciesDetail & Preview Pricing Voucher Customer Context', () => {
    it('Accepts pet.speciesDetail, speciesName, ageYears, healthStatus, medicalNotes on POST /api/v1/internal/appointments and /appointments through OpenAPI validator', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const adminToken = makeToken({ id: adminId.toString(), systemRole: 'ADMIN', name: 'Admin QA' });
      const targetCustProfileId = new mongoose.Types.ObjectId();
      const svcId = new mongoose.Types.ObjectId();

      jest.spyOn(Branch, 'findById').mockReturnValue(
        makeChainQuery({
          _id: branch1Id,
          code: 'BR-01',
          name: 'Q1',
          status: 'ACTIVE',
          openingHours: {
            mon: { open: '08:00', close: '20:00' },
            tue: { open: '08:00', close: '20:00' },
            wed: { open: '08:00', close: '20:00' },
            thu: { open: '08:00', close: '20:00' },
            fri: { open: '08:00', close: '20:00' },
            sat: { open: '08:00', close: '20:00' },
            sun: { open: '08:00', close: '20:00' },
          },
          holidays: [],
        })
      );
      jest.spyOn(Customer, 'findOne').mockReturnValue(
        makeChainQuery({
          _id: targetCustProfileId,
          userId: customerAId,
          fullName: 'Khach Hang A',
          phone: '0901112223',
          email: 'a@test.com',
        })
      );
      jest.spyOn(Service, 'find').mockReturnValue(
        makeChainQuery([
          {
            _id: svcId,
            code: 'MED01',
            name: 'Kham tong quat',
            serviceType: 'MEDICAL',
            bookingMode: 'BOOKABLE',
            status: 'ACTIVE',
            basePrice: 150000,
            durationMinutes: 30,
            requiredStaffRole: 'VETERINARIAN',
          },
        ])
      );
      jest.spyOn(BranchServiceConfig, 'find').mockReturnValue(
        makeChainQuery([{ branchId: branch1Id, serviceId: svcId, enabled: true, capacity: 3 }])
      );
      jest.spyOn(Appointment, 'countDocuments').mockReturnValue(makeChainQuery(0));
      jest.spyOn(Appointment, 'find').mockReturnValue(makeChainQuery([]));
      jest.spyOn(Appointment, 'distinct').mockReturnValue(makeChainQuery([]));
      jest.spyOn(Appointment, 'aggregate').mockReturnValue(makeChainQuery([]));
      jest.spyOn(SlotReservation, 'distinct').mockReturnValue(makeChainQuery([]));
      jest.spyOn(Shift, 'find').mockReturnValue(
        makeChainQuery([
          {
            branchId: branch1Id,
            staffId: { _id: staffProfile1Id, staffSubRole: 'VETERINARIAN', status: 'ACTIVE' },
            status: 'ACTIVE',
            startAt: new Date('2026-11-23T00:00:00.000Z'),
            endAt: new Date('2026-11-23T15:00:00.000Z'),
          },
        ])
      );
      jest.spyOn(StaffProfile, 'find').mockReturnValue(makeChainQuery([{ _id: staffProfile1Id, staffSubRole: 'VETERINARIAN', status: 'ACTIVE' }]));
      jest.spyOn(StaffProfile, 'findOne').mockReturnValue(makeChainQuery({ _id: staffProfile1Id, staffSubRole: 'VETERINARIAN', status: 'ACTIVE' }));
      jest.spyOn(SlotReservation, 'find').mockReturnValue(makeChainQuery([]));
      jest.spyOn(SlotReservation, 'insertMany').mockResolvedValue([]);
      jest.spyOn(SlotReservation, 'updateMany').mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(SlotReservation.prototype, 'save').mockResolvedValue(true);
      jest.spyOn(Payment.prototype, 'save').mockResolvedValue(true);
      jest.spyOn(Pet.prototype, 'save').mockResolvedValue(true);
      jest.spyOn(Appointment.prototype, 'save').mockResolvedValue(true);

      const res = await request(app)
        .post('/api/v1/internal/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'idemp-petinline-speciesdetail-1')
        .send({
          branchId: branch1Id.toString(),
          serviceIds: [svcId.toString()],
          slotStart: '2026-11-23T02:00:00.000Z',
          customerId: customerAId.toString(),
          pet: {
            name: 'Bé Nhím',
            species: 'OTHER',
            speciesDetail: 'Nhím kiểng',
            speciesName: 'Nhím kiểng',
            breed: 'Hedgehog',
            ageYears: 1,
            weightKg: 0.5,
            healthStatus: 'NORMAL',
            medicalNotes: 'Nhút nhát',
          },
          paymentMethod: 'PAY_AT_STORE',
        });

      expect(res.status).not.toBe(400);
      expect(res.status).toBe(201);
      expect(res.body.petSnapshot?.species).toBe('OTHER');
      expect(res.body.petSnapshot?.speciesDetail).toBe('Nhím kiểng');

      // Also verify public/Customer POST /api/v1/appointments allows PetInline speciesDetail
      const custRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${customerAToken}`)
        .set('Idempotency-Key', 'idemp-petinline-speciesdetail-2')
        .send({
          branchId: branch1Id.toString(),
          serviceIds: [svcId.toString()],
          slotStart: '2026-11-23T03:00:00.000Z',
          pet: {
            name: 'Sóc nhỏ',
            species: 'OTHER',
            speciesDetail: 'Sóc bay Úc',
            breed: 'Sugar Glider',
            weightKg: 0.2,
          },
          paymentMethod: 'PAY_AT_STORE',
        });

      expect(custRes.status).not.toBe(400);
      expect(custRes.status).toBe(201);
      expect(custRes.body.petSnapshot?.species).toBe('OTHER');
      expect(custRes.body.petSnapshot?.speciesDetail).toBe('Sóc bay Úc');
    });

    it('preview-pricing resolves target customerId / pet owner / guest for Admin booking on behalf (never Admin actor id) and blocks Customer IDOR', async () => {
      const adminId = new mongoose.Types.ObjectId();
      const adminToken = makeToken({ id: adminId.toString(), systemRole: 'ADMIN', name: 'Admin QA' });
      const targetCustProfileId = new mongoose.Types.ObjectId();
      const petOwnerProfileId = new mongoose.Types.ObjectId();
      const petId = new mongoose.Types.ObjectId();
      const svcId = new mongoose.Types.ObjectId();

      jest.spyOn(Service, 'find').mockResolvedValue([
        {
          _id: svcId,
          code: 'MED01',
          name: 'Kham tong quat',
          serviceType: 'MEDICAL',
          bookingMode: 'BOOKABLE',
          basePrice: 200000,
        },
      ]);
      const voucherSpy = jest.spyOn(voucherService, 'validateVoucherEligibility').mockResolvedValue({
        valid: true,
        discount: 20000,
        voucher: { code: 'SAVE20K' },
      });

      // 1) Admin passes explicit customerId -> must resolve target Customer._id (never adminId)
      jest.spyOn(Customer, 'findOne').mockReturnValueOnce(makeChainQuery({ _id: targetCustProfileId }));
      const adminWithCustRes = await request(app)
        .post('/api/v1/appointments/preview-pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: branch1Id.toString(),
          serviceIds: [svcId.toString()],
          customerId: customerAId.toString(),
          voucherCode: 'SAVE20K',
        });

      expect(adminWithCustRes.status).toBe(200);
      expect(voucherSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          code: 'SAVE20K',
          customerId: targetCustProfileId.toString(),
        })
      );

      // 2) Admin selects petId without customerId -> must infer pet owner's customerId (never adminId)
      jest.spyOn(Pet, 'findById').mockReturnValueOnce(makeChainQuery({ _id: petId, weightKg: 6, customerId: petOwnerProfileId }));
      const adminWithPetRes = await request(app)
        .post('/api/v1/appointments/preview-pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: branch1Id.toString(),
          serviceIds: [svcId.toString()],
          petId: petId.toString(),
          voucherCode: 'SAVE20K',
        });

      expect(adminWithPetRes.status).toBe(200);
      expect(voucherSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          customerId: petOwnerProfileId.toString(),
        })
      );

      // 3) Admin books for walk-in guest (no customerId, no petId) -> customerId must be null (never adminId)
      const adminGuestRes = await request(app)
        .post('/api/v1/appointments/preview-pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          branchId: branch1Id.toString(),
          serviceIds: [svcId.toString()],
          petWeightKg: 5,
          voucherCode: 'SAVE20K',
        });

      expect(adminGuestRes.status).toBe(200);
      expect(voucherSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          customerId: null,
        })
      );
      expect(voucherSpy.mock.calls.some(([args]) => args.customerId === adminId.toString())).toBe(false);

      // 4) Customer caller attempting to spoof customerId -> forced to own Customer identity
      const ownProfileId = new mongoose.Types.ObjectId();
      jest.spyOn(Customer, 'findOne').mockReturnValueOnce(makeChainQuery({ _id: ownProfileId }));
      const custSpoofRes = await request(app)
        .post('/api/v1/appointments/preview-pricing')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({
          branchId: branch1Id.toString(),
          serviceIds: [svcId.toString()],
          customerId: customerBId.toString(),
          voucherCode: 'SAVE20K',
        });

      expect(custSpoofRes.status).toBe(200);
      expect(voucherSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          customerId: ownProfileId.toString(),
        })
      );
    });
  });
});
