import dotenv from 'dotenv';
import path from 'path';
import request from 'supertest';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

import app from '../src/app.js';

describe('Product Filtering and Consistent Pricing Verification', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  const CATEGORIES = {
    THUC_AN: '6ae1b15cb1d650ca8dafe56c',
    THIET_YEU: '6ae1b15cb1d650ca8dafe56d',
    SUC_KHOE: '6ae1b15db1d650ca8dafe56e',
    DO_CHOI: '6ae1b15db1d650ca8dafe56f',
    PHU_KIEN: '6ae1b15db1d650ca8dafe570'
  };

  test('1. Category filter "Thức ăn" (thuc-an) contains only food/treats, no toys or leashes', async () => {
    const res = await request(app)
      .get(`/api/v1/products?category_id=${CATEGORIES.THUC_AN}&limit=100`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);

    for (const item of res.body.items) {
      const lowerName = item.name.toLowerCase();
      expect(lowerName).not.toMatch(/đồ chơi|chuột cói|dây dắt|yếm ngực|cát vệ sinh/);
      expect(item.categoryId).toBe(CATEGORIES.THUC_AN);
    }
  });

  test('2. Category filter "Đồ chơi" (do-choi) contains only toys, no food or litter', async () => {
    const res = await request(app)
      .get(`/api/v1/products?category_id=${CATEGORIES.DO_CHOI}&limit=50`)
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);

    for (const item of res.body.items) {
      const lowerName = item.name.toLowerCase();
      expect(lowerName).not.toMatch(/thức ăn|pate|cỏ khô/);
      expect(item.categoryId).toBe(CATEGORIES.DO_CHOI);
    }
  });

  test('3. Price range filter 20.000đ - 50.000đ returns only products with card selling price in range', async () => {
    const res = await request(app)
      .get('/api/v1/products?minPrice=20000&maxPrice=50000&limit=50')
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);

    for (const item of res.body.items) {
      const displayPrice = item.sellingPrice || item.salePrice || item.finalPrice || item.price;
      expect(displayPrice).toBeGreaterThanOrEqual(20000);
      expect(displayPrice).toBeLessThanOrEqual(50000);
    }
  });

  test('4. Price range filter 100.000đ - 200.000đ returns strictly products with card selling price in range', async () => {
    const res = await request(app)
      .get('/api/v1/products?minPrice=100000&maxPrice=200000&limit=50')
      .expect(200);

    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);

    for (const item of res.body.items) {
      const displayPrice = item.sellingPrice || item.salePrice || item.finalPrice || item.price;
      expect(displayPrice).toBeGreaterThanOrEqual(100000);
      expect(displayPrice).toBeLessThanOrEqual(200000);
    }
  });

  test('5. Strikethrough originalPrice on card belongs to primary variant, no false high strikethrough', async () => {
    const listRes = await request(app)
      .get('/api/v1/products?q=SP-RC-MINI-001')
      .expect(200);

    expect(listRes.body.items.length).toBeGreaterThan(0);
    const product = listRes.body.items[0];

    // Primary variant is 800g: base price 185,000, final price 175,750 (5% off)
    expect(product.sellingPrice).toBe(175750);
    expect(product.originalPrice).toBe(185000);
    // Should NOT be 1,250,000 (which belongs to 8kg pack)
    expect(product.originalPrice).not.toBe(1250000);
    expect(product.discountPercent).toBe(5);
  });
});
