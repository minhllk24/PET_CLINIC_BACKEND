import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app';
import User from '../src/models/User';
import RefreshSession from '../src/models/RefreshSession';
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
});
