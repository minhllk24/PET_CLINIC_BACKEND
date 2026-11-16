import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import config from '../../src/shared/config';
import IdempotencyKey from '../../src/modules/audit/models/IdempotencyKey';
import User from '../../src/models/User';
import Voucher from '../../src/modules/order/models/Voucher';
import FlashSale from '../../src/modules/flash-sale/models/FlashSale';
import Post from '../../src/modules/content/models/Post';
import CommunityPost from '../../src/modules/content/models/CommunityPost';
import RescuePet from '../../src/modules/content/models/RescuePet';
import AdoptionRequest from '../../src/modules/content/models/AdoptionRequest';
import Order from '../../src/modules/order/models/Order';
import OrderReturn from '../../src/modules/order/models/OrderReturn';
import BookingRefund from '../../src/modules/payment/models/BookingRefund';
import Appointment from '../../src/modules/booking/models/Appointment';
import ServiceRecord from '../../src/modules/execution/models/ServiceRecord';
import ServiceRecordRevision from '../../src/modules/execution/models/ServiceRecordRevision';
import Customer from '../../src/modules/customer/models/Customer';
import InventoryTransaction from '../../src/modules/inventory/models/InventoryTransaction';
import StaffProfile from '../../src/modules/staff/models/StaffProfile';
import Shift from '../../src/modules/staff/models/Shift';

const oid = () => new mongoose.Types.ObjectId().toString();

const BRANCH_Q1 = oid();
const BRANCH_Q7 = oid();

