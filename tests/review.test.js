import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import config from '../src/shared/config';
import Review from '../src/modules/review/models/Review';
import Feedback from '../src/modules/review/models/Feedback';
import Order from '../src/modules/order/models/Order';
import Appointment from '../src/modules/booking/models/Appointment';
import Customer from '../src/modules/customer/models/Customer';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';

const branchId = '507f1f77bcf86cd799439011';
const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const customerUserId1 = '507f1f77bcf86cd799439003';
const customerUserId2 = '507f1f77bcf86cd799439004';

const customerId1 = '507f1f77bcf86cd799439013';
const customerId2 = '507f1f77bcf86cd799439014';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const managerToken = jwt.sign(
  { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const customerToken1 = jwt.sign(
  { id: customerUserId1, systemRole: 'CUSTOMER', fullName: 'Khach Hang Mot' },
  config.jwt.accessSecret
);

const customerToken2 = jwt.sign(
  { id: customerUserId2, systemRole: 'CUSTOMER', fullName: 'Khach Hang Hai' },
  config.jwt.accessSecret
);

describe('Task 4.6: Feedback & Review Module Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
    jest.spyOn(Review, 'findOne').mockResolvedValue(null);
    jest.spyOn(Customer, 'findOne').mockResolvedValue({ _id: customerId1, fullName: 'Khach Hang Mot' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validReviewId = '507f1f77bcf86cd799439080';
  const validProductId = '507f1f77bcf86cd799439081';
  const validServiceId = '507f1f77bcf86cd799439082';
  const validOrderId = '507f1f77bcf86cd799439083';
  const validAppointmentId = '507f1f77bcf86cd799439084';
  const validFeedbackId = '507f1f77bcf86cd799439085';

  describe('1. Review Creation & Source Validation', () => {
    it('creates review for completed order product with anonymous preference', async () => {
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(validOrderId),
        customerId: new mongoose.Types.ObjectId(customerId1),
        userId: new mongoose.Types.ObjectId(customerUserId1),
        status: 'COMPLETED',
        items: [{ productId: new mongoose.Types.ObjectId(validProductId) }],
      };

      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(customerId1),
        userId: new mongoose.Types.ObjectId(customerUserId1),
      };

      jest.spyOn(Customer, 'findOne').mockResolvedValue(mockCustomer);
      jest.spyOn(Order, 'findOne').mockResolvedValue(mockOrder);
      jest.spyOn(Review, 'findOne').mockResolvedValue(null);
      jest.spyOn(Review.prototype, 'save').mockResolvedValue(true);

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken1}`)
        .set('Idempotency-Key', 'rev-create-001')
        .send({
          targetType: 'PRODUCT',
          targetId: validProductId,
          rating: 5,
          comment: 'Sản phẩm thức ăn hạt chất lượng rất tốt!',
          anonymous: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.rating).toBe(5);
      expect(res.body.anonymous).toBe(true);
      expect(res.body.displayName).toBeNull(); // Anonymous mask applied
    });

    it('creates review for completed appointment service', async () => {
      const mockAppointment = {
        _id: new mongoose.Types.ObjectId(validAppointmentId),
        customerId: new mongoose.Types.ObjectId(customerId1),
        status: 'COMPLETED',
        services: [{ serviceId: new mongoose.Types.ObjectId(validServiceId) }],
      };

      const mockCustomer = {
        _id: new mongoose.Types.ObjectId(customerId1),
        userId: new mongoose.Types.ObjectId(customerUserId1),
      };

      jest.spyOn(Customer, 'findOne').mockResolvedValue(mockCustomer);
      jest.spyOn(Appointment, 'findOne').mockResolvedValue(mockAppointment);
      jest.spyOn(Review, 'findOne').mockResolvedValue(null);
      jest.spyOn(Review.prototype, 'save').mockResolvedValue(true);

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken1}`)
        .set('Idempotency-Key', 'rev-create-002')
        .send({
          targetType: 'SERVICE',
          targetId: validServiceId,
          rating: 4,
          comment: 'Dịch vụ tắm spa rất chuyên nghiệp',
          anonymous: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.rating).toBe(4);
      expect(res.body.anonymous).toBe(false);
      expect(res.body.displayName).toBe('Khach Hang Mot');
    });

    it('rejects review for non-completed order (400)', async () => {
      const mockOrder = {
        _id: new mongoose.Types.ObjectId(validOrderId),
        customerId: new mongoose.Types.ObjectId(customerId1),
        status: 'PROCESSING', // Not COMPLETED yet
        items: [{ productId: new mongoose.Types.ObjectId(validProductId) }],
      };

      jest.spyOn(Customer, 'findOne').mockResolvedValue({ _id: customerId1 });
      jest.spyOn(Order, 'findOne')
        .mockResolvedValueOnce(null) // first check completed order -> null
        .mockResolvedValueOnce(mockOrder); // second check any order -> uncompleted order found

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken1}`)
        .set('Idempotency-Key', 'rev-create-003')
        .send({
          targetType: 'PRODUCT',
          targetId: validProductId,
          rating: 5,
        });

      expect(res.status).toBe(400);
    });

    it('rejects review for another customer order (403)', async () => {
      jest.spyOn(Customer, 'findOne').mockResolvedValue({ _id: customerId1 });
      jest.spyOn(Order, 'findOne').mockResolvedValue(null); // No order found for this customer

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken1}`)
        .set('Idempotency-Key', 'rev-create-004')
        .send({
          targetType: 'PRODUCT',
          targetId: validProductId,
          rating: 5,
        });

      expect(res.status).toBe(403);
    });

    it('rejects duplicate review for same source and target (409)', async () => {
      const existingReview = { _id: validReviewId };

      jest.spyOn(Customer, 'findOne').mockResolvedValue({ _id: customerId1 });
      jest.spyOn(Review, 'findOne').mockResolvedValue(existingReview);

      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${customerToken1}`)
        .set('Idempotency-Key', 'rev-create-005')
        .send({
          targetType: 'PRODUCT',
          targetId: validProductId,
          rating: 5,
        });

      expect(res.status).toBe(409);
    });
  });

  describe('2. Public List & Anonymous Masking (GET /reviews)', () => {
    it('returns only active, non-hidden reviews with anonymous displayName masked', async () => {
      const mockReviews = [
        {
          _id: new mongoose.Types.ObjectId(validReviewId),
          targetType: 'PRODUCT',
          targetId: new mongoose.Types.ObjectId(validProductId),
          rating: 5,
          comment: 'Rất tốt',
          anonymous: true,
          displayName: 'Nguyen Van A',
          hidden: false,
          status: 'ACTIVE',
          createdAt: new Date(),
        }
      ];

      jest.spyOn(Review, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReviews),
      });

      const res = await request(app)
        .get(`/api/v1/reviews?targetType=PRODUCT&targetId=${validProductId}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].anonymous).toBe(true);
      expect(res.body.items[0].displayName).toBeNull(); // Masked
    });
  });

  describe('3. Moderation (Hide/Show & Admin List)', () => {
    it('allows Manager to hide a violating review', async () => {
      const mockReview = {
        _id: new mongoose.Types.ObjectId(validReviewId),
        targetType: 'PRODUCT',
        targetId: new mongoose.Types.ObjectId(validProductId),
        rating: 1,
        comment: 'Spam comment',
        anonymous: false,
        hidden: false,
        status: 'ACTIVE',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Review, 'findById').mockResolvedValue(mockReview);

      const res = await request(app)
        .post(`/api/v1/reviews/${validReviewId}/hide`)
        .set('Authorization', `Bearer ${managerToken}`)
        .set('Idempotency-Key', 'hide-001')
        .send({ reason: 'Nội dung bôi nhọ vô căn cứ' });

      expect(res.status).toBe(200);
      expect(mockReview.hidden).toBe(true);
      expect(mockReview.status).toBe('HIDDEN');
      expect(mockReview.hiddenReason).toContain('Nội dung bôi nhọ');
    });

    it('allows Admin to un-hide a review', async () => {
      const mockReview = {
        _id: new mongoose.Types.ObjectId(validReviewId),
        targetType: 'PRODUCT',
        targetId: new mongoose.Types.ObjectId(validProductId),
        rating: 1,
        comment: 'Gop y',
        anonymous: false,
        hidden: true,
        status: 'HIDDEN',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Review, 'findById').mockResolvedValue(mockReview);

      const res = await request(app)
        .post(`/api/v1/reviews/${validReviewId}/show`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'show-001');

      expect(res.status).toBe(200);
      expect(mockReview.hidden).toBe(false);
      expect(mockReview.status).toBe('ACTIVE');
    });

    it('shows full details without masking for Admin list (/reviews/admin)', async () => {
      const mockReviews = [
        {
          _id: new mongoose.Types.ObjectId(validReviewId),
          targetType: 'PRODUCT',
          targetId: new mongoose.Types.ObjectId(validProductId),
          rating: 5,
          comment: 'Anonymous feedback',
          anonymous: true,
          displayName: 'Nguyen Van Real',
          hidden: true,
          status: 'HIDDEN',
          createdAt: new Date(),
        }
      ];

      jest.spyOn(Review, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockReviews),
      });

      const res = await request(app)
        .get('/api/v1/reviews/admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].displayName).toBe('Nguyen Van Real'); // Unmasked for admin
      expect(res.body.items[0].hidden).toBe(true);
    });
  });

  describe('4. Feedback Module Lifecycle & State Machine', () => {
    it('allows public user to submit feedback', async () => {
      const mockFeedback = {
        _id: new mongoose.Types.ObjectId(validFeedbackId),
        name: 'Khach Vang Lai',
        email: 'guest@example.com',
        subject: 'Khen ngoi bac si',
        message: 'Bác sĩ rất tận tình chu đáo',
        category: 'GENERAL',
        status: 'NEW',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Feedback.prototype, 'save').mockResolvedValue(mockFeedback);

      const res = await request(app)
        .post('/api/v1/feedback')
        .send({
          name: 'Khach Vang Lai',
          email: 'guest@example.com',
          subject: 'Khen ngoi bac si',
          message: 'Bác sĩ rất tận tình chu đáo',
          category: 'GENERAL',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('NEW');
      expect(res.body.subject).toBe('Khen ngoi bac si');
    });

    it('transitions feedback NEW -> READ -> PROCESSING -> PROCESSED', async () => {
      const mockFeedback = {
        _id: new mongoose.Types.ObjectId(validFeedbackId),
        status: 'NEW',
        save: jest.fn().mockResolvedValue(true),
      };

      jest.spyOn(Feedback, 'findById').mockResolvedValue(mockFeedback);

      // 1. NEW -> READ
      let res = await request(app)
        .patch(`/api/v1/feedback/${validFeedbackId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'READ' });

      expect(res.status).toBe(200);
      expect(mockFeedback.status).toBe('READ');

      // 2. READ -> PROCESSING
      res = await request(app)
        .patch(`/api/v1/feedback/${validFeedbackId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'PROCESSING', notes: 'Đang liên hệ phòng khám' });

      expect(res.status).toBe(200);
      expect(mockFeedback.status).toBe('PROCESSING');

      // 3. PROCESSING -> PROCESSED
      res = await request(app)
        .patch(`/api/v1/feedback/${validFeedbackId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'PROCESSED', response: 'Đã giải quyết xong' });

      expect(res.status).toBe(200);
      expect(mockFeedback.status).toBe('PROCESSED');
    });

    it('rejects invalid state transition (409)', async () => {
      const mockFeedback = {
        _id: new mongoose.Types.ObjectId(validFeedbackId),
        status: 'NEW', // Cannot jump directly from NEW to PROCESSED
      };

      jest.spyOn(Feedback, 'findById').mockResolvedValue(mockFeedback);

      const res = await request(app)
        .patch(`/api/v1/feedback/${validFeedbackId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'PROCESSED' });

      expect(res.status).toBe(409);
    });

    it('rejects Customer trying to access feedback list (403)', async () => {
      const res = await request(app)
        .get('/api/v1/feedback')
        .set('Authorization', `Bearer ${customerToken1}`);

      expect(res.status).toBe(403);
    });
  });
});
