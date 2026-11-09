import dotenv from 'dotenv';
import path from 'path';
import request from 'supertest';
import mongoose from 'mongoose';

// Ensure we connect to actual Atlas database during integration verification
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

import app from '../src/app';
import User from '../src/models/User';
import Customer from '../src/modules/customer/models/Customer';
import Product from '../src/modules/catalog/models/Product';
import Service from '../src/modules/catalog/models/Service';
import Branch from '../src/modules/branch/models/Branch';

describe('Verification Suite: Feedback 7-11 (Bản 2) & 9-11 Fixes', () => {
  let customerToken = '';
  let customerId = '';
  let sampleServiceMedical = null;
  let sampleServiceGrooming = null;
  let sampleBranch = null;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // 1. Verify Sample Data
    sampleBranch = await Branch.findOne({ status: 'ACTIVE' });
    sampleServiceMedical = await Service.findOne({ serviceType: 'MEDICAL', bookingMode: 'BOOKABLE', status: 'ACTIVE' });
    sampleServiceGrooming = await Service.findOne({ serviceType: 'GROOMING', bookingMode: 'BOOKABLE', status: 'ACTIVE' });

    // 2. Ensure Customer User & Customer Record exist
    let user = await User.findOne({ phone: '0905555555' });
    if (!user) {
      user = await User.create({
        username: 'customer',
        phone: '0905555555',
        fullName: 'Lê Văn Cường',
        email: 'customer.levanc@gmail.com',
        systemRole: 'CUSTOMER',
        accountStatus: 'ACTIVE',
        addresses: [
          {
            fullName: 'Lê Văn Cường',
            phone: '0905555555',
            country: 'Việt Nam',
            province: 'Thành phố Hồ Chí Minh',
            provinceCode: '79',
            district: 'Quận 1',
            districtCode: '760',
            ward: 'Phường Bến Nghé',
            wardCode: '26734',
            addressDetail: '123 Lê Lợi',
            fullAddress: '123 Lê Lợi, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh',
            isDefault: true,
          },
        ],
      });
    }

    let customer = await Customer.findOne({ userId: user._id });
    if (!customer) {
      customer = await Customer.create({
        userId: user._id,
        contactPhone: user.phone,
        contactEmail: user.email,
        activationStatus: 'ACTIVATED',
        accountStatus: 'ACTIVE',
        activityBranchIds: sampleBranch ? [sampleBranch._id] : [],
      });
    }
    customerId = customer._id.toString();
  }, 30000);

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('Task 4: Customer Authentication with Canonical Passwords', () => {
    it('allows login with phone 0905555555 and handoff password K9#mQ$8xL!2vW*7z', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: '0905555555',
          password: 'K9#mQ$8xL!2vW*7z',
        });

      expect(res.status).toBe(200);
      expect(res.body.success || res.body.accessToken).toBeTruthy();
      customerToken = res.body.accessToken || res.body.data?.tokens?.accessToken || res.body.data?.accessToken;
      expect(customerToken).toBeDefined();
    });

    it('allows login with backward compatible password cT6$vM2!pL9#zR8&', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: '0905555555',
          password: 'cT6$vM2!pL9#zR8&',
        });

      expect(res.status).toBe(200);
      const token = res.body.accessToken || res.body.data?.tokens?.accessToken;
      expect(token).toBeDefined();
    });
  });

  describe('Task 1 & 6: Catalog Price & Details Formatting (Fixing 0đ Bug)', () => {
    it('returns price > 0 and finalPrice > 0 for all products in list', async () => {
      const res = await request(app).get('/api/v1/products?limit=20');
      expect(res.status).toBe(200);
      const items = res.body.data?.items || res.body.items || [];
      expect(items.length).toBeGreaterThan(0);

      for (const p of items) {
        const pPrice = p.price || p.minPrice;
        const pFinalPrice = p.finalPrice || p.minFinalPrice;
        expect(pPrice).toBeGreaterThan(0);
        expect(pFinalPrice).toBeGreaterThan(0);
        expect(p.sellingPrice).toBeGreaterThan(0);
        expect(p.product_price).toBeGreaterThan(0);
      }
    });

    it('formats variant aliases (title, size, option) and root shipping/review policies', async () => {
      const res = await request(app).get('/api/v1/products?limit=5');
      const items = res.body.data?.items || res.body.items || [];
      const prod = items[0];

      expect(prod.deliveryEstimate).toBe('2 - 4 ngày');
      expect(prod.freeShippingPolicy).toContain('500.000đ');
      expect(prod.ratingDisplay).toBeDefined();
      expect(prod.hasReviews).toBeDefined();

      if (prod.variants && prod.variants.length > 0) {
        const v = prod.variants[0];
        expect(v.title).toBe(v.label);
        expect(v.size).toBe(v.label);
        expect(v.option).toBe(v.label);
        expect(v.price).toBeGreaterThan(0);
      }
    });

    it('returns related and similar products with valid pricing without 0đ', async () => {
      const prodsRes = await request(app).get('/api/v1/products?limit=1');
      const sampleProd = prodsRes.body.data?.items?.[0] || prodsRes.body.items?.[0];
      expect(sampleProd).toBeDefined();
      const prodId = sampleProd.id || sampleProd._id;

      const relatedRes = await request(app).get(`/api/v1/products/${prodId}/related`);
      expect(relatedRes.status).toBe(200);
      const relatedItems = relatedRes.body.items || relatedRes.body.data || [];
      expect(relatedItems.length).toBeGreaterThan(0);
      for (const item of relatedItems) {
        const itemPrice = item.price || item.minPrice || item.sellingPrice;
        const itemFinalPrice = item.finalPrice || item.minFinalPrice || item.sellingPrice;
        expect(itemPrice).toBeGreaterThan(0);
        expect(itemFinalPrice).toBeGreaterThan(0);
        expect(item.sellingPrice).toBeGreaterThan(0);
        expect(item.product_price).toBeGreaterThan(0);
      }

      // Check route aliases
      const similarRes = await request(app).get(`/api/v1/products/${prodId}/similar`);
      expect(similarRes.status).toBe(200);
      const recsRes = await request(app).get(`/api/v1/products/${prodId}/recommendations`);
      expect(recsRes.status).toBe(200);
    });
  });

  describe('Task 2: Service Filtering by serviceType & BOOKABLE', () => {
    it('filters strictly by serviceType=MEDICAL', async () => {
      const res = await request(app).get('/api/v1/services?serviceType=MEDICAL&limit=50');
      expect(res.status).toBe(200);
      const items = res.body.services || res.body.items || [];
      expect(items.length).toBeGreaterThan(0);
      for (const s of items) {
        expect(s.serviceType).toBe('MEDICAL');
        expect(s.bookingMode).toBe('BOOKABLE');
      }
    });

    it('filters strictly by category="Khám & Điều trị" mapping to MEDICAL', async () => {
      const res = await request(app).get('/api/v1/services?category=' + encodeURIComponent('Khám & Điều trị'));
      expect(res.status).toBe(200);
      const items = res.body.services || res.body.items || [];
      expect(items.length).toBeGreaterThan(0);
      for (const s of items) {
        expect(s.serviceType).toBe('MEDICAL');
      }
    });

    it('filters strictly by serviceType=GROOMING', async () => {
      const res = await request(app).get('/api/v1/services?serviceType=GROOMING&limit=50');
      expect(res.status).toBe(200);
      const items = res.body.services || res.body.items || [];
      expect(items.length).toBeGreaterThan(0);
      for (const s of items) {
        expect(s.serviceType).toBe('GROOMING');
        expect(s.bookingMode).toBe('BOOKABLE');
      }
    });

    it('excludes MED06 (phẫu thuật) and MED07 (cấp cứu 24/7) from public booking list', async () => {
      const res = await request(app).get('/api/v1/services?limit=50');
      expect(res.status).toBe(200);
      const items = res.body.services || res.body.items || [];
      const codes = items.map((s) => s.code);
      expect(codes).not.toContain('MED06');
      expect(codes).not.toContain('MED07');
    });
  });

  describe('Task 3: Booking Availability Slot Generation', () => {
    it('returns available slots on future dates without returning empty list', async () => {
      if (!sampleServiceMedical || !sampleBranch) {
        return;
      }

      // Query future date (e.g. 15 days ahead)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const dateStr = futureDate.toISOString().slice(0, 10);

      const res = await request(app)
        .get(`/api/v1/availability?serviceId=${sampleServiceMedical._id}&branchId=${sampleBranch._id}&date=${dateStr}`);

      expect(res.status).toBe(200);
      expect(res.body.slots).toBeDefined();
      expect(Array.isArray(res.body.slots)).toBe(true);
      expect(res.body.slots.length).toBeGreaterThan(0);

      const firstSlot = res.body.slots[0];
      expect(firstSlot.status).toBe('AVAILABLE');
      expect(firstSlot.remaining).toBeGreaterThan(0);
    });
  });

  describe('Task 5: Customer Address Book Population', () => {
    it('returns addresses in getCustomerById', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.addresses).toBeDefined();
      expect(Array.isArray(res.body.addresses)).toBe(true);
      expect(res.body.addresses.length).toBeGreaterThan(0);
      expect(res.body.addresses[0].district).toBe('Quận 1');
      expect(res.body.addresses[0].province).toContain('Hồ Chí Minh');
    });

    it('returns addresses in auth/me for current customer', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      const addresses = res.body.addresses || res.body.data?.addresses;
      expect(addresses).toBeDefined();
      expect(addresses.length).toBeGreaterThan(0);
      expect(addresses[0].fullName).toBe('Lê Văn Cường');
    });
  });
});
