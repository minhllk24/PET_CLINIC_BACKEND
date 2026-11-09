import dotenv from 'dotenv';
import path from 'path';
import request from 'supertest';
import mongoose from 'mongoose';

// Ensure we connect to actual Atlas database during integration verification
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

import app from '../src/app.js';
import Product from '../src/modules/catalog/models/Product.js';

describe('Verification of 30 Products with Authentic 3-Variant Images', () => {
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

  const targetCodes = [
    'SP-RC-MINI-001', 'SP-WHISKAS-002', 'SP-CATURE-003', 'SP-BRAVECTO-004',
    'SP-SOS-SHAMPOO-005', 'SP-KONG-TOY-006', 'SP-ALFALFA-007', 'SP-RIO-BIRD-008',
    'SP-GIMCAT-009', 'SP-PETBED-010', 'SP-LEASH-011', 'SP-CATTOY-012',
    'SP-LEG-001', 'SP-LEG-002', 'SP-LEG-003', 'SP-LEG-004', 'SP-LEG-005',
    'SP-LEG-006', 'SP-LEG-007', 'SP-LEG-008', 'SP-LEG-009', 'SP-LEG-010',
    'SP-LEG-011', 'SP-LEG-012', 'SP-LEG-013', 'SP-LEG-014', 'SP-LEG-015',
    'SP-LEG-016', 'SP-LEG-017', 'SP-LEG-018', 'SP-LEG-019', 'SP-LEG-086', 'SP-LEG-097'
  ];

  test('All target products exist in database and are ACTIVE', async () => {
    const prods = await Product.find({ productCode: { $in: targetCodes } }).lean();
    expect(prods.length).toBeGreaterThanOrEqual(30);

    for (const p of prods) {
      expect(p.status).toBe('ACTIVE');
      expect(p.productType).toBe('VARIANT');
    }
  });

  test('Every target product has 3 authentic variant images and zero Unsplash URLs', async () => {
    const prods = await Product.find({ productCode: { $in: targetCodes } }).lean();

    for (const p of prods) {
      // 1. Must have at least 3 variants
      expect(p.variants.length).toBeGreaterThanOrEqual(3);

      // 2. Variants must have distinct images
      const varImages = p.variants.map(v => v.image || v.imageUrl).filter(Boolean);
      expect(varImages.length).toBeGreaterThanOrEqual(3);

      const distinctImages = new Set(varImages);
      expect(distinctImages.size).toBeGreaterThanOrEqual(3);

      // 3. No Unsplash images
      for (const imgUrl of varImages) {
        expect(imgUrl).not.toContain('unsplash.com');
        expect(imgUrl.startsWith('http')).toBe(true);
      }

      // 4. Main gallery images must also not have Unsplash
      const galleryUrls = (p.images || []).map(img => typeof img === 'string' ? img : img.url);
      expect(galleryUrls.length).toBeGreaterThanOrEqual(3);
      for (const gUrl of galleryUrls) {
        expect(gUrl).not.toContain('unsplash.com');
      }
    }
  });

  test('GET /api/v1/products returns valid thumbnail, images, and variant imageUrls', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .query({ limit: 50 });

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;
    const items = body.items || body;
    expect(Array.isArray(items)).toBe(true);

    const targetItems = items.filter(i => targetCodes.includes(i.productCode));
    expect(targetItems.length).toBeGreaterThanOrEqual(1);

    for (const item of targetItems) {
      expect(item.thumbnail).toBeTruthy();
      expect(item.thumbnail).not.toContain('unsplash.com');
      expect(item.thumbnailUrl).toBeTruthy();
      expect(item.images.length).toBeGreaterThanOrEqual(3);
      expect(item.variants.length).toBeGreaterThanOrEqual(3);

      for (const v of item.variants) {
        expect(v.image).toBeTruthy();
        expect(v.imageUrl).toBeTruthy();
        expect(v.image).not.toContain('unsplash.com');
      }
    }
  });

  test('GET /api/v1/products/:id returns full detail with 3 distinct variant images', async () => {
    const sample = await Product.findOne({ productCode: 'SP-RC-MINI-001' }).lean();
    expect(sample).toBeTruthy();

    const res = await request(app)
      .get(`/api/v1/products/${sample._id}`);

    expect(res.status).toBe(200);
    const detail = res.body.data || res.body;

    expect(detail.productCode).toBe('SP-RC-MINI-001');
    expect(detail.thumbnail).toBeTruthy();
    expect(detail.images.length).toBe(3);
    expect(detail.variants.length).toBe(3);

    const variantImages = detail.variants.map(v => v.imageUrl);
    const distinctSet = new Set(variantImages);
    expect(distinctSet.size).toBe(3);

    for (const v of detail.variants) {
      expect(v.price).toBeGreaterThan(0);
      expect(v.finalPrice).toBeGreaterThan(0);
      expect(v.sku).toMatch(/^SP-RC-MINI-001-\d{2}$/);
    }
  });
});