const IDS = {
  admin: oid(),
  managerQ1: oid(),
  receptionistQ1: oid(),
  vetQ1: oid(),
  vetProfileQ1: oid(),
  nurseQ1: oid(),
  groomerQ1: oid(),
  customer1: oid(),
  customer2: oid(),
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
  receptionistQ1: sign({
    id: IDS.receptionistQ1,
    systemRole: 'STAFF',
    staffSubRole: 'RECEPTIONIST',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
  vetQ1: sign({
    id: IDS.vetQ1,
    systemRole: 'STAFF',
    staffSubRole: 'VETERINARIAN',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
  nurseQ1: sign({
    id: IDS.nurseQ1,
    systemRole: 'STAFF',
    staffSubRole: 'NURSE',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
  groomerQ1: sign({
    id: IDS.groomerQ1,
    systemRole: 'STAFF',
    staffSubRole: 'CARE_STAFF_GROOMER',
    assignedBranchIds: [BRANCH_Q1],
    authorizedBranchIds: [BRANCH_Q1],
  }),
  customer1: sign({ id: IDS.customer1, systemRole: 'CUSTOMER' }),
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

describe('WEB2 RBAC Fixed Roles Matrix & Branch/SubRole Enforcement', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // G1: Voucher Read-Only for STAFF + Write Forbidden
  // =========================================================================
  describe('G1: Voucher RBAC (STAFF read-only, ADMIN write)', () => {
    it('allows ADMIN, MANAGER, and all 4 STAFF subroles to GET /vouchers and /vouchers/:id; denies CUSTOMER & Guest', async () => {
      const voucherId = oid();
      const voucherDoc = {
        _id: voucherId,
        code: 'WELCOME50',
        name: 'Welcome 50k',
        discountType: 'FIXED',
        discountValue: 50000,
        scope: 'ALL',
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveTo: new Date('2026-12-31T23:59:59Z'),
        quota: 100,
        usedCount: 0,
        status: 'ACTIVE',
      };
      jest.spyOn(Voucher, 'find').mockImplementation(() => mockChain([voucherDoc]));
      jest.spyOn(Voucher, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(Voucher, 'findById').mockImplementation(() => mockChain([], voucherDoc));

      for (const roleKey of ['admin', 'managerQ1', 'receptionistQ1', 'vetQ1', 'nurseQ1', 'groomerQ1']) {
        const listRes = await request(app).get('/api/v1/vouchers').set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(listRes.status).toBe(200);

        const detailRes = await request(app)
          .get(`/api/v1/vouchers/${voucherId}`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(detailRes.status).toBe(200);
      }

      const custRes = await request(app).get('/api/v1/vouchers').set('Authorization', `Bearer ${TOKENS.customer1}`);
      expect(custRes.status).toBe(403);

      const guestRes = await request(app).get('/api/v1/vouchers');
      expect(guestRes.status).toBe(401);
    });

    it('denies STAFF and MANAGER on POST /vouchers and PATCH /vouchers/:id with 403', async () => {
      const voucherId = oid();
      for (const roleKey of ['managerQ1', 'receptionistQ1', 'vetQ1', 'nurseQ1', 'groomerQ1']) {
        const createRes = await request(app)
          .post('/api/v1/vouchers')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .set('Idempotency-Key', `idem-v-${roleKey}`)
          .send({
            code: 'TEST10',
            name: 'Test 10%',
            discountType: 'PERCENTAGE',
            discountValue: 10,
            scope: 'ORDER',
            effectiveFrom: '2026-11-01T00:00:00.000Z',
            effectiveTo: '2026-12-31T23:59:59.000Z',
            quota: 50,
          });
        expect(createRes.status).toBe(403);

        const patchRes = await request(app)
          .patch(`/api/v1/vouchers/${voucherId}`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .send({
            code: 'TEST10',
            name: 'Updated',
            discountType: 'PERCENTAGE',
            discountValue: 10,
            scope: 'ORDER',
            effectiveFrom: '2026-11-01T00:00:00.000Z',
            effectiveTo: '2026-12-31T23:59:59.000Z',
            quota: 50,
          });
        expect(patchRes.status).toBe(403);
      }
    });
  });

  // =========================================================================
  // G2: Flash Sale Read-Only for STAFF + Write Forbidden
  // =========================================================================
  describe('G2: Flash Sale RBAC (STAFF read-only, ADMIN write/publish/pause)', () => {
    it('allows STAFF (all subroles), MANAGER, and ADMIN to GET /flash-sales & /:id; blocks write/publish/pause with 403', async () => {
      const fsId = oid();
      const saleDoc = { _id: fsId, name: 'Weekend Sale', status: 'PUBLISHED', items: [] };
      jest.spyOn(FlashSale, 'find').mockImplementation(() => mockChain([saleDoc]));
      jest.spyOn(FlashSale, 'countDocuments').mockResolvedValue(1);
      jest.spyOn(FlashSale, 'findById').mockImplementation(() => mockChain([], saleDoc));

      for (const roleKey of ['admin', 'managerQ1', 'receptionistQ1', 'vetQ1', 'nurseQ1', 'groomerQ1']) {
        const res = await request(app).get('/api/v1/flash-sales').set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(res.status).toBe(200);

        const detail = await request(app)
          .get(`/api/v1/flash-sales/${fsId}`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(detail.status).toBe(200);
      }

      const cust = await request(app).get('/api/v1/flash-sales').set('Authorization', `Bearer ${TOKENS.customer1}`);
      expect(cust.status).toBe(403);

      for (const roleKey of ['managerQ1', 'receptionistQ1', 'vetQ1']) {
        const postRes = await request(app)
          .post('/api/v1/flash-sales')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .send({ name: 'Blocked' });
        expect(postRes.status).toBe(403);

        const pubRes = await request(app)
          .post(`/api/v1/flash-sales/${fsId}/publish`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(pubRes.status).toBe(403);

        const pauseRes = await request(app)
          .post(`/api/v1/flash-sales/${fsId}/pause`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(pauseRes.status).toBe(403);
      }
    });
  });

  // =========================================================================
  // G3, G4, G5: Admin Content Management for MANAGER + RescuePet Branch Scope
  // =========================================================================
  describe('G3-G5: Admin Content (Blog/FirstAid, Community, Rescue Branch Scope)', () => {
    it('allows MANAGER CRUD/Delete on /admin/content/posts and blocks STAFF', async () => {
      const postId = oid();
      jest.spyOn(Post, 'findOne').mockResolvedValue(null);
      jest.spyOn(Post, 'create').mockResolvedValue({
        _id: postId,
        title: 'Dog First Aid',
        slug: 'dog-first-aid',
        type: 'FIRST_AID',
        status: 'DRAFT',
      });
      jest.spyOn(Post, 'findById').mockImplementation(() =>
        mockChain([], {
          _id: postId,
          title: 'Dog First Aid',
          status: 'DRAFT',
          save: jest.fn().mockResolvedValue(true),
        })
      );
      jest.spyOn(Post, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(Post, 'findByIdAndDelete').mockResolvedValue({ _id: postId });

      const createRes = await request(app)
        .post('/api/v1/admin/posts')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ title: 'Dog First Aid', category: 'FIRST_AID', type: 'FIRST_AID', content: 'Keep calm and check breathing.' });
      expect(createRes.status).toBe(201);

      const patchRes = await request(app)
        .patch(`/api/v1/admin/posts/${postId}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ title: 'Updated Guide' });
      expect(patchRes.status).toBe(200);

      const delRes = await request(app)
        .delete(`/api/v1/admin/posts/${postId}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(delRes.status).toBe(200);

      const staffRes = await request(app)
        .post('/api/v1/admin/posts')
        .set('Authorization', `Bearer ${TOKENS.receptionistQ1}`)
        .send({ title: 'Denied', category: 'BLOG', type: 'BLOG', content: 'No' });
      expect(staffRes.status).toBe(403);
    });

    it('allows MANAGER to DELETE approved /api/v1/admin/community/posts/:id; blocks STAFF', async () => {
      const cpId = oid();
      jest.spyOn(CommunityPost, 'findById').mockResolvedValue({ _id: cpId, status: 'APPROVED' });
      jest.spyOn(CommunityPost, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(CommunityPost, 'findByIdAndDelete').mockResolvedValue({ _id: cpId });

      const mgrRes = await request(app)
        .delete(`/api/v1/admin/community/posts/${cpId}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(mgrRes.status).toBe(200);

      const staffRes = await request(app)
        .delete(`/api/v1/admin/community/posts/${cpId}`)
        .set('Authorization', `Bearer ${TOKENS.vetQ1}`);
      expect(staffRes.status).toBe(403);
    });

    it('enforces assignedBranchIds scope for MANAGER on RescuePet create/delete & adoptions review', async () => {
      const petQ1Id = oid();
      const petQ7Id = oid();
      const adoptionQ7Id = oid();

      jest.spyOn(RescuePet, 'create').mockImplementation(async (doc) => ({ _id: petQ1Id, ...doc }));
      jest.spyOn(RescuePet, 'findOne').mockImplementation((q) => {
        const idMatch = q?.$or?.find((c) => c._id)?._id;
        if (idMatch === petQ1Id) return mockChain([], { _id: petQ1Id, petName: 'Milo', branchId: BRANCH_Q1 });
        if (idMatch === petQ7Id) return mockChain([], { _id: petQ7Id, petName: 'Luna', branchId: BRANCH_Q7 });
        return mockChain([], null);
      });
      jest.spyOn(RescuePet, 'findById').mockImplementation((id) => {
        if (id === petQ1Id) return mockChain([], { _id: petQ1Id, petName: 'Milo', branchId: BRANCH_Q1 });
        if (id === petQ7Id) return mockChain([], { _id: petQ7Id, petName: 'Luna', branchId: BRANCH_Q7 });
        return mockChain([], null);
      });
      jest.spyOn(RescuePet, 'countDocuments').mockResolvedValue(5);
      jest.spyOn(RescuePet, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
      jest.spyOn(RescuePet, 'findByIdAndDelete').mockResolvedValue({ _id: petQ1Id });
      jest.spyOn(AdoptionRequest, 'findById').mockResolvedValue({
        _id: adoptionQ7Id,
        rescuePetId: petQ7Id,
        status: 'PENDING',
        save: jest.fn(),
      });

      const okCreate = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({
          petName: 'Milo',
          species: 'DOG',
          healthStatus: 'HEALTHY',
          rescueStory: 'Rescued in Q1',
          images: ['https://example.com/milo.jpg'],
          branchId: BRANCH_Q1,
        });
      expect(okCreate.status).toBe(201);

      const deniedCreate = await request(app)
        .post('/api/v1/admin/rescue/pets')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({
          petName: 'Luna',
          species: 'CAT',
          healthStatus: 'HEALTHY',
          rescueStory: 'Rescued in Q7',
          images: ['https://example.com/luna.jpg'],
          branchId: BRANCH_Q7,
        });
      expect(deniedCreate.status).toBe(403);
      expect(deniedCreate.body.code).toBe('BRANCH_SCOPE_ERROR');

      const okDel = await request(app)
        .delete(`/api/v1/admin/rescue/pets/${petQ1Id}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(okDel.status).toBe(200);

      const deniedDel = await request(app)
        .delete(`/api/v1/admin/rescue/pets/${petQ7Id}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(deniedDel.status).toBe(403);
      expect(deniedDel.body.code).toBe('BRANCH_SCOPE_ERROR');

      const deniedAdoption = await request(app)
        .patch(`/api/v1/admin/rescue/requests/${adoptionQ7Id}/review`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .send({ status: 'APPROVED' });
      expect(deniedAdoption.status).toBe(403);
      expect(deniedAdoption.body.code).toBe('BRANCH_SCOPE_ERROR');
    });
  });

  // =========================================================================
  // B1 & B2: SubRole Isolation on Orders, Returns, BookingRefunds, Inventory
  // =========================================================================
  describe('B1 & B2: STAFF SubRole & Branch Isolation on Commerce/Refunds/Inventory', () => {
    it('blocks non-RECEPTIONIST STAFF from Orders list/detail/cancel/mutations while allowing in-branch RECEPTIONIST', async () => {
      const orderQ1Id = oid();
      const orderQ7Id = oid();

      jest.spyOn(Order, 'find').mockImplementation(() => mockChain([]));
      jest.spyOn(Order, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(Order, 'findById').mockImplementation(async (id) => ({
        _id: id,
        fulfillmentBranchId: id === orderQ1Id ? BRANCH_Q1 : BRANCH_Q7,
        branchId: id === orderQ1Id ? BRANCH_Q1 : BRANCH_Q7,
        customerId: IDS.customer1,
        status: 'PENDING',
        statusHistory: [],
        items: [],
        save: jest.fn().mockResolvedValue(true),
      }));

      for (const roleKey of ['vetQ1', 'nurseQ1', 'groomerQ1']) {
        const listRes = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(listRes.status).toBe(403);

        const detailRes = await request(app)
          .get(`/api/v1/orders/${orderQ1Id}`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(detailRes.status).toBe(403);

        const confirmRes = await request(app)
          .post(`/api/v1/orders/${orderQ1Id}/confirm`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(confirmRes.status).toBe(403);

        const cancelRes = await request(app)
          .post(`/api/v1/orders/${orderQ1Id}/cancel`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .send({ reason: 'Unauthorized staff attempt' });
        expect(cancelRes.status).toBe(403);
      }

      const recList = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${TOKENS.receptionistQ1}`);
      expect(recList.status).toBe(200);

      const recOutOfBranch = await request(app)
        .post(`/api/v1/orders/${orderQ7Id}/confirm`)
        .set('Authorization', `Bearer ${TOKENS.receptionistQ1}`);
      expect(recOutOfBranch.status).toBe(403);
      expect(recOutOfBranch.body.code).toBe('BRANCH_SCOPE_ERROR');

      const mgrOutOfBranch = await request(app)
        .post(`/api/v1/orders/${orderQ7Id}/confirm`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(mgrOutOfBranch.status).toBe(403);
      expect(mgrOutOfBranch.body.code).toBe('BRANCH_SCOPE_ERROR');
    });

    it('enforces RECEPTIONIST/MANAGER separation & branch scope on OrderReturns and BookingRefunds', async () => {
      const returnQ7Id = oid();
      const orderQ7Id = oid();
      const refundQ7Id = oid();

      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(true),
        abortTransaction: jest.fn().mockResolvedValue(true),
        endSession: jest.fn(),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Order, 'findById').mockImplementation(() => ({
        session: jest.fn().mockResolvedValue({
          _id: orderQ7Id,
          fulfillmentBranchId: BRANCH_Q7,
          branchId: BRANCH_Q7,
          customerId: IDS.customer1,
          items: [],
        }),
      }));
      jest.spyOn(OrderReturn, 'find').mockImplementation(() => mockChain([]));
      jest.spyOn(OrderReturn, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(OrderReturn, 'findById').mockImplementation(() => ({
        session: jest.fn().mockResolvedValue({
          _id: returnQ7Id,
          orderId: orderQ7Id,
          branchId: BRANCH_Q7,
          customerId: IDS.customer1,
          status: 'RECEIVED',
          items: [],
        }),
      }));

      jest.spyOn(BookingRefund, 'find').mockImplementation(() => mockChain([]));
      jest.spyOn(BookingRefund, 'countDocuments').mockResolvedValue(0);
      jest.spyOn(BookingRefund, 'findById').mockResolvedValue({
        _id: refundQ7Id,
        appointmentId: oid(),
        branchId: BRANCH_Q7,
        customerId: IDS.customer1,
        status: 'PROCESSING',
        amount: 100000,
      });

      for (const roleKey of ['vetQ1', 'nurseQ1', 'groomerQ1']) {
        const retList = await request(app)
          .get('/api/v1/order-returns')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(retList.status).toBe(403);

        const recRefund = await request(app)
          .post(`/api/v1/booking-refunds/${refundQ7Id}/receive`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .set('Idempotency-Key', `idem-ref-${roleKey}`)
          .send({});
        expect(recRefund.status).toBe(403);
      }

      const recApprove = await request(app)
        .post(`/api/v1/order-returns/${returnQ7Id}/approve`)
        .set('Authorization', `Bearer ${TOKENS.receptionistQ1}`)
        .set('Idempotency-Key', 'idem-ret-rec')
        .send({});
      expect(recApprove.status).toBe(403);

      const mgrOutBranchReturn = await request(app)
        .post(`/api/v1/order-returns/${returnQ7Id}/approve`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .set('Idempotency-Key', 'idem-ret-mgr')
        .send({});
      expect(mgrOutBranchReturn.status).toBe(403);

      const guestRefundList = await request(app).get('/api/v1/booking-refunds');
      expect(guestRefundList.status).toBe(401);

      const mgrOutBranchRefund = await request(app)
        .get(`/api/v1/booking-refunds/${refundQ7Id}`)
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(mgrOutBranchRefund.status).toBe(403);
    });

    it('restricts GET /inventory/transactions to ADMIN & MANAGER only', async () => {
      jest.spyOn(InventoryTransaction, 'find').mockImplementation(() => mockChain([]));
      jest.spyOn(InventoryTransaction, 'countDocuments').mockResolvedValue(0);

      for (const roleKey of ['receptionistQ1', 'vetQ1', 'nurseQ1', 'groomerQ1', 'customer1']) {
        const res = await request(app)
          .get('/api/v1/inventory/transactions')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(res.status).toBe(403);
      }

      const mgrRes = await request(app)
        .get('/api/v1/inventory/transactions')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(mgrRes.status).toBe(200);
    });
  });

  // =========================================================================
  // B3: Booking Check-in / Start Segment / Customer / Execution / Shifts
  // =========================================================================
  describe('B3: Booking, ServiceRecord, Customer & Staff Self-Shift Scoping', () => {
    it('enforces check-in (RECEPTIONIST/MANAGER/ADMIN) & start segment (assigned clinical staff)', async () => {
      const aptId = oid();
      const serviceId = oid();
      const otherVetId = oid();

      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() => mockChain([], { _id: IDS.vetProfileQ1 }));
      jest.spyOn(Appointment, 'findById').mockImplementation(() =>
        mockChain([], {
          _id: aptId,
          branchId: { _id: BRANCH_Q1, toString: () => BRANCH_Q1 },
          customerId: IDS.customer1,
          status: 'CONFIRMED',
          checkInStatus: 'ARRIVED',
          services: [
            {
              serviceId,
              requiredStaffRole: 'VETERINARIAN',
              assignedStaffId: IDS.vetProfileQ1,
              executionStatus: 'PENDING',
            },
          ],
          save: jest.fn().mockResolvedValue(true),
        })
      );

      // Vet cannot check in
      const vetCheckIn = await request(app)
        .post(`/api/v1/appointments/${aptId}/check-in`)
        .set('Authorization', `Bearer ${TOKENS.vetQ1}`)
        .send({});
      expect(vetCheckIn.status).toBe(403);

      // Receptionist cannot start segment
      const recStart = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.receptionistQ1}`)
        .set('Idempotency-Key', 'idem-start-rec')
        .send({ serviceId, expectedVersion: 1 });
      expect(recStart.status).toBe(403);

      // Nurse cannot start VETERINARIAN segment
      const nurseStart = await request(app)
        .post(`/api/v1/appointments/${aptId}/start`)
        .set('Authorization', `Bearer ${TOKENS.nurseQ1}`)
        .set('Idempotency-Key', 'idem-start-nurse')
        .send({ serviceId, expectedVersion: 1 });
      expect(nurseStart.status).toBe(403);

      // Admin and Manager CANNOT press "start service" (clinical staff only)
      for (const roleKey of ['admin', 'managerQ1']) {
        const execStart = await request(app)
          .post(`/api/v1/appointments/${aptId}/start`)
          .set('X-Forwarded-For', '10.10.0.12')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .set('Idempotency-Key', `idem-start-${roleKey}`)
          .send({ serviceId, expectedVersion: 1 });
        expect(execStart.status).toBe(403);
      }

      // Unassigned Vet cannot view appointment detail
      const unassignedVetToken = sign({
        id: otherVetId,
        systemRole: 'STAFF',
        staffSubRole: 'VETERINARIAN',
        assignedBranchIds: [BRANCH_Q1],
        authorizedBranchIds: [BRANCH_Q1],
      });
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() => mockChain([], { _id: oid() }));
      const unassignedView = await request(app)
        .get(`/api/v1/appointments/${aptId}`)
        .set('Authorization', `Bearer ${unassignedVetToken}`);
      expect(unassignedView.status).toBe(403);
    });

    it('restricts GET /customers/lookup and GET /customers/:id for non-receptionist STAFF', async () => {
      const custRecordId = oid();
      jest.spyOn(Customer, 'findById').mockImplementation(() =>
        mockChain([], {
          _id: custRecordId,
          userId: { _id: IDS.customer1, email: 'c@test.com', fullName: 'Cust', phone: '0901234567' },
          phone: '0901234567',
          activityBranchIds: [BRANCH_Q1],
        })
      );
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() => mockChain([], { _id: IDS.vetProfileQ1 }));
      jest.spyOn(Appointment, 'exists').mockResolvedValue(null);

      for (const roleKey of ['vetQ1', 'nurseQ1', 'groomerQ1']) {
        const lookupRes = await request(app)
          .get('/api/v1/customers/lookup?phone=0901234567')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(lookupRes.status).toBe(403);

        const detailRes = await request(app)
          .get(`/api/v1/customers/${custRecordId}`)
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`);
        expect(detailRes.status).toBe(403);
      }
    });

    it('blocks RECEPTIONIST from clinical ServiceRecord writes & blocks MANAGER out-of-branch reopen/revisions', async () => {
      const recQ7Id = oid();
      jest.spyOn(ServiceRecord, 'findById').mockResolvedValue({
        _id: recQ7Id,
        branchId: BRANCH_Q7,
        recordType: 'MEDICAL',
        status: 'FINALIZED',
        assignedStaffId: IDS.vetQ1,
      });
      jest.spyOn(ServiceRecord, 'findOne').mockImplementation(() =>
        mockChain([], {
          _id: recQ7Id,
          branchId: BRANCH_Q7,
          recordType: 'MEDICAL',
          status: 'FINALIZED',
        })
      );
      jest.spyOn(ServiceRecordRevision, 'find').mockImplementation(() => mockChain([]));

      const recProf = await request(app)
        .patch(`/api/v1/service-records/${recQ7Id}/professional`)
        .set('X-Forwarded-For', '10.10.0.9')
        .set('Authorization', `Bearer ${TOKENS.receptionistQ1}`)
        .send({ medicalFields: { diagnosis: 'X' } });
      expect(recProf.status).toBe(403);

      const mgrReopen = await request(app)
        .post(`/api/v1/service-records/${recQ7Id}/reopen`)
        .set('X-Forwarded-For', '10.10.0.9')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`)
        .set('Idempotency-Key', 'idem-reopen-q7')
        .send({ reason: 'Check other branch', expectedVersion: 1 });
      expect(mgrReopen.status).toBe(403);
      expect(mgrReopen.body.code).toBe('BRANCH_SCOPE_ERROR');

      const mgrRevisions = await request(app)
        .get(`/api/v1/service-records/${recQ7Id}/revisions`)
        .set('X-Forwarded-For', '10.10.0.9')
        .set('Authorization', `Bearer ${TOKENS.managerQ1}`);
      expect(mgrRevisions.status).toBe(403);
      expect(mgrRevisions.body.code).toBe('BRANCH_SCOPE_ERROR');
    });

    it('strictly blocks ADMIN and MANAGER from all downstream service-execution mutations (create/materials/professional/submit-review/finalize)', async () => {
      const recId = oid();
      const aptId = oid();
      const matId = oid();
      const serviceId = oid();

      for (const roleKey of ['admin', 'managerQ1', 'receptionistQ1']) {
        const createRes = await request(app)
          .post('/api/v1/service-records')
          .set('X-Forwarded-For', '10.10.0.13')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .send({ appointmentId: aptId, serviceType: 'MEDICAL' });
        expect(createRes.status).toBe(403);

        const putMatRes = await request(app)
          .put(`/api/v1/service-records/${recId}/materials`)
          .set('X-Forwarded-For', '10.10.0.13')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .send({
            materials: [{ inventoryItemId: matId, actualQuantity: 1, unit: 'cái' }],
            expectedVersion: 1,
          });
        expect(putMatRes.status).toBe(403);

        const patchMatRes = await request(app)
          .patch(`/api/v1/service-records/${recId}/materials`)
          .set('X-Forwarded-For', '10.10.0.13')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .send({ materials: [], expectedVersion: 1 });
        expect(patchMatRes.status).toBe(403);

        const putProfRes = await request(app)
          .put(`/api/v1/service-records/${recId}/professional`)
          .set('X-Forwarded-For', '10.10.0.13')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .send({ diagnosis: 'Test', expectedVersion: 1 });
        expect(putProfRes.status).toBe(403);

        const patchProfRes = await request(app)
          .patch(`/api/v1/service-records/${recId}/professional`)
          .set('X-Forwarded-For', '10.10.0.13')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .send({ diagnosis: 'Test', expectedVersion: 1 });
        expect(patchProfRes.status).toBe(403);

        const submitRes = await request(app)
          .post(`/api/v1/service-records/${recId}/submit-review`)
          .set('X-Forwarded-For', '10.10.0.13')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .set('Idempotency-Key', `idem-sub-${roleKey}`)
          .send({ serviceId, expectedVersion: 1 });
        expect(submitRes.status).toBe(403);

        const finRes = await request(app)
          .post(`/api/v1/service-records/${recId}/finalize`)
          .set('X-Forwarded-For', '10.10.0.13')
          .set('Authorization', `Bearer ${TOKENS[roleKey]}`)
          .set('Idempotency-Key', `idem-fin-${roleKey}`)
          .send({ serviceId, expectedVersion: 1 });
        expect(finRes.status).toBe(403);
      }
    });

    it('restricts GET /staff/:staffId/shifts for STAFF to own shifts only', async () => {
      const otherStaffId = oid();
      jest.spyOn(StaffProfile, 'findOne').mockImplementation(() => mockChain([], { _id: IDS.vetProfileQ1 }));
      jest.spyOn(Shift, 'find').mockImplementation(() => mockChain([]));
      jest.spyOn(Shift, 'countDocuments').mockResolvedValue(0);

      const denied = await request(app)
        .get(`/api/v1/staff/${otherStaffId}/shifts`)
        .set('X-Forwarded-For', '10.10.0.10')
        .set('Authorization', `Bearer ${TOKENS.vetQ1}`);
      expect(denied.status).toBe(403);

      const allowed = await request(app)
        .get(`/api/v1/staff/${IDS.vetProfileQ1}/shifts`)
        .set('X-Forwarded-For', '10.10.0.10')
        .set('Authorization', `Bearer ${TOKENS.vetQ1}`);
      expect(allowed.status).toBe(200);
    });
  });

  // =========================================================================
  // B4: STAFF -> MANAGER role change blocked across ALL edit endpoints
  // =========================================================================
  describe('B4: Admin User Role Transition Guard', () => {
    it('rejects direct STAFF -> MANAGER transition across /admin/users/:id/role, /admin/users/:id, and /staff/:id with 409 INVALID_STATE_TRANSITION', async () => {
      const targetUserId = oid();
      const targetProfileId = oid();
      jest.spyOn(User, 'findById').mockResolvedValue({
        _id: targetUserId,
        systemRole: 'STAFF',
        staffSubRole: 'RECEPTIONIST',
        assignedBranchIds: [BRANCH_Q1],
      });
      jest.spyOn(StaffProfile, 'findById').mockImplementation(() =>
        mockChain([], {
          _id: targetProfileId,
          staffSubRole: 'RECEPTIONIST',
          userId: {
            _id: targetUserId,
            systemRole: 'STAFF',
            staffSubRole: 'RECEPTIONIST',
          },
        })
      );

      const res = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}/role`)
        .set('X-Forwarded-For', '10.10.0.11')
        .set('Authorization', `Bearer ${TOKENS.admin}`)
        .send({ systemRole: 'MANAGER', assignedBranchIds: [BRANCH_Q1] });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVALID_STATE_TRANSITION');

      const editUserRes = await request(app)
        .patch(`/api/v1/admin/users/${targetUserId}`)
        .set('X-Forwarded-For', '10.10.0.11')
        .set('Authorization', `Bearer ${TOKENS.admin}`)
        .send({ systemRole: 'MANAGER', assignedBranchIds: [BRANCH_Q1] });

      expect(editUserRes.status).toBe(409);
      expect(editUserRes.body.code).toBe('INVALID_STATE_TRANSITION');

      const editStaffRes = await request(app)
        .patch(`/api/v1/staff/${targetProfileId}`)
        .set('X-Forwarded-For', '10.10.0.11')
        .set('Authorization', `Bearer ${TOKENS.admin}`)
        .send({ staffSubRole: 'MANAGER' });

      expect([400, 409]).toContain(editStaffRes.status);
      expect(['VALIDATION_ERROR', 'INVALID_STATE_TRANSITION']).toContain(editStaffRes.body.code);
    });
  });
});

