import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import config from '../../src/shared/config';
import IdempotencyKey from '../../src/modules/audit/models/IdempotencyKey';
import Appointment from '../../src/modules/booking/models/Appointment';
import ServiceRecord from '../../src/modules/execution/models/ServiceRecord';
import Service from '../../src/modules/catalog/models/Service';
import StaffProfile from '../../src/modules/staff/models/StaffProfile';
import RescuePet from '../../src/modules/content/models/RescuePet';
import AdoptionRequest from '../../src/modules/content/models/AdoptionRequest';
import Branch from '../../src/modules/branch/models/Branch';

const oid = () => new mongoose.Types.ObjectId().toString();

const BRANCH_Q1 = oid();
const BRANCH_Q7 = oid();
const BRANCH_DELETED = oid();

const IDS = {
  admin: oid(),
  managerQ1: oid(),
  managerMulti: oid(),
  receptionistQ1: oid(),
  vetUserA: oid(),
  vetProfileA: oid(),
  vetUserB: oid(),
  vetProfileB: oid(),
  nurseUserQ1: oid(),
  nurseProfileQ1: oid(),
  customer1: oid(),
};

const sign = (payload) => jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '1h' });

const TOKENS = {
  admin: sign({ id: IDS.admin, systemRole: 'ADMIN', assignedBranchIds: [], authorizedBranchIds: [] }),
  managerQ1: sign({
    id: IDS.managerQ1,
    systemRole: 'MANAGER',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
  managerMulti: sign({
    id: IDS.managerMulti,
    systemRole: 'MANAGER',
    assignedBranchIds: [BRANCH_Q1, BRANCH_Q7],
    authorizedBranchIds: [BRANCH_Q1, BRANCH_Q7],
  }),
  receptionistQ1: sign({
    id: IDS.receptionistQ1,
    systemRole: 'STAFF',
    staffSubRole: 'RECEPTIONIST',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
  vetA: sign({
    id: IDS.vetUserA,
    systemRole: 'STAFF',
    staffSubRole: 'VETERINARIAN',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
  vetB: sign({
    id: IDS.vetUserB,
    systemRole: 'STAFF',
    staffSubRole: 'VETERINARIAN',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
  nurseQ1: sign({
    id: IDS.nurseUserQ1,
    systemRole: 'STAFF',
    staffSubRole: 'NURSE',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
};

const mockChain = (rows, single = null) => ({
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(single !== null ? single : rows),
  exec: jest.fn().mockResolvedValue(single !== null ? single : rows),
  then: (resolve, reject) => Promise.resolve(single !== null ? single : rows).then(resolve, reject),
});

describe('WEB2 BE-01 & BE-02 Validation Suite (Appointment /start & Rescue Pet Branch Scope)', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // BE-01: POST /api/v1/appointments/:id/start (Scenarios A1 - A6 + Edge Cases)
  // =========================================================================
  describe('BE-01: Appointment /start & check-in validation (A1 - A6)', () => {
    const buildMockAppointment = (overrides = {}) => {
      const aptId = overrides._id || oid();
      const serviceId = overrides.serviceId || oid();
      const doc = {
        _id: aptId,
        code: 'APT-20261116-0001',
        branchId: { _id: BRANCH_Q1, toString: () => BRANCH_Q1 },
        customerId: IDS.customer1,
        status: 'CONFIRMED',
        checkInStatus: 'ARRIVED',
        version: 1,
        services: [
          {
            serviceId,
            serviceName: 'Khám lâm sàng tổng quát',
            serviceType: 'MEDICAL',
            requiredStaffRole: 'VETERINARIAN',
            assignedStaffId: IDS.vetProfileA,
            sequence: 1,
            executionStatus: 'NOT_STARTED',
            executionStartedAt: null,
          },
        ],
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
        ...overrides,
      };
      return { aptId, serviceId, doc };
    };

    it('A1: Rejects /start with 422 STAFF_UNAVAILABLE when segment has no assignedStaffId (no mutation or side effects)', async () => {
      const { aptId, serviceId, doc } = buildMockAppointment();
      doc.services[0].assignedStaffId = null;

      jest.spyOn(Appointment, 'findById').mockImplementation(() => mockChain([], doc));
      const srCreateSpy = jest.spyOn(ServiceRecord, 'create').mockResolvedValue({});

      const res = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('STAFF_UNAVAILABLE');
      expect(doc.status).toBe('CONFIRMED');
      expect(doc.services[0].executionStatus).toBe('NOT_STARTED');
      expect(doc.save).not.toHaveBeenCalled();
      expect(srCreateSpy).not.toHaveBeenCalled();
    });

    it('A2: Rejects /start with 422 when assignedStaffId is deleted, INACTIVE, role-changed, or transferred branch', async () => {
      const { aptId, serviceId, doc } = buildMockAppointment();
      jest.spyOn(Appointment, 'findById').mockImplementation(() => mockChain([], doc));
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() => mockChain([], null));
      const srCreateSpy = jest.spyOn(ServiceRecord, 'create').mockResolvedValue({});

      // Case A2a: Assigned staff profile no longer exists
      const findByIdSpy = jest.spyOn(StaffProfile, 'findById').mockResolvedValue(null);
      const resDeleted = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });
      expect(resDeleted.status).toBe(422);
      expect(resDeleted.body.code).toBe('STAFF_UNAVAILABLE');

      // Case A2b: Assigned staff profile is INACTIVE
      findByIdSpy.mockResolvedValue({
        _id: IDS.vetProfileA,
        userId: IDS.vetUserA,
        status: 'INACTIVE',
        staffSubRole: 'VETERINARIAN',
        authorizedBranchIds: [BRANCH_Q1],
      });
      const resInactive = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });
      expect(resInactive.status).toBe(422);
      expect(resInactive.body.code).toBe('STAFF_UNAVAILABLE');

      // Case A2c: Assigned staff profile role changed to NURSE
      findByIdSpy.mockResolvedValue({
        _id: IDS.vetProfileA,
        userId: IDS.vetUserA,
        status: 'ACTIVE',
        staffSubRole: 'NURSE',
        authorizedBranchIds: [BRANCH_Q1],
      });
      const resRoleMismatch = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });
      expect(resRoleMismatch.status).toBe(422);
      expect(resRoleMismatch.body.code).toBe('STAFF_ROLE_MISMATCH');

      // Case A2d: Assigned staff transferred away to BRANCH_Q7
      findByIdSpy.mockResolvedValue({
        _id: IDS.vetProfileA,
        userId: IDS.vetUserA,
        status: 'ACTIVE',
        staffSubRole: 'VETERINARIAN',
        authorizedBranchIds: [BRANCH_Q7],
        homeBranchId: BRANCH_Q7,
      });
      const resBranchChanged = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });
      expect(resBranchChanged.status).toBe(422);
      expect(resBranchChanged.body.code).toBe('ASSIGNMENT_SCOPE_ERROR');

      expect(doc.save).not.toHaveBeenCalled();
      expect(srCreateSpy).not.toHaveBeenCalled();
    });

    it('A3: Rejects /start with 403 ASSIGNMENT_SCOPE_ERROR when another clinical staff of same sub-role calls /start', async () => {
      const { aptId, serviceId, doc } = buildMockAppointment();
      jest.spyOn(Appointment, 'findById').mockImplementation(() => mockChain([], doc));
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue({
        _id: IDS.vetProfileA,
        userId: IDS.vetUserA,
        status: 'ACTIVE',
        staffSubRole: 'VETERINARIAN',
        authorizedBranchIds: [BRANCH_Q1],
      });
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() =>
        mockChain([], {
          _id: IDS.vetProfileB,
          userId: IDS.vetUserB,
          status: 'ACTIVE',
          staffSubRole: 'VETERINARIAN',
          authorizedBranchIds: [BRANCH_Q1],
        })
      );

      const res = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetB}`)
        .send({ serviceId, expectedVersion: 1 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ASSIGNMENT_SCOPE_ERROR');
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('A4: Rejects /start with 403 AUTHORIZATION_ERROR when Admin, Manager, Receptionist, or wrong sub-role calls /start', async () => {
      const { aptId, serviceId, doc } = buildMockAppointment();
      jest.spyOn(Appointment, 'findById').mockImplementation(() => mockChain([], doc));

      for (const tokenKey of ['admin', 'managerQ1', 'receptionistQ1', 'nurseQ1']) {
        const res = await request(app)
          .post(`/api/v1/appointments/${aptId}/start`)
          .set('X-Forwarded-For', '10.20.30.40')
          .set('Authorization', `Bearer ${TOKENS[tokenKey]}`)
          .send({ serviceId, expectedVersion: 1 });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('AUTHORIZATION_ERROR');
      }
      expect(doc.save).not.toHaveBeenCalled();
    });

    it('A5: Rejects /start with 409 INVALID_STATE_TRANSITION when appointment is not checked in (PENDING) or in invalid state', async () => {
      const { aptId, serviceId, doc } = buildMockAppointment({ checkInStatus: 'PENDING' });
      jest.spyOn(Appointment, 'findById').mockImplementation(() => mockChain([], doc));
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue({
        _id: IDS.vetProfileA,
        userId: IDS.vetUserA,
        status: 'ACTIVE',
        staffSubRole: 'VETERINARIAN',
        authorizedBranchIds: [BRANCH_Q1],
      });
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() =>
        mockChain([], {
          _id: IDS.vetProfileA,
          userId: IDS.vetUserA,
          status: 'ACTIVE',
          staffSubRole: 'VETERINARIAN',
          authorizedBranchIds: [BRANCH_Q1],
        })
      );

      // Not checked in yet
      const resNotArrived = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });
      expect(resNotArrived.status).toBe(409);
      expect(resNotArrived.body.code).toBe('INVALID_STATE_TRANSITION');

      // Checked in, but appointment status is PENDING_CONFIRMATION or CANCELLED
      doc.checkInStatus = 'ARRIVED';
      doc.status = 'PENDING_CONFIRMATION';
      const resUnconfirmed = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });
      expect(resUnconfirmed.status).toBe(409);
      expect(resUnconfirmed.body.code).toBe('INVALID_STATE_TRANSITION');

      // Segment already IN_PROGRESS
      doc.status = 'IN_PROGRESS';
      doc.services[0].executionStatus = 'IN_PROGRESS';
      const resAlreadyStarted = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });
      expect(resAlreadyStarted.status).toBe(409);
      expect(resAlreadyStarted.body.code).toBe('INVALID_STATE_TRANSITION');

      expect(doc.save).not.toHaveBeenCalled();
    });

    it('A6: Allows /start with 200 when assigned clinical staff starts a CONFIRMED + ARRIVED appointment and creates ServiceRecord', async () => {
      const { aptId, serviceId, doc } = buildMockAppointment();
      jest.spyOn(Appointment, 'findById').mockImplementation(() => mockChain([], doc));
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue({
        _id: IDS.vetProfileA,
        userId: IDS.vetUserA,
        status: 'ACTIVE',
        staffSubRole: 'VETERINARIAN',
        authorizedBranchIds: [BRANCH_Q1],
      });
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() =>
        mockChain([], {
          _id: IDS.vetProfileA,
          userId: IDS.vetUserA,
          status: 'ACTIVE',
          staffSubRole: 'VETERINARIAN',
          authorizedBranchIds: [BRANCH_Q1],
        })
      );
      jest.spyOn(ServiceRecord, 'findOne').mockResolvedValue(null);
      jest.spyOn(Service, 'find').mockResolvedValue([]);
      jest.spyOn(ServiceRecord, 'countDocuments').mockResolvedValue(0);
      const srCreateSpy = jest.spyOn(ServiceRecord, 'create').mockResolvedValue({});

      const res = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId, expectedVersion: 1 });

      expect(res.status).toBe(200);
      expect(doc.status).toBe('IN_PROGRESS');
      expect(doc.services[0].executionStatus).toBe('IN_PROGRESS');
      expect(doc.services[0].executionStartedAt).toBeInstanceOf(Date);
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(srCreateSpy).toHaveBeenCalledTimes(1);
    });

    it('Enforces multi-service serviceId requirement, sequence order, and expectedVersion concurrency check', async () => {
      const s1 = oid();
      const s2 = oid();
      const { aptId, doc } = buildMockAppointment({
        version: 2,
        services: [
          {
            serviceId: s1,
            serviceName: 'Khám tổng quát',
            serviceType: 'MEDICAL',
            requiredStaffRole: 'VETERINARIAN',
            assignedStaffId: IDS.vetProfileA,
            sequence: 1,
            executionStatus: 'NOT_STARTED',
          },
          {
            serviceId: s2,
            serviceName: 'Siêu âm ổ bụng',
            serviceType: 'MEDICAL',
            requiredStaffRole: 'VETERINARIAN',
            assignedStaffId: IDS.vetProfileA,
            sequence: 2,
            executionStatus: 'NOT_STARTED',
          },
        ],
      });

      jest.spyOn(Appointment, 'findById').mockImplementation(() => mockChain([], doc));
      jest.spyOn(StaffProfile, 'findById').mockResolvedValue({
        _id: IDS.vetProfileA,
        userId: IDS.vetUserA,
        status: 'ACTIVE',
        staffSubRole: 'VETERINARIAN',
        authorizedBranchIds: [BRANCH_Q1],
      });
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() =>
        mockChain([], {
          _id: IDS.vetProfileA,
          userId: IDS.vetUserA,
          status: 'ACTIVE',
          staffSubRole: 'VETERINARIAN',
          authorizedBranchIds: [BRANCH_Q1],
        })
      );

      // Missing serviceId on multi-service appointment -> 400
      const resMissingSvc = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ expectedVersion: 2 });
      expect(resMissingSvc.status).toBe(400);
      expect(resMissingSvc.body.code).toBe('VALIDATION_ERROR');

      // Stale expectedVersion -> 409 CONCURRENCY_CONFLICT
      const resVersionConflict = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId: s1, expectedVersion: 1 });
      expect(resVersionConflict.status).toBe(409);
      expect(resVersionConflict.body.code).toBe('CONCURRENCY_CONFLICT');

      // Starting sequence 2 before sequence 1 is COMPLETED -> 409 INVALID_STATE_TRANSITION
      const resOutOfOrder = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.vetA}`)
        .send({ serviceId: s2, expectedVersion: 2 });
      expect(resOutOfOrder.status).toBe(409);
      expect(resOutOfOrder.body.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('Enforces check-in state rules and prevents direct POST /service-records bypass of BE-01', async () => {
      const { aptId, doc } = buildMockAppointment({
        status: 'PENDING_CONFIRMATION',
        checkInStatus: 'PENDING',
      });
      jest.spyOn(Appointment, 'findById').mockImplementation(() => mockChain([], doc));

      // Cannot check-in an unconfirmed appointment
      const resBadCheckIn = await request(app)
        .post(`/api/v1/appointments/${aptId}/check-in`)
        .set('Authorization', `Bearer ${TOKENS.receptionistQ1}`)
        .send({});
      expect(resBadCheckIn.status).toBe(409);
      expect(resBadCheckIn.body.code).toBe('INVALID_STATE_TRANSITION');

      // Cannot bypass /start via POST /api/v1/service-records when not checked in or not assigned
      doc.status = 'CONFIRMED';
      doc.checkInStatus = 'PENDING';
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() => mockChain([], { _id: IDS.vetProfileB }));

      const resBypassUnassigned = await request(app)
        .post('/api/v1/service-records')
        .set('Authorization', `Bearer ${TOKENS.vetB}`)
        .set('Idempotency-Key', 'idem-sr-bypass-1')
        .send({ appointmentId: aptId });
      expect(resBypassUnassigned.status).toBe(403);
      expect(resBypassUnassigned.body.code).toBe('ASSIGNMENT_SCOPE_ERROR');
    });
  });

  // =========================================================================
  // BE-02: POST /api/v1/admin/rescue/pets (Scenarios R1 - R5 + Edge Cases)
  // =========================================================================
  describe('BE-02: Manager branchId validation on Rescue Pets (R1 - R5)', () => {
    const validRescuePayload = {
      petName: 'Bé Cún Bông',
      species: 'DOG',
      healthStatus: 'Khỏe mạnh, đã tiêm ngừa',
      rescueStory: 'Được cứu hộ tại Quận 1',
      images: ['https://cdn.drpets.vn/rescue/cun-bong.jpg'],
    };

    beforeEach(() => {
      jest.spyOn(Branch, 'findById').mockImplementation(async (id) => {
        const strId = id?.toString();
        if (strId === BRANCH_Q1) return { _id: BRANCH_Q1, name: 'Chi nhánh Quận 1', status: 'ACTIVE' };
        if (strId === BRANCH_Q7) return { _id: BRANCH_Q7, name: 'Chi nhánh Quận 7', status: 'ACTIVE' };
        return null;
      });
      jest.spyOn(RescuePet, 'countDocuments').mockResolvedValue(10);
    });

    it('R1: Rejects with 400 VALIDATION_ERROR when Manager omits branchId or sends null/empty/whitespace', async () => {
      const createSpy = jest.spyOn(RescuePet, 'create').mockResolvedValue({});

      for (const badBranchId of [undefined, null, '', '   ']) {
        const payload = { ...validRescuePayload };
        if (badBranchId !== undefined) payload.branchId = badBranchId;

        const res = await request(app)
          .post('/api/v1/admin/rescue/pets')
          .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
          .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
      }

      // Invalid ObjectId format -> 400 VALIDATION_ERROR
      const resMalformed = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ ...validRescuePayload, branchId: 'not-an-object-id' });
      expect(resMalformed.status).toBe(400);
      expect(resMalformed.body.code).toBe('VALIDATION_ERROR');

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('R2: Rejects when branchId does not exist in DB (403 Fail-Closed if outside Manager scope, 404 NOT_FOUND if in scope or Admin)', async () => {
      const createSpy = jest.spyOn(RescuePet, 'create').mockResolvedValue({});

      // Case R2a: Manager sends random non-existent ObjectId outside assignedBranchIds -> 403 BRANCH_SCOPE_ERROR (Fail-Closed)
      const resManagerRandom = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ ...validRescuePayload, branchId: BRANCH_DELETED });
      expect(resManagerRandom.status).toBe(403);
      expect(resManagerRandom.body.code).toBe('BRANCH_SCOPE_ERROR');

      // Case R2b: Manager has BRANCH_DELETED in token/assignedBranchIds, but Branch doc does not exist in DB -> 404 NOT_FOUND
      const managerStaleBranchToken = sign({
        id: oid(),
        systemRole: 'MANAGER',
        assignedBranchIds: [BRANCH_DELETED],
        authorizedBranchIds: [BRANCH_DELETED],
      });
      const resManagerDeletedBranch = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${managerStaleBranchToken}`)
        .send({ ...validRescuePayload, branchId: BRANCH_DELETED });
      expect(resManagerDeletedBranch.status).toBe(404);
      expect(resManagerDeletedBranch.body.code).toBe('NOT_FOUND');

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('R3: Rejects with 403 BRANCH_SCOPE_ERROR when Manager sends branchId belonging to another branch', async () => {
      const createSpy = jest.spyOn(RescuePet, 'create').mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ ...validRescuePayload, branchId: BRANCH_Q7 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('BRANCH_SCOPE_ERROR');
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('R4: Allows single-branch Manager to create RescuePet with their assigned branchId and saves exact branchId', async () => {
      const createdId = oid();
      const createSpy = jest
        .spyOn(RescuePet, 'create')
        .mockImplementation(async (doc) => ({ _id: createdId, ...doc }));

      const res = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ ...validRescuePayload, branchId: BRANCH_Q1 });

      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(createSpy.mock.calls[0][0].branchId).toBe(BRANCH_Q1);
      expect(res.body.data.branchId).toBe(BRANCH_Q1);
    });

    it('R5: Allows multi-branch Manager to create RescuePets for any branch within their assignedBranchIds', async () => {
      const createSpy = jest
        .spyOn(RescuePet, 'create')
        .mockImplementation(async (doc) => ({ _id: oid(), ...doc }));

      const resQ1 = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerMulti}`)
        .send({ ...validRescuePayload, branchId: BRANCH_Q1 });
      expect(resQ1.status).toBe(201);
      expect(resQ1.body.data.branchId).toBe(BRANCH_Q1);

      const resQ7 = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerMulti}`)
        .send({ ...validRescuePayload, branchId: BRANCH_Q7 });
      expect(resQ7.status).toBe(201);
      expect(resQ7.body.data.branchId).toBe(BRANCH_Q7);

      expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it('Preserves Admin ability to create partner RescuePet without branchId, and blocks Manager from clearing branchId or mutating global RescuePets', async () => {
      const globalPetId = oid();
      const q1PetId = oid();
      jest.spyOn(RescuePet, 'create').mockImplementation(async (doc) => ({ _id: globalPetId, ...doc }));

      // Admin can create without branchId (PARTNER_MAINTAINED)
      const adminRes = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.admin}`)
        .send(validRescuePayload);
      expect(adminRes.status).toBe(201);
      expect(adminRes.body.data.branchId).toBeNull();

      // Manager cannot PATCH/DELETE a global RescuePet (branchId: null) or clear branchId on their own RescuePet
      jest.spyOn(RescuePet, 'findOne').mockImplementation((q) => {
        const idMatch = q?.$or?.find((c) => c._id)?._id;
        if (idMatch === globalPetId) {
          return mockChain([], { _id: globalPetId, petName: 'Global Pet', branchId: null, save: jest.fn() });
        }
        if (idMatch === q1PetId) {
          return mockChain([], { _id: q1PetId, petName: 'Q1 Pet', branchId: BRANCH_Q1, save: jest.fn() });
        }
        return mockChain([], null);
      });

      const mgrPatchGlobal = await request(app)
        .patch(`/api/v1/admin/rescue/pets/${globalPetId}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ petName: 'Hijacked' });
      expect(mgrPatchGlobal.status).toBe(403);
      expect(mgrPatchGlobal.body.code).toBe('BRANCH_SCOPE_ERROR');

      const mgrClearBranch = await request(app)
        .patch(`/api/v1/admin/rescue/pets/${q1PetId}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ branchId: '' });
      expect(mgrClearBranch.status).toBe(400);
      expect(mgrClearBranch.body.code).toBe('VALIDATION_ERROR');

      // Manager cannot review adoption request of a global RescuePet (branchId: null)
      const globalAdoptionId = oid();
      jest.spyOn(AdoptionRequest, 'findById').mockResolvedValue({
        _id: globalAdoptionId,
        rescuePetId: globalPetId,
        status: 'PENDING',
        save: jest.fn(),
      });
      jest.spyOn(RescuePet, 'findById').mockImplementation(() => mockChain([], { _id: globalPetId, branchId: null }));

      const mgrReviewGlobal = await request(app)
        .patch(`/api/v1/admin/rescue/requests/${globalAdoptionId}/review`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ status: 'APPROVED' });
      expect(mgrReviewGlobal.status).toBe(403);
      expect(mgrReviewGlobal.body.code).toBe('BRANCH_SCOPE_ERROR');
    });

    it('Restricts GET /admin/rescue/pets and GET /admin/rescue/pets/:id to Manager assignedBranchIds and blocks branchId: null', async () => {
      const globalPetId = oid();
      const q1PetId = oid();
      const q7PetId = oid();

      const countSpy = jest.spyOn(RescuePet, 'countDocuments').mockResolvedValue(1);
      const findSpy = jest.spyOn(RescuePet, 'find').mockImplementation(() =>
        mockChain([], [{ _id: q1PetId, petCode: 'RES-0001', petName: 'Q1 Pet', branchId: { _id: BRANCH_Q1, name: 'Q1' } }])
      );

      // 1. Manager list must filter strictly by assignedBranchIds, never { branchId: null }
      const mgrListRes = await request(app)
        .get('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);

      expect(mgrListRes.status).toBe(200);
      expect(mgrListRes.body.data.items).toHaveLength(1);
      const mgrListQuery = findSpy.mock.calls[0][0];
      expect(mgrListQuery).toEqual({ branchId: { $in: [BRANCH_Q1] } });
      expect(mgrListQuery.$or).toBeUndefined();
      expect(countSpy).toHaveBeenCalledWith({ branchId: { $in: [BRANCH_Q1] } });

      // Admin list remains system-wide when no branchId filter specified
      const adminListRes = await request(app)
        .get('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.admin}`);
      expect(adminListRes.status).toBe(200);
      expect(findSpy.mock.calls[1][0]).toEqual({});

      // 2. Detail GET /admin/rescue/pets/:id: Manager blocked on branchId: null & other branch; allowed on assigned branch
      jest.spyOn(RescuePet, 'findOne').mockImplementation((q) => {
        const idMatch = q?.$or?.find((c) => c._id)?._id;
        if (idMatch === globalPetId) {
          return mockChain([], { _id: globalPetId, petCode: 'RES-GLB', petName: 'Global Pet', branchId: null });
        }
        if (idMatch === q7PetId) {
          return mockChain([], { _id: q7PetId, petCode: 'RES-Q7', petName: 'Q7 Pet', branchId: { _id: BRANCH_Q7, name: 'Q7' } });
        }
        if (idMatch === q1PetId) {
          return mockChain([], { _id: q1PetId, petCode: 'RES-Q1', petName: 'Q1 Pet', branchId: { _id: BRANCH_Q1, name: 'Q1' } });
        }
        return mockChain([], null);
      });

      const mgrGlobalDetail = await request(app)
        .get(`/api/v1/admin/rescue/pets/${globalPetId}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(mgrGlobalDetail.status).toBe(403);
      expect(mgrGlobalDetail.body.code).toBe('BRANCH_SCOPE_ERROR');

      const mgrOtherBranchDetail = await request(app)
        .get(`/api/v1/admin/rescue/pets/${q7PetId}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(mgrOtherBranchDetail.status).toBe(403);
      expect(mgrOtherBranchDetail.body.code).toBe('BRANCH_SCOPE_ERROR');

      const mgrOwnDetail = await request(app)
        .get(`/api/v1/admin/rescue/pets/${q1PetId}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(mgrOwnDetail.status).toBe(200);
      expect(mgrOwnDetail.body.data.petName).toBe('Q1 Pet');

      const adminGlobalDetail = await request(app)
        .get(`/api/v1/admin/rescue/pets/${globalPetId}`)
        .set('Authorization', `Bearer ${TOKENS.admin}`);
      expect(adminGlobalDetail.status).toBe(200);
      expect(adminGlobalDetail.body.data.petName).toBe('Global Pet');
    });
  });
});

