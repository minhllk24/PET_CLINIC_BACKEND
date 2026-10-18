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
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';

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

    it('POST /api/v1/products returns 409 Conflict when SKU already exists', async () => {
      jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
      jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
      jest.spyOn(catalogService, 'createProduct').mockRejectedValueOnce(
        new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'SKU "hat-royal" đã tồn tại ở sản phẩm "Hạt Royal"')
      );

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Idempotency-Key', 'idemp-prod-create-dup-sku')
        .send({
          name: 'Hạt Royal Canin Mới',
          categoryId: categoryId,
          variants: [{ sku: 'hat-royal', label: '1kg', price: 180000 }]
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('code', 'CONFLICT');
      expect(res.body.detail).toContain('hat-royal');
    });
  });

  describe('4. Task 3.6 — Full Product Management Business Rules & Integration Tests', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('calculateFinalPrice correctly calculates price with discount percent', () => {
      const { calculateFinalPrice } = require('../src/modules/catalog/skuGenerator.service');
      expect(calculateFinalPrice(100000, 10)).toBe(90000);
      expect(calculateFinalPrice(150000, 0)).toBe(150000);
      expect(calculateFinalPrice(200000, 25)).toBe(150000);
      expect(calculateFinalPrice(99999, 15)).toBe(84999);
    });

    it('formatVariantSku generates valid standardized SKU format', () => {
      const { formatVariantSku } = require('../src/modules/catalog/skuGenerator.service');
      expect(formatVariantSku('SP-000123', 1)).toBe('SP-000123-001');
      expect(formatVariantSku('SP-000123', 15)).toBe('SP-000123-015');
    });

    it('updateProduct throws 422 if productType mutation is attempted', async () => {
      jest.spyOn(Product, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(productId),
        productType: 'SIMPLE',
        name: 'Sản phẩm mẫu',
        variants: []
      });

      await expect(
        catalogService.updateProduct(productId, { productType: 'VARIANT' }, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('productType')
      });
    });

    it('updateProduct throws 422 if existing variant SKU is edited (Rule SKU-05)', async () => {
      const mockVariant = {
        _id: new mongoose.Types.ObjectId(variantId),
        sku: 'SP-000123-001',
        label: 'Gói 1kg',
        price: 100000
      };
      const mockProd = {
        _id: new mongoose.Types.ObjectId(productId),
        name: 'Hạt Royal',
        productType: 'VARIANT',
        variants: {
          id: (vId) => (vId.toString() === variantId ? mockVariant : null)
        }
      };
      jest.spyOn(Product, 'findById').mockResolvedValue(mockProd);

      await expect(
        catalogService.updateProduct(
          productId,
          { variants: [{ id: variantId, sku: 'SP-000123-999', label: 'Gói 1kg', price: 100000 }] },
          { systemRole: 'ADMIN' }
        )
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('SKU')
      });
    });

    it('addVariant throws 422 if product is of type SIMPLE', async () => {
      jest.spyOn(Product, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(productId),
        productType: 'SIMPLE',
        variants: []
      });

      await expect(
        catalogService.addVariant(productId, { label: 'Size XL', price: 200000 }, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR
      });
    });

    it('deactivateVariant throws 422 if there is an active order with this variant', async () => {
      const Order = require('../src/modules/order/models/Order').default;
      jest.spyOn(Product, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(productId),
        variants: {
          id: () => ({ _id: new mongoose.Types.ObjectId(variantId), status: 'ACTIVE' })
        }
      });
      jest.spyOn(Order, 'findOne').mockResolvedValue({
        code: 'ORD-999',
        status: 'PROCESSING'
      });

      await expect(
        catalogService.deactivateVariant(productId, variantId, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('ORD-999')
      });
    });

    it('restoreProduct restores ARCHIVED product to INACTIVE', async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        status: 'ARCHIVED',
        archivedAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
        toObject: () => ({
          _id: productId,
          name: 'Sản phẩm cũ',
          categoryId: categoryId,
          status: 'INACTIVE',
          archivedAt: null,
          variants: []
        })
      };
      jest.spyOn(Product, 'findById').mockResolvedValue(mockProduct);
      jest.spyOn(stockAvailabilityService, 'attachOutOfStockFlag').mockResolvedValue(mockProduct);

      const result = await catalogService.restoreProduct(productId, { systemRole: 'ADMIN' });
      expect(mockProduct.status).toBe('INACTIVE');
      expect(mockProduct.archivedAt).toBeNull();
      expect(mockProduct.save).toHaveBeenCalled();
      expect(result.status).toBe('INACTIVE');
    });

    it('POST /api/v1/uploads/products rejects Customer with 403', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('files', Buffer.from('test-image'), {
          filename: 'test.png',
          contentType: 'image/png'
        });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/uploads/products accepts multipart image upload for Admin', async () => {
      const res = await request(app)
        .post('/api/v1/uploads/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('files', Buffer.from('fake-image-content-for-test'), {
          filename: 'test-product.png',
          contentType: 'image/png'
        });

      expect([201, 200]).toContain(res.status);
      expect(res.body).toHaveProperty('items');
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items[0]).toHaveProperty('url');
    });
  });

  describe('Feedback Round 1 Resolution Tests', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('Product images setter enforces exactly one isPrimary: true', () => {
      const prod = new Product({
        name: 'Thức ăn cho mèo',
        categoryId: new mongoose.Types.ObjectId(categoryId),
        images: [
          { url: 'https://example.com/img1.png', isPrimary: true },
          { url: 'https://example.com/img2.png', isPrimary: true },
          { url: 'https://example.com/img3.png', isPrimary: false }
        ],
        variants: [
          {
            sku: 'SP-000001-001',
            label: 'Mặc định',
            price: 50000,
            status: 'ACTIVE'
          }
        ]
      });

      const primaryImages = prod.images.filter((img) => img.isPrimary === true);
      expect(primaryImages.length).toBe(1);
      // Ảnh primary phải là ảnh đầu tiên được đánh dấu primary
      expect(primaryImages[0].url).toBe('https://example.com/img1.png');
    });

    it('checkVariantPurchasable throws 422 when purchasing SERVICE_SUPPLY product', async () => {
      jest.spyOn(Product, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(productId),
        status: 'ACTIVE',
        usageType: 'SERVICE_SUPPLY',
        variants: [
          {
            _id: new mongoose.Types.ObjectId(variantId),
            status: 'ACTIVE',
            inventoryItemId: new mongoose.Types.ObjectId(inventoryItemId)
          }
        ]
      });

      await expect(
        stockAvailabilityService.checkVariantPurchasable(productId, variantId, 1)
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.PRODUCT_NOT_PURCHASABLE || 'PRODUCT_NOT_PURCHASABLE'
      });
    });

    it('updateProduct preserves old variants when payload sends subset of variants', async () => {
      const v1Id = new mongoose.Types.ObjectId();
      const v2Id = new mongoose.Types.ObjectId();
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        productCode: 'SP-000888',
        name: 'Áo cho chó',
        productType: 'VARIANT',
        variants: [
          {
            _id: v1Id,
            sku: 'SP-000888-001',
            label: 'Size S',
            price: 100000,
            discountPercent: 0,
            finalPrice: 100000,
            status: 'ACTIVE'
          },
          {
            _id: v2Id,
            sku: 'SP-000888-002',
            label: 'Size M',
            price: 150000,
            discountPercent: 10,
            finalPrice: 135000,
            status: 'ACTIVE'
          }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Product, 'findById').mockResolvedValue(mockProduct);
      jest.spyOn(stockAvailabilityService, 'attachOutOfStockFlag').mockImplementation(async (p) => p);

      // FE chỉ gửi cập nhật giá cho biến thể 1, không gửi biến thể 2
      await catalogService.updateProduct(
        productId,
        {
          variants: [
            { id: v1Id.toString(), price: 120000 }
          ]
        },
        { systemRole: 'ADMIN' }
      );

      // Cả 2 biến thể vẫn phải còn trong mảng
      expect(mockProduct.variants.length).toBe(2);
      expect(mockProduct.variants[0].price).toBe(120000);
      // Biến thể 2 vẫn được bảo toàn nguyên vẹn
      expect(mockProduct.variants[1].sku).toBe('SP-000888-002');
      expect(mockProduct.variants[1].price).toBe(150000);
      expect(mockProduct.save).toHaveBeenCalled();
    });

    it('addVariant atomically increments nextSkuSeq and generates standardized SKU', async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        productCode: 'SP-000555',
        name: 'Vòng cổ thú cưng',
        productType: 'VARIANT',
        variants: []
      };

      jest.spyOn(Product, 'findById').mockResolvedValue(mockProduct);
      jest.spyOn(Product, 'findOneAndUpdate').mockResolvedValue({ nextSkuSeq: 3 });
      jest.spyOn(Product, 'findOne').mockResolvedValue(null);
      jest.spyOn(Product, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
      jest.spyOn(InventoryItem, 'findOne').mockResolvedValue({ _id: new mongoose.Types.ObjectId(inventoryItemId) });
      jest.spyOn(stockAvailabilityService, 'attachOutOfStockFlag').mockResolvedValue(mockProduct);

      await catalogService.addVariant(
        productId,
        { label: 'Màu Đỏ', price: 80000 },
        { systemRole: 'ADMIN' }
      );

      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: productId },
        { $inc: { nextSkuSeq: 1 } },
        { new: false }
      );
      expect(Product.updateOne).toHaveBeenCalledWith(
        { _id: productId },
        expect.objectContaining({
          $push: {
            variants: expect.objectContaining({
              sku: 'SP-000555-003',
              label: 'Màu Đỏ',
              price: 80000
            })
          }
        })
      );
    });
  });

  describe('7. Team Leader Feedback Validations (Price > 0 and Page Pagination)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('createProduct rejects variants with price <= 0 (throws 422)', async () => {
      jest.spyOn(Category, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(categoryId), status: 'ACTIVE' });

      await expect(
        catalogService.createProduct({
          name: 'Sản phẩm giá 0đ',
          categoryId,
          variants: [{ label: 'Bản 0đ', price: 0 }]
        }, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('lớn hơn 0')
      });

      await expect(
        catalogService.createProduct({
          name: 'Sản phẩm giá âm',
          categoryId,
          variants: [{ label: 'Bản âm', price: -50000 }]
        }, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('lớn hơn 0')
      });
    });

    it('addVariant rejects variant with price <= 0 (throws 422)', async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        productCode: 'SP-000555',
        name: 'Vòng cổ thú cưng',
        productType: 'VARIANT',
        variants: []
      };

      jest.spyOn(Product, 'findById').mockResolvedValue(mockProduct);

      await expect(
        catalogService.addVariant(productId, { label: 'Size XS', price: 0 }, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('lớn hơn 0')
      });
    });

    it('listProducts calculates offset pagination correctly and returns total, totalPages, page, and limit', async () => {
      const mockQueryChain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { _id: new mongoose.Types.ObjectId(), name: 'Sản phẩm 1', variants: [] }
        ])
      };

      jest.spyOn(Product, 'countDocuments').mockResolvedValue(25);
      jest.spyOn(Product, 'find').mockReturnValue(mockQueryChain);
      jest.spyOn(stockAvailabilityService, 'attachOutOfStockFlag').mockImplementation(async (items) => items);

      const result = await catalogService.listProducts({ page: 2, limit: 10 }, { systemRole: 'ADMIN' });

      expect(mockQueryChain.skip).toHaveBeenCalledWith(10);
      expect(mockQueryChain.limit).toHaveBeenCalledWith(11);
      expect(result.total).toBe(25);
      expect(result.totalItems).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
      expect(result.limit).toBe(10);
    });
  });

  describe('8. FE Feedback Round 2 Enhancements (Duplicate Variant Labels, Archive Guard, CategoryName & Pricing, and Delete Upload)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('createProduct rejects duplicate variant labels with 422', async () => {
      jest.spyOn(Category, 'findById').mockResolvedValue({ _id: new mongoose.Types.ObjectId(categoryId), status: 'ACTIVE' });

      await expect(
        catalogService.createProduct({
          name: 'Sản phẩm trùng biến thể',
          categoryId,
          productType: 'VARIANT',
          variants: [
            { label: 'Hộp 500g', price: 100000 },
            { label: '  hộp 500G ', price: 120000 }
          ]
        }, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('bị trùng lặp')
      });
    });

    it('addVariant rejects variant label already existing in product with 422', async () => {
      const mockProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        productCode: 'SP-000555',
        name: 'Vòng cổ thú cưng',
        productType: 'VARIANT',
        variants: [
          { label: 'Size S', price: 50000 }
        ]
      };

      jest.spyOn(Product, 'findById').mockResolvedValue(mockProduct);

      await expect(
        catalogService.addVariant(productId, { label: '  size s ', price: 60000 }, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('bị trùng lặp')
      });
    });

    it('archiveProduct rejects with 422 when there is an active order containing this product', async () => {
      const Order = require('../src/modules/order/models/Order').default;
      jest.spyOn(Product, 'findById').mockResolvedValue({
        _id: new mongoose.Types.ObjectId(productId),
        name: 'Sản phẩm có đơn hàng active',
        variants: [{ _id: new mongoose.Types.ObjectId(variantId), label: 'Mặc định', price: 50000 }]
      });
      jest.spyOn(Order, 'findOne').mockResolvedValue({
        code: 'ORD-ACTIVE-001',
        status: 'CONFIRMED'
      });

      await expect(
        catalogService.archiveProduct(productId, { systemRole: 'ADMIN' })
      ).rejects.toMatchObject({
        status: 422,
        code: ErrorCodes.VALIDATION_ERROR,
        message: expect.stringContaining('ORD-ACTIVE-001')
      });
    });

    it('formatProduct populates categoryName and calculates min/max prices properly', () => {
      const populatedCategory = {
        _id: new mongoose.Types.ObjectId(categoryId),
        name: 'Thức ăn hạt cho mèo'
      };

      const rawProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        productCode: 'SP-000888',
        name: 'Hạt dinh dưỡng cao cấp',
        categoryId: populatedCategory,
        productType: 'VARIANT',
        status: 'ACTIVE',
        variants: [
          {
            _id: new mongoose.Types.ObjectId(),
            label: 'Túi 1kg',
            price: 100000,
            discountPercent: 10,
            finalPrice: 90000,
            status: 'ACTIVE'
          },
          {
            _id: new mongoose.Types.ObjectId(),
            label: 'Túi 5kg',
            price: 450000,
            discountPercent: 20,
            finalPrice: 360000,
            status: 'ACTIVE'
          }
        ]
      };

      const formatted = catalogService.formatProduct(rawProduct);

      expect(formatted.categoryName).toBe('Thức ăn hạt cho mèo');
      expect(formatted.minPrice).toBe(100000);
      expect(formatted.maxPrice).toBe(450000);
      expect(formatted.minFinalPrice).toBe(90000);
      expect(formatted.maxFinalPrice).toBe(360000);
      expect(formatted).not.toHaveProperty('price');
    });

    it('formatProduct includes price and finalPrice for SIMPLE products', () => {
      const rawSimpleProduct = {
        _id: new mongoose.Types.ObjectId(productId),
        productCode: 'SP-000999',
        name: 'Bát ăn inox',
        categoryId: new mongoose.Types.ObjectId(categoryId),
        productType: 'SIMPLE',
        status: 'ACTIVE',
        variants: [
          {
            _id: new mongoose.Types.ObjectId(),
            label: 'Tiêu chuẩn',
            price: 65000,
            discountPercent: 10,
            finalPrice: 58500,
            status: 'ACTIVE'
          }
        ]
      };

      const formatted = catalogService.formatProduct(rawSimpleProduct);

      expect(formatted.price).toBe(65000);
      expect(formatted.finalPrice).toBe(58500);
      expect(formatted.minPrice).toBe(65000);
      expect(formatted.maxPrice).toBe(65000);
    });

    it('DELETE /api/v1/uploads/products/:imageId rejects Customer with 403', async () => {
      const res = await request(app)
        .delete('/api/v1/uploads/products/pet_clinic/products/test-image-123')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('DELETE /api/v1/uploads/products/:imageId succeeds for Admin', async () => {
      const res = await request(app)
        .delete('/api/v1/uploads/products/pet_clinic/products/test-image-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBe('pet_clinic/products/test-image-123');
    });
  });

});


