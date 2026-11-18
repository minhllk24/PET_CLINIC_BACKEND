import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app';
import User from '../src/models/User';
import Customer from '../src/modules/customer/models/Customer';
import OtpChallenge from '../src/models/OtpChallenge';
import RefreshSession from '../src/models/RefreshSession';
import { hashOtp } from '../src/utils/otpHelpers';
import { hashPassword } from '../src/utils/passwordHelpers';
import { formatMe, formatAuthTokens } from '../src/modules/auth/auth.serializer';
import * as authService from '../src/modules/auth/auth.service';

describe('Auth & RBAC Comprehensive Tests (OpenAPI v7 & FE Compatibility)', () => {
  const testUserId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001');
  const testPassword = 'AdminPassword@123';

  const mockAdminUser = {
    _id: testUserId,
    phone: '0900000000',
    email: 'admin@petclinic.com',
    fullName: 'System Administrator',
    systemRole: 'ADMIN',
    staffSubRole: null,
    accountStatus: 'ACTIVE',
    activationStatus: 'ACTIVATED',
    activatedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastLoginAt: new Date('2026-01-02T00:00:00.000Z'),
    assignedBranchIds: [new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000002')],
    failedLoginCount: 0,
    lockedUntil: null,
  };

  describe('1. Serializer Compliance (OpenAPI v7 schemas: AuthTokens, Me)', () => {
    it('formatMe produces schema compliant object without internal fields', () => {
      const formatted = formatMe(mockAdminUser);
      expect(formatted).toHaveProperty('id', testUserId.toString());
      expect(formatted).toHaveProperty('fullName', 'System Administrator');
      expect(formatted).toHaveProperty('email', 'admin@petclinic.com');
      expect(formatted).toHaveProperty('phone', '0900000000');
      expect(formatted).toHaveProperty('systemRole', 'ADMIN');
      expect(formatted).toHaveProperty('staffSubRole', null);
      expect(formatted).toHaveProperty('accountStatus', 'ACTIVE');
      expect(formatted).toHaveProperty('activationStatus', 'ACTIVATED');
      expect(formatted).toHaveProperty('lastLogin');
      expect(formatted).toHaveProperty('branchScope');
      expect(Array.isArray(formatted.branchScope)).toBe(true);

      // Must NOT contain Mongoose internal fields
      expect(formatted._id).toBeUndefined();
      expect(formatted.__v).toBeUndefined();
      expect(formatted.passwordHash).toBeUndefined();
    });

    it('formatAuthTokens returns accessToken, refreshToken, expiresIn and user', () => {
      const tokens = formatAuthTokens({
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        expiresIn: 900,
        user: mockAdminUser,
      });

      expect(tokens.accessToken).toBe('mock_access_token');
      expect(tokens.refreshToken).toBe('mock_refresh_token');
      expect(tokens.expiresIn).toBe(900);
      expect(tokens.user).toBeDefined();
      expect(tokens.user.systemRole).toBe('ADMIN');
    });
  });

  describe('2. Login Route Contract & Cookie Checks', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('POST /api/v1/auth/login validates request schema (rejects empty body with 400)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/v1/auth/login succeeds, sets HttpOnly cookie and returns tokens + user', async () => {
      jest.spyOn(authService, 'login').mockResolvedValueOnce({
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_opaque_refresh_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        user: mockAdminUser,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: '0900000000',
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'mock_jwt_access_token');
      expect(res.body).toHaveProperty('refreshToken', 'mock_opaque_refresh_token');
      expect(res.body).toHaveProperty('expiresIn', 900);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('systemRole', 'ADMIN');
      expect(res.body.user).toHaveProperty('phone', '0900000000');

      // Check HttpOnly refreshToken cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('POST /api/v1/auth/login allows identifier as email', async () => {
      jest.spyOn(authService, 'login').mockResolvedValueOnce({
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_opaque_refresh_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        user: mockAdminUser,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'admin@petclinic.com',
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('admin@petclinic.com');
    });

    it('POST /api/v1/auth/login allows identifier as plain text username admin', async () => {
      jest.spyOn(authService, 'login').mockResolvedValueOnce({
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_opaque_refresh_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        user: { ...mockAdminUser, username: 'admin' },
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'admin',
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('systemRole', 'ADMIN');
      expect(res.body.user).toHaveProperty('phone', '0900000000');
    });

    it('POST /api/v1/auth/login allows username field directly in request body', async () => {
      jest.spyOn(authService, 'login').mockResolvedValueOnce({
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_opaque_refresh_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        user: { ...mockAdminUser, username: 'admin' },
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          password: testPassword,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'mock_jwt_access_token');
      expect(res.body.user).toHaveProperty('systemRole', 'ADMIN');
      expect(res.body.user).toHaveProperty('phone', '0900000000');
    });

    it('POST /api/v1/auth/login allows role-based text usernames for staff and manager accounts', async () => {
      const demoAccounts = [
        { username: 'manager', systemRole: 'MANAGER', staffSubRole: null },
        { username: 'doctor', systemRole: 'STAFF', staffSubRole: 'VETERINARIAN' },
        { username: 'receptionist', systemRole: 'STAFF', staffSubRole: 'RECEPTIONIST' },
        { username: 'groomer', systemRole: 'STAFF', staffSubRole: 'CARE_STAFF_GROOMER' },
        { username: 'nurse', systemRole: 'STAFF', staffSubRole: 'NURSE' },
        { username: 'customer', systemRole: 'CUSTOMER', staffSubRole: null },
      ];

      for (const account of demoAccounts) {
        jest.spyOn(authService, 'login').mockResolvedValueOnce({
          accessToken: 'mock_jwt_access_token',
          refreshToken: 'mock_opaque_refresh_token',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          user: {
            ...mockAdminUser,
            username: account.username,
            systemRole: account.systemRole,
            staffSubRole: account.staffSubRole,
          },
        });

        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            identifier: account.username,
            password: testPassword,
          });

        expect(res.status).toBe(200);
        expect(res.body.user).toHaveProperty('systemRole', account.systemRole);
        if (account.staffSubRole) {
          expect(res.body.user).toHaveProperty('staffSubRole', account.staffSubRole);
        }
      }
    });

    it('POST /api/v1/auth/login ignores client rememberMe flag without triggering additionalProperties error', async () => {
      jest.spyOn(authService, 'login').mockResolvedValueOnce({
        accessToken: 'mock_jwt_access_token',
        refreshToken: 'mock_opaque_refresh_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        user: mockAdminUser,
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: '0900000000',
          password: testPassword,
          rememberMe: true,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'mock_jwt_access_token');
    });
  });

  describe('3. Token Refresh & HttpOnly Cookie', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('POST /api/v1/auth/refresh reads cookie and rotates refresh token', async () => {
      jest.spyOn(authService, 'refreshToken').mockResolvedValueOnce({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refreshToken=existing_cookie_token'])
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken', 'new_access_token');
      expect(res.body).toHaveProperty('refreshToken', 'new_refresh_token');

      // Verifies cookie is updated
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
    });
  });

  describe('4. User Profile & Logout', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('GET /api/v1/auth/me returns profile for authenticated user', async () => {
      jest.spyOn(authService, 'getMe').mockResolvedValueOnce(mockAdminUser);

      // Bearer token signed with test jwt secret
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: testUserId.toString(), systemRole: 'ADMIN' },
        process.env.JWT_ACCESS_TOKEN_SECRET || 'test_access_secret'
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', testUserId.toString());
      expect(res.body).toHaveProperty('systemRole', 'ADMIN');
      expect(res.body).toHaveProperty('fullName', 'System Administrator');
    });

    it('POST /api/v1/auth/logout clears cookie and returns 204 No Content', async () => {
      jest.spyOn(authService, 'logout').mockResolvedValueOnce(true);

      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: testUserId.toString(), systemRole: 'ADMIN' },
        process.env.JWT_ACCESS_TOKEN_SECRET || 'test_access_secret'
      );

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', ['refreshToken=some_token']);

      expect(res.status).toBe(204);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      // Cookie is cleared
      const clearCookie = cookies.find((c) => c.startsWith('refreshToken=;'));
      expect(clearCookie).toBeDefined();
    });
  });

  describe('5. Legacy Rules & End-to-End Auth/OTP/Password Recovery Alignment', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('5.1 Register with +84 phone & email -> POST /api/v1/verify-register-otp with login_id: email activates account', async () => {
      const pendingUser = {
        _id: new mongoose.Types.ObjectId(),
        phone: '0968657205',
        email: 'newcustomer@petclinic.vn',
        fullName: 'Khách Hàng Mới',
        systemRole: 'CUSTOMER',
        accountStatus: 'PENDING_ACTIVATION',
        activatedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(User, 'create').mockResolvedValue(pendingUser);
      jest.spyOn(OtpChallenge, 'deleteMany').mockResolvedValue({ deletedCount: 0 });
      const createdChallenges = [];
      jest.spyOn(OtpChallenge, 'create').mockImplementation(async (doc) => {
        createdChallenges.push(doc);
        return { _id: new mongoose.Types.ObjectId(), ...doc };
      });

      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Khách Hàng Mới',
          phone: '+84968657205',
          email: 'newcustomer@petclinic.vn',
          password: 'Password@123',
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.identifier).toBe('0968657205');
      expect(createdChallenges).toHaveLength(2);
      const otpCode = regRes.body.debugOtp;
      expect(otpCode).toMatch(/^\d{6}$/);

      // Now verify via legacy FE endpoint /api/v1/verify-register-otp using email in login_id
      const emailChallenge = {
        _id: new mongoose.Types.ObjectId(),
        identifier: 'newcustomer@petclinic.vn',
        purpose: 'REGISTER',
        otpHash: hashOtp(otpCode),
        attemptCount: 0,
        expiresAt: new Date(Date.now() + 300000),
        verifiedAt: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(OtpChallenge, 'findOne').mockResolvedValue(emailChallenge);
      jest.spyOn(User, 'findOne').mockResolvedValue(pendingUser);
      jest.spyOn(Customer, 'findOneAndUpdate').mockResolvedValue({});

      const verifyRes = await request(app)
        .post('/api/v1/verify-register-otp')
        .send({
          login_id: 'newcustomer@petclinic.vn',
          otp_code: otpCode,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('verified', true);
      expect(pendingUser.accountStatus).toBe('ACTIVE');
      expect(pendingUser.activatedAt).toBeInstanceOf(Date);
      expect(pendingUser.save).toHaveBeenCalled();
    });

    it('5.2 Re-registering an existing PENDING_ACTIVATION user updates info & re-dispatches OTP instead of throwing 409', async () => {
      const existingPendingUser = {
        _id: new mongoose.Types.ObjectId(),
        phone: '0968657205',
        email: 'pending@petclinic.vn',
        fullName: 'Tên Cũ',
        systemRole: 'CUSTOMER',
        accountStatus: 'PENDING_ACTIVATION',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(existingPendingUser);
      jest.spyOn(OtpChallenge, 'deleteMany').mockResolvedValue({ deletedCount: 2 });
      jest.spyOn(OtpChallenge, 'create').mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Tên Mới Đã Cập Nhật',
          phone: '0968657205',
          email: 'pending@petclinic.vn',
          password: 'NewPassword@123',
        });

      expect(res.status).toBe(201);
      expect(existingPendingUser.fullName).toBe('Tên Mới Đã Cập Nhật');
      expect(existingPendingUser.save).toHaveBeenCalled();
    });

    it('5.3 Forgot password -> verify-otp returns dual { resetToken, reset_token } -> reset-password with reset_token succeeds and revokes sessions', async () => {
      const activeUser = {
        _id: new mongoose.Types.ObjectId(),
        phone: '0912345678',
        email: 'forgot@petclinic.vn',
        fullName: 'Nguyễn Văn Quên',
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        failedLoginCount: 3,
        lockedUntil: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(activeUser);
      jest.spyOn(OtpChallenge, 'findOne').mockResolvedValue(null);
      let savedOtpHash = null;
      jest.spyOn(OtpChallenge, 'findOneAndUpdate').mockImplementation(async (_filter, update) => {
        savedOtpHash = update.otpHash;
        return { _id: new mongoose.Types.ObjectId(), ...update };
      });

      const forgotRes = await request(app)
        .post('/api/v1/forgot-password')
        .send({ email: 'forgot@petclinic.vn' });

      expect(forgotRes.status).toBe(200);
      const otpCode = forgotRes.body.debugOtp;
      expect(otpCode).toMatch(/^\d{6}$/);
      expect(savedOtpHash).toBe(hashOtp(otpCode));

      // Verify OTP via legacy FE endpoint /api/v1/verify-otp
      jest.spyOn(OtpChallenge, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        identifier: 'forgot@petclinic.vn',
        purpose: 'FORGOT_PASSWORD',
        otpHash: savedOtpHash,
        attemptCount: 0,
        expiresAt: new Date(Date.now() + 300000),
        verifiedAt: null,
        save: jest.fn().mockResolvedValue(true),
      });
      jest.spyOn(OtpChallenge, 'updateMany').mockResolvedValue({ modifiedCount: 2 });

      const verifyRes = await request(app)
        .post('/api/v1/verify-otp')
        .send({
          email: 'forgot@petclinic.vn',
          otp_code: otpCode,
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toHaveProperty('resetToken');
      expect(verifyRes.body).toHaveProperty('reset_token', verifyRes.body.resetToken);

      // Reset password using snake_case reset_token and new_password (exact FE payload)
      jest.spyOn(User, 'findById').mockResolvedValue(activeUser);
      jest.spyOn(OtpChallenge, 'deleteMany').mockResolvedValue({ deletedCount: 2 });
      const revokeSpy = jest.spyOn(RefreshSession, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      const resetRes = await request(app)
        .post('/api/v1/reset-password')
        .send({
          reset_token: verifyRes.body.reset_token,
          new_password: 'NewStrongPassword@123',
        });

      expect(resetRes.status).toBe(200);
      expect(activeUser.failedLoginCount).toBe(0);
      expect(activeUser.save).toHaveBeenCalled();
      expect(revokeSpy).toHaveBeenCalled();
    });

    it('5.4 Forgot password & resendOtp enforce 30s cooldown and reset verifiedAt = null on re-issue', async () => {
      const activeUser = {
        _id: new mongoose.Types.ObjectId(),
        phone: '0912345678',
        email: 'cooldown@petclinic.vn',
        fullName: 'Cooldown User',
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(activeUser);
      // Simulate an OTP sent 5 seconds ago
      jest.spyOn(OtpChallenge, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        identifier: '0912345678',
        purpose: 'FORGOT_PASSWORD',
        lastSentAt: new Date(Date.now() - 5000),
        verifiedAt: new Date(Date.now() - 2000),
      });

      const cooldownRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: '+84912345678' });

      expect(cooldownRes.status).toBe(429);
      expect(cooldownRes.body.code).toBe('OTP_COOLDOWN');

      // Simulate cooldown elapsed (40 seconds ago) -> must reset verifiedAt: null
      jest.spyOn(OtpChallenge, 'findOne').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        identifier: '0912345678',
        purpose: 'FORGOT_PASSWORD',
        lastSentAt: new Date(Date.now() - 40000),
        verifiedAt: new Date(Date.now() - 35000),
      });
      const updateSpy = jest.spyOn(OtpChallenge, 'findOneAndUpdate').mockResolvedValue({});

      const resendRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: '+84912345678' });

      expect(resendRes.status).toBe(200);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: '0912345678', purpose: 'FORGOT_PASSWORD' }),
        expect.objectContaining({ verifiedAt: null, attemptCount: 0 }),
        expect.any(Object)
      );
    });

    it('5.5 POST /api/v1/change-password accepts legacy FE payload { old_password, new_password } without confirmPassword', async () => {
      const currentPasswordHash = await hashPassword('OldPassword@123');
      const userDoc = {
        _id: testUserId,
        phone: '0900000000',
        email: 'admin@petclinic.com',
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        passwordHash: currentPasswordHash,
        assignedBranchIds: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findById').mockResolvedValue(userDoc);
      jest.spyOn(RefreshSession, 'updateMany').mockResolvedValue({ modifiedCount: 0 });

      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: testUserId.toString(), systemRole: 'CUSTOMER' },
        process.env.JWT_ACCESS_TOKEN_SECRET || 'test_access_secret'
      );

      const res = await request(app)
        .post('/api/v1/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          old_password: 'OldPassword@123',
          new_password: 'NewPassword@456',
        });

      expect(res.status).toBe(200);
      expect(userDoc.save).toHaveBeenCalled();
    });

    it('5.6 Normal CUSTOMER account increments failedLoginCount and locks with 423 ACCOUNT_LOCKED after 5 failed attempts', async () => {
      const realHash = await hashPassword('CorrectPass@123');
      const customerDoc = {
        _id: new mongoose.Types.ObjectId(),
        phone: '0977889900',
        email: 'realcustomer@petclinic.vn',
        fullName: 'Real Customer',
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        passwordHash: realHash,
        failedLoginCount: 4,
        lockedUntil: null,
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(customerDoc);

      // 5th wrong attempt triggers lockout (even if using a UAT password like Password123! on non-0905555555 account)
      const failRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: '+84977889900',
          password: 'Password123!',
        });

      expect(failRes.status).toBe(401);
      expect(customerDoc.failedLoginCount).toBe(5);
      expect(customerDoc.lockedUntil).toBeInstanceOf(Date);

      // Next attempt while locked returns 423 ACCOUNT_LOCKED
      const lockedRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: '0977889900',
          password: 'CorrectPass@123',
        });

      expect(lockedRes.status).toBe(423);
      expect(lockedRes.body.code).toBe('ACCOUNT_LOCKED');
    });
  });
});
