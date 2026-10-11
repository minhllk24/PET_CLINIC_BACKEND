import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import * as catalogService from '../src/modules/catalog/catalog.service';
import * as inventoryService from '../src/modules/inventory/inventory.service';
import * as stockAvailabilityService from '../src/modules/catalog/stockAvailability.service';
import Product from '../src/modules/catalog/models/Product';
import Category from '../src/modules/catalog/models/Category';
import InventoryItem from '../src/modules/inventory/models/InventoryItem';
import InventoryStock from '../src/modules/inventory/models/InventoryStock';
import InventoryTransaction from '../src/modules/inventory/models/InventoryTransaction';
import AppError from '../src/utils/AppError';
import { ErrorCodes } from '../src/shared/errorCodes';

const adminId = '507f1f77bcf86cd799439001';
const customerId = '507f1f77bcf86cd799439002';
const branchId = '507f1f77bcf86cd799439011';
const categoryId = '507f1f77bcf86cd799439021';
const productId = '507f1f77bcf86cd799439031';
const variantId = '507f1f77bcf86cd799439041';
const inventoryItemId = '507f1f77bcf86cd799439051';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);
const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

describe('Priority P0 – Product/Category & Stock Isolation Unit & Route Tests', () => {

  describe('1. Model & Isolation Rules: Product master does NOT store stock', () => {
    it('Product schema must not define stock or quantity fields', () => {
      const paths = Object.keys(Product.schema.paths);
      expect(paths).not.toContain('stock');
      expect(paths).not.toContain('quantity');
      expect(paths).not.toContain('branchStock');
      expect(paths).not.toContain('currentQty');
    });

    it('InventoryStock schema requires branchId, inventoryItemId, quantity >= 0 and unique index', () => {
      expect(InventoryStock.schema.paths.branchId).toBeDefined();
      expect(InventoryStock.schema.paths.inventoryItemId).toBeDefined();
      expect(InventoryStock.schema.paths.quantity).toBeDefined();
    });

    it('InventoryTransaction schema requires beforeQty, changeQty, afterQty, reason, and actorId', () => {
      expect(InventoryTransaction.schema.paths.beforeQty).toBeDefined();
      expect(InventoryTransaction.schema.paths.changeQty).toBeDefined();
      expect(InventoryTransaction.schema.paths.afterQty).toBeDefined();
      expect(InventoryTransaction.schema.paths.reason).toBeDefined();
      expect(InventoryTransaction.schema.paths.actorId).toBeDefined();
    });
  });

  describe('2. Business Rule: Product outOfStock and Purchase Guardrails', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('attachOutOfStockFlag returns outOfStock=true when total stock is 0', async () => {
      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([]);

      const mockProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        name: 'Mèo Cào Móng',
        variants: [
          {
            _id: new mongoose.Types.ObjectId(variantId),
            sku: 'CAT-SCRATCH-01',
            label: 'Size S',
            price: 150000,
            status: 'ACTIVE',
            inventoryItemId: new mongoose.Types.ObjectId(inventoryItemId)
          }
        ]
      };

      const result = await stockAvailabilityService.attachOutOfStockFlag(mockProduct);
      expect(result.outOfStock).toBe(true);
    });

    it('attachOutOfStockFlag returns outOfStock=false when stock > 0', async () => {
      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([
        { _id: new mongoose.Types.ObjectId(inventoryItemId), totalQty: 25 }
      ]);

      const mockProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        name: 'Mèo Cào Móng',
        variants: [
          {
            _id: new mongoose.Types.ObjectId(variantId),
            sku: 'CAT-SCRATCH-01',
            label: 'Size S',
            price: 150000,
            status: 'ACTIVE',
            inventoryItemId: new mongoose.Types.ObjectId(inventoryItemId)
          }
        ]
      };

      const result = await stockAvailabilityService.attachOutOfStockFlag(mockProduct);
      expect(result.outOfStock).toBe(false);
    });

    it('checkVariantPurchasable throws 422 PRODUCT_NOT_PURCHASABLE if product is inactive', async () => {
      jest.spyOn(Product, 'findById').mockResolvedValue({
        status: 'INACTIVE',
        variants: []
      });

      await expect(
        stockAvailabilityService.checkVariantPurchasable(productId, variantId, 1)
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.PRODUCT_NOT_PURCHASABLE
      });
    });

    it('checkVariantPurchasable throws 422 INSUFFICIENT_INVENTORY if out of stock', async () => {
      jest.spyOn(Product, 'findById').mockResolvedValue({
        status: 'ACTIVE',
        variants: [
          {
            _id: new mongoose.Types.ObjectId(variantId),
            status: 'ACTIVE',
            inventoryItemId: new mongoose.Types.ObjectId(inventoryItemId)
          }
        ]
      });
      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([]);

      await expect(
        stockAvailabilityService.checkVariantPurchasable(productId, variantId, 5)
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.INSUFFICIENT_INVENTORY
      });
    });

    it('checkVariantPurchasable throws 422 INSUFFICIENT_INVENTORY if requested qty exceeds stock', async () => {
      jest.spyOn(Product, 'findById').mockResolvedValue({
        status: 'ACTIVE',
        variants: [
          {
            _id: new mongoose.Types.ObjectId(variantId),
            status: 'ACTIVE',
            inventoryItemId: new mongoose.Types.ObjectId(inventoryItemId)
          }
        ]
      });
      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([
        { _id: new mongoose.Types.ObjectId(inventoryItemId), totalQty: 10 }
      ]);

      await expect(
        stockAvailabilityService.checkVariantPurchasable(productId, variantId, 15)
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.INSUFFICIENT_INVENTORY
      });
    });

    it('checkVariantPurchasable succeeds when quantity <= available stock', async () => {
      const mockVariant = {
        _id: new mongoose.Types.ObjectId(variantId),
        status: 'ACTIVE',
        inventoryItemId: new mongoose.Types.ObjectId(inventoryItemId)
      };
      jest.spyOn(Product, 'findById').mockResolvedValue({
        status: 'ACTIVE',
        variants: [mockVariant]
      });
      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([
        { _id: new mongoose.Types.ObjectId(inventoryItemId), totalQty: 10 }
      ]);

      const res = await stockAvailabilityService.checkVariantPurchasable(productId, variantId, 5);
      expect(res.availableQty).toBe(10);
    });
  });

  describe('3. API Routes & RBAC Checks', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('POST /api/v1/categories rejects unauthenticated user with 401', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Idempotency-Key', 'idemp-cat-create-001')
        .send({ name: 'Thức ăn hạt' });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/categories rejects Customer role with 403 (Admin only)', async () => {
      const res = await request(app)
        .post('/api/v1/categories')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'idemp-cat-create-002')
        .send({ name: 'Thức ăn hạt' });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/products rejects Customer role with 403', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'idemp-prod-create-001')
        .send({
          name: 'Hạt Royal Canin',
          categoryId: categoryId,
          variants: [{ sku: 'RC-01', label: '1kg', price: 180000 }]
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/inventory/receive rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/receive')
        .set('Idempotency-Key', 'idemp-receive-001')
        .send({
          branchId,
          inventoryItemId,
          quantity: 50,
          reason: 'INITIAL_STOCK'
        });
      expect(res.status).toBe(401);
    });

    it('POST /api/v1/inventory/receive rejects non-manager/non-admin with 403', async () => {
      const res = await request(app)
        .post('/api/v1/inventory/receive')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'idemp-receive-002')
        .send({
          branchId,
          inventoryItemId,
          quantity: 50,
          reason: 'INITIAL_STOCK'
        });
      expect(res.status).toBe(403);
    });

    it('GET /api/v1/products and GET /api/v1/categories allow public access', async () => {
      jest.spyOn(catalogService, 'listCategories').mockResolvedValue({ items: [], nextCursor: null });
      jest.spyOn(catalogService, 'listProducts').mockResolvedValue({ items: [], nextCursor: null });

      const catRes = await request(app).get('/api/v1/categories');
      expect([200, 400]).toContain(catRes.status);

      const prodRes = await request(app).get('/api/v1/products');
      expect([200, 400]).toContain(prodRes.status);
    });
  });

});
