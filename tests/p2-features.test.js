import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import Pet from '../src/modules/customer/models/Pet';
import Customer from '../src/modules/customer/models/Customer';
import Product from '../src/modules/catalog/models/Product';
import Service from '../src/modules/catalog/models/Service';
import CarePlanTaskState from '../src/modules/care-plan/models/CarePlanTaskState';
import Appointment from '../src/modules/booking/models/Appointment';
import ServiceRecord from '../src/modules/execution/models/ServiceRecord';
import Order from '../src/modules/order/models/Order';
import Post from '../src/modules/content/models/Post';
import User from '../src/models/User';

const customerId = '507f1f77bcf86cd799439003';
const petId = '507f1f77bcf86cd799439055';
const customerProfileId = '507f1f77bcf86cd799439077';

const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

describe('Wave 3, 4, 5: Priority P2 Features Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task 5.1: Personalized Care Plan', () => {
    it('GET /api/v1/pets/:petId/care-plan returns dynamic timeline for pet', async () => {
      jest.spyOn(Pet, 'findById').mockReturnValue({
        lean: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(petId),
          customerId: new mongoose.Types.ObjectId(customerProfileId),
          name: 'Buddy',
          species: 'DOG',
          breed: 'Golden Retriever',
          ageYears: 3,
          weightKg: 28,
          medicalNotes: 'Tiêm phòng đầy đủ, lông dày.',
        }),
      });

      jest.spyOn(Customer, 'findOne').mockReturnValue({
        lean: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(customerProfileId),
          userId: new mongoose.Types.ObjectId(customerId),
        }),
      });

      jest.spyOn(Appointment, 'find').mockReturnValue({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      jest.spyOn(ServiceRecord, 'find').mockReturnValue({
        populate: () => ({
          sort: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        }),
      });

      jest.spyOn(CarePlanTaskState, 'find').mockReturnValue({
        lean: () => Promise.resolve([]),
      });

      const res = await request(app)
        .get(`/api/v1/pets/${petId}/care-plan`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.petName).toBe('Buddy');
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalTasks).toBeGreaterThanOrEqual(4);
      expect(Array.isArray(res.body.tasks)).toBe(true);

      const vaccineTask = res.body.tasks.find((t) => t.category === 'VACCINATION');
      expect(vaccineTask).toBeDefined();
      expect(vaccineTask.recommendedServiceCode).toBe('MED02');
    });

    it('PATCH /api/v1/pets/:petId/care-plan/tasks/:taskKey updates completion state', async () => {
      jest.spyOn(Pet, 'findById').mockReturnValue({
        lean: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(petId),
          customerId: new mongoose.Types.ObjectId(customerProfileId),
          name: 'Buddy',
        }),
      });

      jest.spyOn(Customer, 'findOne').mockReturnValue({
        lean: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(customerProfileId),
          userId: new mongoose.Types.ObjectId(customerId),
        }),
      });

      jest.spyOn(CarePlanTaskState, 'findOneAndUpdate').mockResolvedValue({
        petId: new mongoose.Types.ObjectId(petId),
        taskKey: 'VACCINE_ANNUAL_BOOSTER',
        completed: true,
        completedAt: new Date(),
        notes: 'Đã tiêm phòng tại trạm',
      });

      const res = await request(app)
        .patch(`/api/v1/pets/${petId}/care-plan/tasks/VACCINE_ANNUAL_BOOSTER`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          completed: true,
          notes: 'Đã tiêm phòng tại trạm',
        });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.notes).toBe('Đã tiêm phòng tại trạm');
    });

    it('POST /api/v1/pets/:petId/care-plan/reminders dispatches notification', async () => {
      jest.spyOn(Pet, 'findById').mockReturnValue({
        lean: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(petId),
          customerId: new mongoose.Types.ObjectId(customerProfileId),
          name: 'Buddy',
        }),
      });

      jest.spyOn(Customer, 'findOne').mockReturnValue({
        lean: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(customerProfileId),
          userId: new mongoose.Types.ObjectId(customerId),
        }),
      });

      jest.spyOn(Customer, 'findById').mockReturnValue({
        lean: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(customerProfileId),
          userId: new mongoose.Types.ObjectId(customerId),
        }),
      });

      const res = await request(app)
        .post(`/api/v1/pets/${petId}/care-plan/reminders`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          taskKey: 'VACCINE_ANNUAL_BOOSTER',
          message: 'Nhắc nhở tiêm phòng cho bé Buddy',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Task 5.2: Service & Product Recommendations', () => {
    it('GET /api/v1/recommendations returns active recommendations for pet', async () => {
      jest.spyOn(Pet, 'findById').mockReturnValue({
        lean: () => Promise.resolve({
          _id: new mongoose.Types.ObjectId(petId),
          customerId: new mongoose.Types.ObjectId(customerProfileId),
          name: 'Buddy',
          species: 'DOG',
          ageYears: 3,
        }),
      });

      jest.spyOn(Appointment, 'find').mockReturnValue({
        populate: () => ({
          limit: () => ({
            lean: () => Promise.resolve([]),
          }),
        }),
      });

      jest.spyOn(Order, 'find').mockReturnValue({
        limit: () => ({
          lean: () => Promise.resolve([]),
        }),
      });

      jest.spyOn(Product, 'find').mockReturnValue({
        populate: () => ({
          limit: () => ({
            lean: () => Promise.resolve([
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Thức ăn hạt cao cấp cho chó lớn Royal Canin',
                slug: 'thuc-an-cho-royal-canin',
                status: 'ACTIVE',
                usageType: 'SALE',
                basePrice: 350000,
                ratingAvg: 4.8,
                variants: [{ sku: 'RC-01', stock: 50, price: 350000 }],
              },
            ]),
          }),
        }),
      });

      jest.spyOn(Service, 'find').mockReturnValue({
        limit: () => ({
          lean: () => Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              code: 'MED02',
              name: 'Tiêm vaccine phòng bệnh',
              serviceType: 'MEDICAL',
              category: 'Phòng ngừa',
              basePrice: 220000,
              durationMinutes: 20,
              bookingMode: 'BOOKABLE',
              ratingAvg: 5.0,
            },
          ]),
        }),
      });

      const res = await request(app).get(`/api/v1/recommendations?petId=${petId}`);
      expect(res.status).toBe(200);
      expect(res.body.petName).toBe('Buddy');
      expect(Array.isArray(res.body.recommendations)).toBe(true);
      expect(res.body.recommendations.length).toBeGreaterThanOrEqual(1);

      const firstRec = res.body.recommendations[0];
      expect(firstRec).toHaveProperty('reason');
      expect(firstRec).toHaveProperty('signals');
      expect(firstRec).toHaveProperty('item');
    });

    it('GET /api/v1/recommendations supports guest browsing (no petId)', async () => {
      jest.spyOn(Product, 'find').mockReturnValue({
        populate: () => ({
          limit: () => ({
            lean: () => Promise.resolve([
              {
                _id: new mongoose.Types.ObjectId(),
                name: 'Sữa tắm thú cưng SOS',
                slug: 'sua-tam-sos',
                status: 'ACTIVE',
                usageType: 'SALE',
                basePrice: 150000,
                ratingAvg: 4.9,
                variants: [{ sku: 'SOS-01', stock: 20, price: 150000 }],
              },
            ]),
          }),
        }),
      });

      jest.spyOn(Service, 'find').mockReturnValue({
        limit: () => ({
          lean: () => Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              code: 'GRM01',
              name: 'Tắm spa & Sấy phồng tạo kiểu',
              serviceType: 'GROOMING',
              basePrice: 180000,
              durationMinutes: 60,
              bookingMode: 'BOOKABLE',
              ratingAvg: 4.9,
            },
          ]),
        }),
      });

      const res = await request(app).get('/api/v1/recommendations?type=ALL');
      expect(res.status).toBe(200);
      expect(res.body.petId).toBeNull();
      expect(res.body.recommendations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Task 5.3: AI Screening Assistant', () => {
    it('POST /api/v1/ai/screening returns structured triage for routine symptoms', async () => {
      jest.spyOn(Service, 'find').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              code: 'MED01',
              name: 'Khám sức khỏe tổng quát',
              serviceType: 'MEDICAL',
              basePrice: 150000,
              durationMinutes: 30,
              bookingMode: 'BOOKABLE',
            },
          ]),
        }),
      });

      jest.spyOn(Post, 'find').mockReturnValue({
        select: () => ({
          limit: () => ({
            lean: () => Promise.resolve([
              {
                _id: new mongoose.Types.ObjectId(),
                title: 'Cẩm nang chăm sóc và sơ cứu thú cưng khẩn cấp',
                slug: 'cam-nang-so-cuu-khan-cap',
                excerpt: 'Các bước xử lý ban đầu khi thú cưng có dấu hiệu bất thường...',
                coverImage: 'https://res.cloudinary.com/...',
              },
            ]),
          }),
        }),
      });

      const res = await request(app)
        .post('/api/v1/ai/screening')
        .send({
          species: 'CAT',
          ageYears: 2,
          symptoms: 'Bé hơi lười ăn sáng nay nhưng vẫn uống nước và vui chơi',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('attentionLevel');
      expect(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']).toContain(res.body.attentionLevel);
      expect(res.body).toHaveProperty('summary');
      expect(Array.isArray(res.body.nextSteps)).toBe(true);
      expect(res.body).toHaveProperty('disclaimer');
      expect(res.body.disclaimer).toContain('LƯU Ý Y KHOA');
    });

    it('POST /api/v1/ai/screening triggers EMERGENCY_OVERRIDE for life-threatening keywords', async () => {
      jest.spyOn(Service, 'find').mockReturnValue({
        select: () => ({
          lean: () => Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              code: 'MED07',
              name: 'Cấp cứu & Hồi sức tích cực 24/7',
              serviceType: 'MEDICAL',
              basePrice: 500000,
              durationMinutes: 60,
              bookingMode: 'CONTACT_ONLY',
            },
          ]),
        }),
      });

      jest.spyOn(Post, 'find').mockReturnValue({
        select: () => ({
          limit: () => ({
            lean: () => Promise.resolve([]),
          }),
        }),
      });

      const res = await request(app)
        .post('/api/v1/ai/screening')
        .send({
          species: 'DOG',
          symptoms: 'Bé bị co giật, sùi bọt mép và khó thở dữ dội nghi ăn phải bả thuốc chuột',
        });

      expect(res.status).toBe(200);
      expect(res.body.attentionLevel).toBe('EMERGENCY');
      expect(res.body.mode).toBe('EMERGENCY_OVERRIDE');
      expect(res.body.attentionLabel).toContain('CẤP CỨU');
      expect(res.body.recommendedServices.some((s) => s.code === 'MED07')).toBe(true);
    });
  });
});
