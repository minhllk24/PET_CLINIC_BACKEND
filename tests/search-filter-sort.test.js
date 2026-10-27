import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import Product from '../src/modules/catalog/models/Product';
import Service from '../src/modules/catalog/models/Service';
import Category from '../src/modules/catalog/models/Category';
import BranchServiceConfig from '../src/modules/branch/models/BranchServiceConfig';
import InventoryStock from '../src/modules/inventory/models/InventoryStock';
import * as searchService from '../src/modules/search/search.service';
import * as catalogService from '../src/modules/catalog/catalog.service';
import * as serviceCatalogService from '../src/modules/catalog/serviceCatalog.service';

describe('Priority P1 – Server-side Search, Filter, Sort & Suggestions Test Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Search Suggestions Guardrails (Real Data Only, No Fake Defaults)', () => {
    it('returns empty suggestions array when input query is empty string', async () => {
      const res = await searchService.getSearchSuggestions({ q: '' });
      expect(res.suggestions).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.query).toBe('');
    });

    it('returns empty suggestions array when input query is only whitespace', async () => {
      const res = await searchService.getSearchSuggestions({ q: '     ' });
      expect(res.suggestions).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.query).toBe('');
    });

    it('returns empty suggestions when input is undefined or null', async () => {
      const res = await searchService.getSearchSuggestions({ q: null });
      expect(res.suggestions).toEqual([]);
      expect(res.total).toBe(0);
    });

    it('fetches real data from Product, Service, and Category when query is provided', async () => {
      const mockService = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439001'),
        name: 'Tắm spa thú cưng',
        code: 'SRV-SPA-01',
        category: 'Grooming',
        serviceType: 'GROOMING',
        basePrice: 200000,
        status: 'ACTIVE'
      };
      const mockProduct = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439002'),
        name: 'Sữa tắm cho chó mèo',
        productCode: 'PROD-BATH-01',
        categoryId: { name: 'Vệ sinh' },
        variants: [{ price: 150000, status: 'ACTIVE' }],
        status: 'ACTIVE'
      };
      const mockCategory = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439003'),
        name: 'Sữa tắm',
        slug: 'sua-tam',
        status: 'ACTIVE'
      };

      const mockExecService = jest.fn().mockResolvedValue([mockService]);
      const mockLeanService = jest.fn().mockReturnValue({ exec: mockExecService });
      const mockLimitService = jest.fn().mockReturnValue({ lean: mockLeanService });
      const mockSelectService = jest.fn().mockReturnValue({ limit: mockLimitService });
      jest.spyOn(Service, 'find').mockReturnValue({ select: mockSelectService });

      const mockExecProduct = jest.fn().mockResolvedValue([mockProduct]);
      const mockLeanProduct = jest.fn().mockReturnValue({ exec: mockExecProduct });
      const mockLimitProduct = jest.fn().mockReturnValue({ lean: mockLeanProduct });
      const mockPopulateProduct = jest.fn().mockReturnValue({ limit: mockLimitProduct });
      const mockSelectProduct = jest.fn().mockReturnValue({ populate: mockPopulateProduct });
      jest.spyOn(Product, 'find').mockReturnValue({ select: mockSelectProduct });

      const mockExecCat = jest.fn().mockResolvedValue([mockCategory]);
      const mockLeanCat = jest.fn().mockReturnValue({ exec: mockExecCat });
      const mockLimitCat = jest.fn().mockReturnValue({ lean: mockLeanCat });
      const mockSelectCat = jest.fn().mockReturnValue({ limit: mockLimitCat });
      jest.spyOn(Category, 'find').mockReturnValue({ select: mockSelectCat });

      const res = await searchService.getSearchSuggestions({ q: 'tam', limit: 10 });
      expect(res.query).toBe('tam');
      expect(res.suggestions.length).toBe(3);

      expect(res.suggestions[0]).toMatchObject({
        keyword: 'Tắm spa thú cưng',
        type: 'service',
        code: 'SRV-SPA-01',
        serviceType: 'GROOMING',
        basePrice: 200000
      });
      expect(res.suggestions[1]).toMatchObject({
        keyword: 'Sữa tắm cho chó mèo',
        type: 'product',
        code: 'PROD-BATH-01',
        price: 150000
      });
      expect(res.suggestions[2]).toMatchObject({
        keyword: 'Sữa tắm',
        type: 'category',
        slug: 'sua-tam'
      });
    });

    it('GET /api/v1/search/suggestions returns empty suggestions array when query is empty', async () => {
      const res = await request(app).get('/api/v1/search/suggestions?q=');
      expect(res.status).toBe(200);
      expect(res.body.suggestions).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('GET /api/v1/search/suggestions returns real data from searchService', async () => {
      jest.spyOn(searchService, 'getSearchSuggestions').mockResolvedValue({
        query: 'meo',
        suggestions: [
          { keyword: 'Cào móng cho mèo', type: 'product', id: '123' }
        ],
        total: 1
      });

      const res = await request(app).get('/api/v1/search/suggestions?q=meo');
      expect(res.status).toBe(200);
      expect(res.body.query).toBe('meo');
      expect(res.body.suggestions[0].keyword).toBe('Cào móng cho mèo');
    });

    it('GET /api/v1/products/suggestions and /api/v1/services/suggestions alias routes respond successfully', async () => {
      jest.spyOn(searchService, 'getSearchSuggestions').mockResolvedValue({
        query: 'tam',
        suggestions: [],
        total: 0
      });

      const resProd = await request(app).get('/api/v1/products/suggestions?q=tam');
      expect(resProd.status).toBe(200);

      const resServ = await request(app).get('/api/v1/services/suggestions?q=tam');
      expect(resServ.status).toBe(200);
    });
  });

  describe('2. Unified Search Route & Service (/api/v1/search)', () => {
    it('unifiedSearch returns combined counts and results when scope=all', async () => {
      jest.spyOn(catalogService, 'listProducts').mockResolvedValue({
        items: [{ id: 'p1', name: 'Product 1' }],
        totalItems: 1,
        totalPages: 1
      });
      jest.spyOn(serviceCatalogService, 'listServices').mockResolvedValue({
        items: [{ id: 's1', name: 'Service 1' }],
        totalItems: 1,
        totalPages: 1
      });

      const res = await searchService.unifiedSearch({ q: 'test', scope: 'all' });
      expect(res.scope).toBe('all');
      expect(res.counts.product).toBe(1);
      expect(res.counts.service).toBe(1);
      expect(res.totalRows).toBe(2);
      expect(res.results.products.length).toBe(1);
      expect(res.results.services.length).toBe(1);
    });

    it('unifiedSearch routes scope=product to listProducts exclusively', async () => {
      const spyProd = jest.spyOn(catalogService, 'listProducts').mockResolvedValue({
        items: [{ id: 'p1', name: 'Product 1' }],
        totalItems: 1,
        totalPages: 1
      });
      const spyServ = jest.spyOn(serviceCatalogService, 'listServices');

      const res = await searchService.unifiedSearch({ q: 'cat', scope: 'product' });
      expect(res.scope).toBe('product');
      expect(spyProd).toHaveBeenCalled();
      expect(spyServ).not.toHaveBeenCalled();
      expect(res.results.length).toBe(1);
    });

    it('GET /api/v1/search invokes unified search endpoint', async () => {
      jest.spyOn(searchService, 'unifiedSearch').mockResolvedValue({
        query: 'grooming',
        scope: 'all',
        totalRows: 0,
        counts: { product: 0, service: 0 },
        results: { products: [], services: [] }
      });

      const res = await request(app).get('/api/v1/search?q=grooming');
      expect(res.status).toBe(200);
      expect(res.body.query).toBe('grooming');
    });
  });

  describe('3. Product Server-Side Filter & Sort Consistency', () => {
    it('supports multiple categoryIds split by comma and multi-price filtering', async () => {
      const catId1 = new mongoose.Types.ObjectId();
      const catId2 = new mongoose.Types.ObjectId();

      let capturedQuery = null;
      jest.spyOn(Product, 'countDocuments').mockImplementation((q) => {
        capturedQuery = q;
        return Promise.resolve(5);
      });
      jest.spyOn(Product, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      await catalogService.listProducts({
        categoryId: `${catId1.toString()},${catId2.toString()}`,
        minPrice: 50000,
        maxPrice: 200000,
        page: 1,
        limit: 10
      });

      expect(capturedQuery).toBeDefined();
      expect(capturedQuery.categoryId).toHaveProperty('$in');
      expect(capturedQuery['variants.price']).toEqual({ $gte: 50000, $lte: 200000 });
    });

    it('applies inStockOnly filter completely at DB level with $elemMatch active items', async () => {
      const activeItemId = new mongoose.Types.ObjectId();
      jest.spyOn(InventoryStock, 'aggregate').mockResolvedValue([
        { _id: activeItemId, totalQty: 10 }
      ]);

      let capturedQuery = null;
      jest.spyOn(Product, 'countDocuments').mockImplementation((q) => {
        capturedQuery = q;
        return Promise.resolve(1);
      });
      jest.spyOn(Product, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      await catalogService.listProducts({
        inStockOnly: true,
        limit: 20
      });

      expect(capturedQuery.variants).toEqual({
        $elemMatch: {
          inventoryItemId: { $in: [activeItemId] },
          status: 'ACTIVE'
        }
      });
    });

    it('applies correct sort criteria for PRICE_ASC, PRICE_DESC, NAME_ASC, NAME_DESC, NEWEST', async () => {
      let capturedSort = null;
      jest.spyOn(Product, 'find').mockReturnValue({
        sort: jest.fn().mockImplementation((criteria) => {
          capturedSort = criteria;
          return {
            skip: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([])
          };
        })
      });

      await catalogService.listProducts({ sort: 'PRICE_ASC' });
      expect(capturedSort).toEqual({ 'variants.price': 1, _id: 1 });

      await catalogService.listProducts({ sort: 'PRICE_DESC' });
      expect(capturedSort).toEqual({ 'variants.price': -1, _id: -1 });

      await catalogService.listProducts({ sort: 'NAME_ASC' });
      expect(capturedSort).toEqual({ name: 1, _id: 1 });

      await catalogService.listProducts({ sort: 'NEWEST' });
      expect(capturedSort).toEqual({ createdAt: -1, _id: -1 });
    });
  });

  describe('4. Service Server-Side Filter & Sort Consistency (Pre-Pagination Availability)', () => {
    it('pre-filters services at DB level by branchId and isAvailable=true BEFORE pagination', async () => {
      const branchId = new mongoose.Types.ObjectId();
      const enabledServiceId = new mongoose.Types.ObjectId();

      jest.spyOn(BranchServiceConfig, 'find').mockReturnValue({
        select: jest.fn().mockResolvedValue([{ serviceId: enabledServiceId }])
      });

      let capturedFilter = null;
      jest.spyOn(Service, 'countDocuments').mockImplementation((f) => {
        capturedFilter = f;
        return Promise.resolve(1);
      });
      jest.spyOn(Service, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      await serviceCatalogService.listServices({
        branchId: branchId.toString(),
        isAvailable: true,
        page: 1,
        limit: 10
      });

      expect(capturedFilter).toBeDefined();
      expect(capturedFilter._id).toEqual({ $in: [enabledServiceId] });
    });

    it('pre-filters services at DB level by branchId and isAvailable=false BEFORE pagination', async () => {
      const branchId = new mongoose.Types.ObjectId();
      const enabledServiceId = new mongoose.Types.ObjectId();

      jest.spyOn(BranchServiceConfig, 'find').mockReturnValue({
        select: jest.fn().mockResolvedValue([{ serviceId: enabledServiceId }])
      });

      let capturedFilter = null;
      jest.spyOn(Service, 'countDocuments').mockImplementation((f) => {
        capturedFilter = f;
        return Promise.resolve(1);
      });
      jest.spyOn(Service, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });

      await serviceCatalogService.listServices({
        branchId: branchId.toString(),
        isAvailable: false,
        page: 1,
        limit: 10
      });

      expect(capturedFilter).toBeDefined();
      expect(capturedFilter._id).toEqual({ $nin: [enabledServiceId] });
    });

    it('supports sorting services by PRICE_ASC, PRICE_DESC, DURATION_ASC, NAME_ASC', async () => {
      let capturedSort = null;
      jest.spyOn(Service, 'find').mockReturnValue({
        sort: jest.fn().mockImplementation((criteria) => {
          capturedSort = criteria;
          return {
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue([])
          };
        })
      });

      await serviceCatalogService.listServices({ sort: 'PRICE_ASC' });
      expect(capturedSort).toEqual({ basePrice: 1, _id: 1 });

      await serviceCatalogService.listServices({ sort: 'PRICE_DESC' });
      expect(capturedSort).toEqual({ basePrice: -1, _id: -1 });

      await serviceCatalogService.listServices({ sort: 'DURATION_ASC' });
      expect(capturedSort).toEqual({ durationMinutes: 1, _id: 1 });

      await serviceCatalogService.listServices({ sort: 'NAME_ASC' });
      expect(capturedSort).toEqual({ name: 1, _id: 1 });
    });
  });
});
