import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import Customer from '../src/modules/customer/models/Customer';
import User from '../src/models/User';
import RefreshSession from '../src/models/RefreshSession';
import GuestContact from '../src/modules/customer/models/GuestContact';
import * as customerService from '../src/modules/customer/customer.service';
import * as guestService from '../src/modules/customer/guest.service';
import config from '../src/shared/config';

describe('P0 & P1 Suite: Guest, OTP Activation & Customer Account Management', () => {
  const branch1Id = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000010');
  const branch2Id = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000020');

  const adminToken = jwt.sign(
    {
      id: new mongoose.Types.ObjectId().toString(),
      systemRole: 'ADMIN',
      staffSubRole: null,
      assignedBranchIds: [],
      authorizedBranchIds: [],
    },
    config.jwt.accessSecret,
    { expiresIn: '1h' }
  );

  const managerBranch1Token = jwt.sign(
    {
      id: new mongoose.Types.ObjectId().toString(),
      systemRole: 'MANAGER',
      staffSubRole: null,
      assignedBranchIds: [branch1Id.toString()],
      authorizedBranchIds: [branch1Id.toString()],
    },
    config.jwt.accessSecret,
    { expiresIn: '1h' }
  );

  const staffToken = jwt.sign(
    {
      id: new mongoose.Types.ObjectId().toString(),
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      assignedBranchIds: [branch1Id.toString()],
      authorizedBranchIds: [branch1Id.toString()],
    },
    config.jwt.accessSecret,
    { expiresIn: '1h' }
  );

  const customerUserId = new mongoose.Types.ObjectId().toString();
  const customerToken = jwt.sign(
    {
      id: customerUserId,
      systemRole: 'CUSTOMER',
      staffSubRole: null,
      assignedBranchIds: [],
      authorizedBranchIds: [],
    },
    config.jwt.accessSecret,
    { expiresIn: '1h' }
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('P0: Guest Lookup & OTP Verification Contract', () => {
    it('POST /api/v1/guest/lookup/otp (OpenAPI v7) returns 202 Accepted with challengeId and expiresIn', async () => {
      jest.spyOn(guestService, 'requestGuestOtp').mockResolvedValue({
        message: 'OTP sent successfully',
        challengeId: '60c72b2f9b1d8b2bad000001',
        expiresIn: 300,
        debugOtp: '123456',
        otp: '123456',
      });

      const res = await request(app)
        .post('/api/v1/guest/lookup/otp')
        .send({ phone: '0912345678' });

      expect(res.status).toBe(202);
      expect(res.body.challengeId).toBe('60c72b2f9b1d8b2bad000001');
      expect(res.body.expiresIn).toBe(300);
    });

    it('POST /api/v1/guest/lookup/verify (OpenAPI v7) returns 200 with lookupToken', async () => {
      const mockToken = 'mock-lookup-token-xyz';
      jest.spyOn(guestService, 'verifyGuestOtp').mockResolvedValue({
        lookupToken: mockToken,
        token: mockToken,
        expiresIn: 900,
        guestContactId: '60c72b2f9b1d8b2bad000002',
      });

      const res = await request(app)
        .post('/api/v1/guest/lookup/verify')
        .send({
          challengeId: '60c72b2f9b1d8b2bad000001',
          otp: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.lookupToken).toBe(mockToken);
      expect(res.body.expiresIn).toBe(900);
    });

    it('enforces 60s cooldown rate limiting on OTP requests', async () => {
      const firstRes = await guestService.requestGuestOtp({ phone: '0988776655' });
      expect(firstRes.challengeId).toBeDefined();

      // Second request immediately should be rejected with 429
      await expect(
        guestService.requestGuestOtp({ phone: '0988776655' })
      ).rejects.toThrow(/wait/i);
    });

    it('rejects verification on invalid OTP', async () => {
      await guestService.requestGuestOtp({ phone: '0977112233' });
      await expect(
        guestService.verifyGuestOtp({ phone: '0977112233', otp: '000000' })
      ).rejects.toThrow('Invalid OTP code.');
    });
  });

  describe('P0: Activation Lifecycle & Strict Contact Linking', () => {
    it('POST /api/v1/activation/invitations accepts guestContactId and returns 202', async () => {
      jest.spyOn(guestService, 'sendActivationInvite').mockResolvedValue({
        message: 'Activation invite sent successfully',
        token: 'invite-token-abc',
        activationStatus: 'PENDING_ACTIVATION',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const res = await request(app)
        .post('/api/v1/activation/invitations')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'idem-invite-001')
        .send({ guestContactId: '60c72b2f9b1d8b2bad000003' });

      expect(res.status).toBe(202);
      expect(res.body.token).toBe('invite-token-abc');
      expect(res.body.activationStatus).toBe('PENDING_ACTIVATION');
    });

    it('completeActivation validates strong password requirements', async () => {
      // Missing uppercase
      await expect(
        guestService.completeActivation({
          token: 'some-token',
          password: 'password123',
          acceptTerms: true,
        })
      ).rejects.toThrow(/uppercase/i);

      // Missing number
      await expect(
        guestService.completeActivation({
          token: 'some-token',
          password: 'PasswordNoNumber',
          acceptTerms: true,
        })
      ).rejects.toThrow(/number/i);

      // Less than 8 characters
      await expect(
        guestService.completeActivation({
          token: 'some-token',
          password: 'Pass1',
          acceptTerms: true,
        })
      ).rejects.toThrow(/8 characters/i);
    });
  });

  describe('P1: Customer Management - Scoping & Security', () => {
    const custBranch1 = {
      _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000031'),
      userId: {
        _id: new mongoose.Types.ObjectId(),
        fullName: 'Customer Branch 1',
        email: 'cust1@example.com',
        phone: '0911000001',
        accountStatus: 'ACTIVE',
        lastLoginAt: new Date('2026-03-01T10:00:00Z'),
      },
      contactPhone: '0911000001',
      contactEmail: 'cust1@example.com',
      activationStatus: 'ACTIVATED',
      accountStatus: 'ACTIVE',
      activityBranchIds: [branch1Id],
      createdAt: new Date('2026-01-15T08:00:00Z'),
    };

    const custBranch2 = {
      _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000032'),
      userId: {
        _id: new mongoose.Types.ObjectId(),
        fullName: 'Customer Branch 2',
        email: 'cust2@example.com',
        phone: '0911000002',
        accountStatus: 'ACTIVE',
        lastLoginAt: new Date('2026-03-02T10:00:00Z'),
      },
      contactPhone: '0911000002',
      contactEmail: 'cust2@example.com',
      activationStatus: 'ACTIVATED',
      accountStatus: 'ACTIVE',
      activityBranchIds: [branch2Id],
      createdAt: new Date('2026-01-20T08:00:00Z'),
    };

    it('formatCustomerDetail formats schema-compliant output', () => {
      const formatted = customerService.formatCustomerDetail(custBranch1);
      expect(formatted.id).toBe(custBranch1._id.toString());
      expect(formatted.fullName).toBe('Customer Branch 1');
      expect(formatted.email).toBe('cust1@example.com');
      expect(formatted.phone).toBe('0911000001');
      expect(formatted.activationStatus).toBe('ACTIVATED');
      expect(formatted.accountStatus).toBe('ACTIVE');
      expect(formatted.lastLogin).toBe(new Date('2026-03-01T10:00:00Z').toISOString());
      expect(formatted._id).toBeUndefined();
    });

    it('Manager getCustomerById outside assigned branches throws 403 Forbidden', async () => {
      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(custBranch2),
      });

      const actorManager = {
        id: 'manager1',
        systemRole: 'MANAGER',
        assignedBranchIds: [branch1Id],
      };

      await expect(
        customerService.getCustomerById(custBranch2._id.toString(), actorManager)
      ).rejects.toThrow('Customer is outside your assigned branches');
    });

    it('Manager getCustomerById within assigned branch succeeds', async () => {
      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(custBranch1),
      });

      const actorManager = {
        id: 'manager1',
        systemRole: 'MANAGER',
        assignedBranchIds: [branch1Id],
      };

      const result = await customerService.getCustomerById(custBranch1._id.toString(), actorManager);
      expect(result.id).toBe(custBranch1._id.toString());
      expect(result.fullName).toBe('Customer Branch 1');
    });

    it('Customer cannot view another customer profile (403 Forbidden)', async () => {
      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(custBranch1),
      });

      const actorCustomerOther = {
        id: 'different-customer-id',
        systemRole: 'CUSTOMER',
      };

      await expect(
        customerService.getCustomerById(custBranch1._id.toString(), actorCustomerOther)
      ).rejects.toThrow('You do not have permission to view this customer');
    });

    it('Staff can view customer profile by ID', async () => {
      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(custBranch1),
      });

      const actorStaff = {
        id: 'staff-id',
        systemRole: 'STAFF',
        staffSubRole: 'RECEPTIONIST',
      };

      const result = await customerService.getCustomerById(custBranch1._id.toString(), actorStaff);
      expect(result.id).toBe(custBranch1._id.toString());
    });
  });

  describe('P1: Customer Block & Unblock with Audit and Session Revocation', () => {
    const targetCustomer = {
      _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000041'),
      userId: {
        _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000042'),
        fullName: 'Bad Actor',
        email: 'bad@example.com',
        phone: '0999888777',
        accountStatus: 'ACTIVE',
      },
      activationStatus: 'ACTIVATED',
      accountStatus: 'ACTIVE',
      blockReason: null,
      save: jest.fn().mockResolvedValue(true),
    };

    it('Manager attempting to block customer is rejected with 403 Forbidden', async () => {
      const actorManager = { id: 'm1', systemRole: 'MANAGER' };
      await expect(
        customerService.blockCustomer(targetCustomer._id.toString(), { reason: 'Violation' }, actorManager)
      ).rejects.toThrow('Only ADMIN can block customer accounts');
    });

    it('Admin blocking requires non-empty reason (minimum 3 chars)', async () => {
      const actorAdmin = { id: 'admin1', systemRole: 'ADMIN' };
      await expect(
        customerService.blockCustomer(targetCustomer._id.toString(), { reason: '' }, actorAdmin)
      ).rejects.toThrow('A valid reason');

      await expect(
        customerService.blockCustomer(targetCustomer._id.toString(), { reason: 'no' }, actorAdmin)
      ).rejects.toThrow('A valid reason');
    });

    it('Admin block updates accountStatus to BLOCKED and revokes refresh sessions', async () => {
      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(targetCustomer),
      });
      const userUpdateSpy = jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(true);
      const sessionDeleteSpy = jest.spyOn(RefreshSession, 'deleteMany').mockResolvedValue(true);

      const actorAdmin = { id: 'admin1', systemRole: 'ADMIN' };
      const res = await customerService.blockCustomer(
        targetCustomer._id.toString(),
        { reason: 'Fraudulent credit activity' },
        actorAdmin
      );

      expect(res.accountStatus).toBe('BLOCKED');
      expect(res.blockedReason).toBe('Fraudulent credit activity');
      expect(userUpdateSpy).toHaveBeenCalledWith(
        targetCustomer.userId._id,
        { accountStatus: 'BLOCKED' }
      );
      expect(sessionDeleteSpy).toHaveBeenCalledWith({
        userId: targetCustomer.userId._id,
      });
    });

    it('Admin unblock restores accountStatus to ACTIVE', async () => {
      const blockedCustomer = {
        ...targetCustomer,
        accountStatus: 'BLOCKED',
        blockReason: 'Previous fraud',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Customer, 'findById').mockReturnValue({
        populate: jest.fn().mockResolvedValue(blockedCustomer),
      });
      const userUpdateSpy = jest.spyOn(User, 'findByIdAndUpdate').mockResolvedValue(true);

      const actorAdmin = { id: 'admin1', systemRole: 'ADMIN' };
      const res = await customerService.unblockCustomer(
        blockedCustomer._id.toString(),
        { reason: 'Identity verified with passport' },
        actorAdmin
      );

      expect(res.accountStatus).toBe('ACTIVE');
      expect(res.blockedReason).toBeNull();
      expect(userUpdateSpy).toHaveBeenCalledWith(
        blockedCustomer.userId._id,
        { accountStatus: 'ACTIVE' }
      );
    });

    it('POST /api/v1/admin/customers/:id/block via HTTP returns 200 for Admin', async () => {
      jest.spyOn(customerService, 'blockCustomer').mockResolvedValue({
        id: targetCustomer._id.toString(),
        activationStatus: 'ACTIVATED',
        accountStatus: 'BLOCKED',
        blockedReason: 'Spam orders',
      });

      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'idem-block-001')
        .send({ reason: 'Spam orders' });

      expect(res.status).toBe(200);
      expect(res.body.accountStatus).toBe('BLOCKED');
      expect(res.body.blockedReason).toBe('Spam orders');
    });

    it('POST /api/v1/admin/customers/:id/block via HTTP rejects Manager with 403', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/customers/${targetCustomer._id}/block`)
        .set('Authorization', `Bearer ${managerBranch1Token}`)
        .set('Idempotency-Key', 'idem-block-002')
        .send({ reason: 'Spam orders' });

      expect(res.status).toBe(403);
    });
  });
});
