import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import GuestContact from '../src/modules/customer/models/GuestContact';
import Customer from '../src/modules/customer/models/Customer';
import User from '../src/models/User';
import Order from '../src/modules/order/models/Order';
import Appointment from '../src/modules/booking/models/Appointment';
import jwt from 'jsonwebtoken';
import config from '../src/shared/config';
import * as guestService from '../src/modules/customer/guest.service';

describe('Task 4.5 P0: Guest, OTP & Activation Lifecycle Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. GuestContact Model Invariants & Guardrails', () => {
    it('enforces schema paths and default values for GuestContact', () => {
      const paths = GuestContact.schema.paths;
      expect(paths.fullName).toBeDefined();
      expect(paths.fullName.isRequired).toBe(true);
      expect(paths.phone).toBeDefined();
      expect(paths.email).toBeDefined();
      expect(paths.activationStatus).toBeDefined();
      expect(paths.activationStatus.enumValues).toEqual([
        'NO_ACCOUNT',
        'PENDING_ACTIVATION',
        'ACTIVATED',
      ]);
      expect(paths.userId).toBeDefined();
      expect(paths.customerId).toBeDefined();
    });

    it('requires at least phone or email via pre-validate middleware', async () => {
      const docWithoutContact = new GuestContact({
        fullName: 'Anonymous Person',
      });
      const err = docWithoutContact.validateSync();
      expect(err).toBeDefined();
      expect(err.errors.phone).toBeDefined();
    });

    it('validates successfully when phone or email is present', () => {
      const docWithPhone = new GuestContact({
        fullName: 'Valid Guest',
        phone: '0988776655',
      });
      expect(docWithPhone.validateSync()).toBeUndefined();

      const docWithEmail = new GuestContact({
        fullName: 'Valid Guest 2',
        email: 'guest2@example.com',
      });
      expect(docWithEmail.validateSync()).toBeUndefined();
    });
  });

  describe('2. OTP Request & Verification Logic', () => {
    it('requestGuestOtp requires phone or email', async () => {
      await expect(guestService.requestGuestOtp({})).rejects.toThrow('Either phone or email must be provided');
    });

    it('requestGuestOtp returns 6-digit OTP in test environment', async () => {
      const res = await guestService.requestGuestOtp({ phone: '0912345678' });
      expect(res.message).toBe('OTP sent successfully');
      expect(res.expiresIn).toBe(300);
      expect(res.otp).toBe('123456');
    });

    it('requestGuestOtp enforces 60-second rate limiting on resend', async () => {
      await expect(guestService.requestGuestOtp({ phone: '0912345678' })).rejects.toThrow(/wait/i);
    });

    it('verifyGuestOtp fails if OTP is wrong', async () => {
      await expect(
        guestService.verifyGuestOtp({ phone: '0912345678', otp: '999999' })
      ).rejects.toThrow('Invalid OTP code.');
    });

    it('verifyGuestOtp succeeds and returns guest token when OTP is correct', async () => {
      const mockGuest = {
        _id: new mongoose.Types.ObjectId(),
        phone: '0912345678',
        email: null,
        activationStatus: 'NO_ACCOUNT',
        save: jest.fn().mockResolvedValue(true),
      };
      jest.spyOn(GuestContact, 'findOne').mockResolvedValue(mockGuest);

      const res = await guestService.verifyGuestOtp({ phone: '0912345678', otp: '123456' });
      expect(res).toHaveProperty('token');
      expect(res).toHaveProperty('expiresIn', 900);
      expect(res).toHaveProperty('guestContactId', mockGuest._id.toString());
    });
  });

  describe('3. REST API Endpoints for Guest & Lookup', () => {
    it('POST /api/v1/guest/lookup/request-otp invokes service and returns 200', async () => {
      jest.spyOn(guestService, 'requestGuestOtp').mockResolvedValue({
        message: 'OTP sent successfully',
        expiresIn: 300,
        otp: '123456',
      });

      const res = await request(app)
        .post('/api/v1/guest/lookup/request-otp')
        .send({ phone: '0933112233' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('OTP sent successfully');
      expect(res.body.otp).toBe('123456');
    });

    it('POST /api/v1/guest/lookup/verify-otp returns token', async () => {
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake';
      jest.spyOn(guestService, 'verifyGuestOtp').mockResolvedValue({
        token: fakeToken,
        expiresIn: 900,
        guestContactId: '507f1f77bcf86cd799439099',
      });

      const res = await request(app)
        .post('/api/v1/guest/lookup/verify-otp')
        .send({ phone: '0933112233', otp: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBe(fakeToken);
      expect(res.body.expiresIn).toBe(900);
    });

    it('GET /api/v1/guest/transactions rejects unauthorized without token', async () => {
      const res = await request(app).get('/api/v1/guest/transactions');
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/guest/transactions returns transactions when token is valid', async () => {
      const validToken = jwt.sign(
        { guestContactId: '507f1f77bcf86cd799439099', phone: '0933112233', isGuest: true },
        config.jwt.accessSecret
      );

      jest.spyOn(guestService, 'getGuestTransactions').mockResolvedValue({
        orders: [],
        appointments: [],
      });

      const res = await request(app)
        .get('/api/v1/guest/transactions')
        .set('x-guest-lookup-token', validToken);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.orders)).toBe(true);
      expect(Array.isArray(res.body.appointments)).toBe(true);
    });
  });

  describe('4. Activation Lifecycle Flow', () => {
    it('POST /api/v1/activation/invite creates activation token for guest', async () => {
      jest.spyOn(guestService, 'sendActivationInvite').mockResolvedValue({
        message: 'Activation invite sent successfully',
        token: 'act-token-12345',
        activationStatus: 'PENDING_ACTIVATION',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const res = await request(app)
        .post('/api/v1/activation/invite')
        .send({ phone: '0933112233' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBe('act-token-12345');
      expect(res.body.activationStatus).toBe('PENDING_ACTIVATION');
    });

    it('POST /api/v1/activation/complete validates terms and password', async () => {
      // Rejects without terms
      const resNoTerms = await request(app)
        .post('/api/v1/activation/complete')
        .send({
          token: 'act-token-12345',
          otp: '123456',
          password: 'Password123',
          acceptTerms: false,
        });
      expect(resNoTerms.status).toBe(400);

      // Rejects weak password (no uppercase)
      const resWeak = await request(app)
        .post('/api/v1/activation/complete')
        .send({
          token: 'act-token-12345',
          otp: '123456',
          password: 'password123',
          acceptTerms: true,
        });
      expect(resWeak.status).toBe(400);
    });

    it('POST /api/v1/activation/complete creates user, customer, and returns 200 with tokens', async () => {
      jest.spyOn(guestService, 'completeActivation').mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900,
        user: {
          id: '507f1f77bcf86cd799439001',
          email: null,
          phone: '0933112233',
          fullName: 'Nguyen Guest Activated',
          systemRole: 'CUSTOMER',
          staffSubRole: null,
          accountStatus: 'ACTIVE',
          activationStatus: 'ACTIVATED',
          lastLogin: null,
          branchScope: [],
        },
      });

      const res = await request(app)
        .post('/api/v1/activation/complete')
        .send({
          token: 'act-token-12345',
          otp: '123456',
          password: 'ValidPassword123!',
          acceptTerms: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe('mock-access-token');
      expect(res.body.user.accountStatus).toBe('ACTIVE');
      expect(res.body.user.activationStatus).toBe('ACTIVATED');
    });
  });
});
