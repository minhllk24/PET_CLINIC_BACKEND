import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import config from '../src/shared/config';
import Pet from '../src/modules/customer/models/Pet';
import Customer from '../src/modules/customer/models/Customer';
import User from '../src/models/User';
import RefreshSession from '../src/models/RefreshSession';
import * as authService from '../src/modules/auth/auth.service';
import * as guestService from '../src/modules/customer/guest.service';
import { normalizePetStatus, parseMedicalRecords } from '../src/modules/customer/pet.routes';

describe('Pet Profile Medical Records, Status, Google Auth & Guest OTP Suite', () => {
  const customerUserId = new mongoose.Types.ObjectId();
  const customerDocId = new mongoose.Types.ObjectId();
  const petId = new mongoose.Types.ObjectId();

  const customerAuthToken = jwt.sign(
    {
      id: customerUserId.toString(),
      systemRole: 'CUSTOMER',
      email: 'customer_pet_test@example.com',
    },
    config.jwt.accessSecret,
    { expiresIn: '1h' }
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. PET MEDICAL RECORDS & DOCTOR NAME PERSISTENCE
  // =========================================================================
  describe('1. Pet Profile Medical Records & Doctor Name Persistence', () => {
    test('normalizePetStatus correctly handles ACTIVE and HIDDEN statuses and aliases', () => {
      expect(normalizePetStatus('ACTIVE')).toEqual({ status: 'ACTIVE', isArchived: false });
      expect(normalizePetStatus('HOẠT ĐỘNG')).toEqual({ status: 'ACTIVE', isArchived: false });
      expect(normalizePetStatus('HIDDEN')).toEqual({ status: 'HIDDEN', isArchived: true });
      expect(normalizePetStatus('ẨN')).toEqual({ status: 'HIDDEN', isArchived: true });
      expect(normalizePetStatus('INACTIVE')).toEqual({ status: 'HIDDEN', isArchived: true });
      expect(normalizePetStatus(undefined, true)).toEqual({ status: 'HIDDEN', isArchived: true });
      expect(normalizePetStatus(undefined, false)).toEqual({ status: 'ACTIVE', isArchived: false });
    });

    test('parseMedicalRecords correctly extracts doctorName, medicalRecordFileUrl, and medicalRecords', () => {
      const parsedSingle = parseMedicalRecords({
        doctorName: 'BS. Tran Van B',
        medicalRecordFileUrl: 'https://cdn.petclinic.vn/records/milu.pdf',
        medicalNotes: 'Tiem phong day du',
      });
      expect(parsedSingle.doctorName).toBe('BS. Tran Van B');
      expect(parsedSingle.medicalRecordFileUrl).toBe('https://cdn.petclinic.vn/records/milu.pdf');
      expect(parsedSingle.medicalRecords).toHaveLength(1);
      expect(parsedSingle.medicalRecords[0].doctorName).toBe('BS. Tran Van B');
      expect(parsedSingle.medicalRecords[0].fileUrl).toBe('https://cdn.petclinic.vn/records/milu.pdf');

      const parsedArray = parseMedicalRecords({
        medicalRecords: [
          { doctorName: 'BS. Le Thi C', fileUrl: 'https://cdn.petclinic.vn/records/1.pdf', fileName: '1.pdf' },
          { doctorName: 'BS. Pham Van D', fileUrl: 'https://cdn.petclinic.vn/records/2.pdf', fileName: '2.pdf' },
        ],
      });
      expect(parsedArray.medicalRecords).toHaveLength(2);
      expect(parsedArray.medicalRecords[0].doctorName).toBe('BS. Le Thi C');
      expect(parsedArray.medicalRecords[1].doctorName).toBe('BS. Pham Van D');
    });

    test('POST /api/v1/pets creates pet and persists doctorName, medicalRecordFileUrl, medicalRecords, and status', async () => {
      jest.spyOn(Customer, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: customerDocId, userId: customerUserId }),
      });

      const mockSavedPet = {
        _id: petId,
        name: 'Milu',
        species: 'DOG',
        breed: 'Golden Retriever',
        gender: 'MALE',
        ageYears: 3,
        weightKg: 25,
        doctorName: 'BS. Tran Van B',
        medicalRecordFileUrl: 'https://cdn.petclinic.vn/records/milu-benhan-2026.pdf',
        medicalRecords: [
          {
            doctorName: 'BS. Tran Van B',
            fileUrl: 'https://cdn.petclinic.vn/records/milu-benhan-2026.pdf',
            fileName: 'milu-benhan-2026.pdf',
            notes: 'Tiem phong dai day du',
          },
        ],
        status: 'ACTIVE',
        isArchived: false,
        customerId: customerDocId,
      };

      jest.spyOn(Pet.prototype, 'save').mockImplementation(function () {
        Object.assign(this, mockSavedPet);
        return Promise.resolve(this);
      });

      const res = await request(app)
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${customerAuthToken}`)
        .send({
          name: 'Milu',
          species: 'DOG',
          breed: 'Golden Retriever',
          doctorName: 'BS. Tran Van B',
          medicalRecordFileUrl: 'https://cdn.petclinic.vn/records/milu-benhan-2026.pdf',
          medicalNotes: 'Tiem phong dai day du',
          status: 'ACTIVE',
        });

      expect(res.status).toBe(201);
      expect(res.body.doctorName).toBe('BS. Tran Van B');
      expect(res.body.medicalRecordFileUrl).toBe('https://cdn.petclinic.vn/records/milu-benhan-2026.pdf');
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.medicalRecords).toHaveLength(1);
    });

    test('GET /api/v1/pets/:id returns doctorName and medicalRecordFileUrl without data loss', async () => {
      const mockPet = {
        _id: petId,
        name: 'Milu',
        species: 'DOG',
        doctorName: 'BS. Tran Van B',
        medicalRecordFileUrl: 'https://cdn.petclinic.vn/records/milu-benhan-2026.pdf',
        medicalRecords: [
          {
            doctorName: 'BS. Tran Van B',
            fileUrl: 'https://cdn.petclinic.vn/records/milu-benhan-2026.pdf',
            notes: 'Tiem phong dai day du',
          },
        ],
        status: 'ACTIVE',
        isArchived: false,
      };

      jest.spyOn(Pet, 'findById').mockResolvedValue(mockPet);

      const res = await request(app)
        .get(`/api/v1/pets/${petId}`)
        .set('Authorization', `Bearer ${customerAuthToken}`);

      expect(res.status).toBe(200);
      expect(res.body.doctorName).toBe('BS. Tran Van B');
      expect(res.body.medicalRecordFileUrl).toBe('https://cdn.petclinic.vn/records/milu-benhan-2026.pdf');
      expect(res.body.medicalRecords).toHaveLength(1);
    });

    test('PATCH /api/v1/pets/:id updates doctorName, fileUrl, and appends to medicalRecords', async () => {
      const existingPet = {
        _id: petId,
        name: 'Milu',
        doctorName: 'BS. Tran Van B',
        medicalRecordFileUrl: 'https://cdn.petclinic.vn/records/milu-benhan-2026.pdf',
        medicalRecords: [],
      };

      jest.spyOn(Pet, 'findById').mockResolvedValue(existingPet);
      jest.spyOn(Pet, 'findByIdAndUpdate').mockImplementation((id, update) => {
        return Promise.resolve({
          ...existingPet,
          ...update.$set,
        });
      });

      const res = await request(app)
        .patch(`/api/v1/pets/${petId}`)
        .set('Authorization', `Bearer ${customerAuthToken}`)
        .send({
          doctorName: 'BS. Le Thi C',
          medicalRecordFileUrl: 'https://cdn.petclinic.vn/records/milu-xquang-2026.jpg',
        });

      expect(res.status).toBe(200);
      expect(res.body.doctorName).toBe('BS. Le Thi C');
      expect(res.body.medicalRecordFileUrl).toBe('https://cdn.petclinic.vn/records/milu-xquang-2026.jpg');
      expect(res.body.medicalRecords.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 2. PET STATUS (ACTIVE vs HIDDEN / Ẩn vs Hoạt động)
  // =========================================================================
  describe('2. Pet Status (ACTIVE vs HIDDEN / Ẩn vs Hoạt động)', () => {
    test('PATCH /api/v1/pets/:id/status updates status to HIDDEN and syncs isArchived = true', async () => {
      const existingPet = {
        _id: petId,
        name: 'Milu',
        status: 'ACTIVE',
        isArchived: false,
      };

      jest.spyOn(Pet, 'findById').mockResolvedValue(existingPet);
      jest.spyOn(Pet, 'findByIdAndUpdate').mockImplementation((id, update) => {
        return Promise.resolve({
          ...existingPet,
          ...update.$set,
        });
      });

      const res = await request(app)
        .patch(`/api/v1/pets/${petId}/status`)
        .set('Authorization', `Bearer ${customerAuthToken}`)
        .send({ status: 'HIDDEN' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('HIDDEN');
      expect(res.body.isArchived).toBe(true);
    });

    test('PATCH /api/v1/pets/:id/status updates status to ACTIVE and syncs isArchived = false', async () => {
      const existingPet = {
        _id: petId,
        name: 'Milu',
        status: 'HIDDEN',
        isArchived: true,
      };

      jest.spyOn(Pet, 'findById').mockResolvedValue(existingPet);
      jest.spyOn(Pet, 'findByIdAndUpdate').mockImplementation((id, update) => {
        return Promise.resolve({
          ...existingPet,
          ...update.$set,
        });
      });

      const res = await request(app)
        .patch(`/api/v1/pets/${petId}/status`)
        .set('Authorization', `Bearer ${customerAuthToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.isArchived).toBe(false);
    });

    test('GET /api/v1/pets filters pets by status query parameter', async () => {
      jest.spyOn(Customer, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: customerDocId, userId: customerUserId }),
      });

      const findSpy = jest.spyOn(Pet, 'find').mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          { _id: petId, name: 'Milu', status: 'ACTIVE', isArchived: false },
        ]),
      });

      const res = await request(app)
        .get('/api/v1/pets?status=ACTIVE')
        .set('Authorization', `Bearer ${customerAuthToken}`);

      expect(res.status).toBe(200);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ACTIVE',
        })
      );
    });
  });

  // =========================================================================
  // 3. GOOGLE OAUTH LOGIN & REGISTRATION RESILIENCE
  // =========================================================================
  describe('3. Google OAuth Login & Registration Resilience', () => {
    test('POST /api/v1/auth/google creates new Customer and returns tokens for mock Google token', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'google_customer_1@test.com',
        fullName: 'Google Customer One',
        googleId: 'mock_sub_001',
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        assignedBranchIds: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(User, 'create').mockResolvedValue(mockUser);
      jest.spyOn(Customer, 'findOneAndUpdate').mockResolvedValue({});
      jest.spyOn(RefreshSession, 'create').mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({
          credential: 'mock_google_token_1',
          email: 'google_customer_1@test.com',
          name: 'Google Customer One',
        });

      expect(res.status).toBe(200);
      const authData = res.body.data || res.body;
      expect(authData).toHaveProperty('accessToken');
      expect(authData.user.email).toBe('google_customer_1@test.com');
      expect(authData.user.systemRole).toBe('CUSTOMER');
    });

    test('POST /api/v1/auth/google-login route alias logs in existing Google user via token', async () => {
      const existingUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'google_customer_2@test.com',
        fullName: 'Google Customer Two',
        googleId: 'mock_sub_002',
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        assignedBranchIds: [],
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(existingUser);
      jest.spyOn(Customer, 'findOneAndUpdate').mockResolvedValue({});
      jest.spyOn(RefreshSession, 'create').mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/google-login')
        .send({
          token: 'mock_google_token_2',
          email: 'google_customer_2@test.com',
        });

      expect(res.status).toBe(200);
      const authData = res.body.data || res.body;
      expect(authData).toHaveProperty('accessToken');
      expect(authData.user.email).toBe('google_customer_2@test.com');
    });

    test('POST /api/v1/auth/google returns 400 when no token or email is provided', async () => {
      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.detail).toMatch(/required/i);
    });
  });

  // =========================================================================
  // 4. GUEST LOOKUP & OTP DISPATCH
  // =========================================================================
  describe('4. Guest Lookup OTP Dispatch & Verification', () => {
    test('POST /api/v1/guest/lookup/otp returns challengeId, expiresIn, and OTP in test mode', async () => {
      const res = await request(app)
        .post('/api/v1/guest/lookup/otp')
        .send({ phone: '0988776655' });

      expect([200, 202]).toContain(res.status);
      expect(res.body).toHaveProperty('challengeId');
      expect(res.body).toHaveProperty('expiresIn');
      expect(res.body).toHaveProperty('otp');
      expect(res.body.otp).toBe('123456');
    });

    test('POST /api/v1/guest/lookup/verify-otp verifies OTP and returns guest lookupToken', async () => {
      // First request OTP
      const reqRes = await guestService.requestGuestOtp({ phone: '0988112233' });
      expect(reqRes).toHaveProperty('challengeId');

      const res = await request(app)
        .post('/api/v1/guest/lookup/verify-otp')
        .send({
          challengeId: reqRes.challengeId,
          phone: '0988112233',
          otp: reqRes.otp || '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('lookupToken');
      expect(res.body).toHaveProperty('guestContactId');
    });

    test('supports alias POST /api/v1/guest/otp and /api/v1/guest/verify', async () => {
      const reqRes = await request(app)
        .post('/api/v1/guest/otp')
        .send({ email: 'guest_alias_test@example.com' });

      expect([200, 202]).toContain(reqRes.status);
      expect(reqRes.body).toHaveProperty('challengeId');

      const verRes = await request(app)
        .post('/api/v1/guest/verify')
        .send({
          challengeId: reqRes.body.challengeId,
          email: 'guest_alias_test@example.com',
          otp: reqRes.body.otp || '123456',
        });

      expect(verRes.status).toBe(200);
      expect(verRes.body).toHaveProperty('lookupToken');
    });
  });
});
