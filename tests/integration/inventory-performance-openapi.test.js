import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import config from '../../src/shared/config';
import User from '../../src/models/User';
import Branch from '../../src/modules/branch/models/Branch';
import InventoryItem from '../../src/modules/inventory/models/InventoryItem';
import InventoryStock from '../../src/modules/inventory/models/InventoryStock';
import InventoryTransaction from '../../src/modules/inventory/models/InventoryTransaction';
import Product from '../../src/modules/catalog/models/Product';
import Category from '../../src/modules/catalog/models/Category';
import { listInventoryItems, listStocks } from '../../src/modules/inventory/inventory.service';

const oid = () => new mongoose.Types.ObjectId();

const makeQuery = (rows) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(rows),
  then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject),
});

describe('Inventory OpenAPI bulk limits & parallel query optimization', () => {
  const adminId = oid();
  const branchA = oid();
  const branchB = oid();
  const catId = oid();
  const productId = oid();
  const variantId = oid();
  const item1Id = oid();
  const item2Id = oid();
  const item3Id = oid();

  const adminToken = jwt.sign(
    {
      id: adminId.toString(),
      systemRole: 'ADMIN',
      assignedBranchIds: [],
      authorizedBranchIds: [],
    },
    config.jwt.accessSecret,
    { expiresIn: '1h' }
  );

  const authHeader = `Bearer ${adminToken}`;

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockReturnValue(
      makeQuery({
        _id: adminId,
        systemRole: 'ADMIN',
        staffSubRole: null,
        assignedBranchIds: [],
        accountStatus: 'ACTIVE',
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('accepts OpenAPI bulk limits and filter params on /api/v1/inventory/items (limit=500, limit=1000, kind, status, search, forServiceMaterial)', async () => {
    const productFindChain = makeQuery([
      {
        _id: productId,
        name: 'Royal Canin',
        productType: 'VARIABLE',
        usageType: 'SALE',
        categoryId: catId,
        variants: [{ _id: variantId, label: '2kg', inventoryItemId: item1Id }],
      },
    ]);

    jest.spyOn(InventoryItem, 'find').mockImplementation(() =>
      makeQuery([
        { _id: item1Id, sku: 'RC-2KG', name: 'Royal Canin 2kg', kind: 'PRODUCT', unit: 'bao', status: 'ACTIVE' },
        { _id: item2Id, sku: 'MAT-01', name: 'Băng gạc', kind: 'MATERIAL', unit: 'cuộn', status: 'ACTIVE', usageType: 'SERVICE_SUPPLY' },
      ])
    );
    jest.spyOn(Product, 'find').mockReturnValue(productFindChain);
    jest.spyOn(Category, 'find').mockImplementation(() => makeQuery([{ _id: catId, name: 'Thức ăn chó' }]));

    const res500 = await request(app)
      .get('/api/v1/inventory/items?limit=500&kind=PRODUCT&status=ACTIVE&search=Royal')
      .set('Authorization', authHeader);

    expect(res500.status).toBe(200);
    expect(productFindChain.populate).not.toHaveBeenCalled();
    expect(res500.body.items).toHaveLength(2);
    expect(res500.body.items[0]).toMatchObject({
      sku: 'RC-2KG',
      categoryName: 'Thức ăn chó',
      productId: productId.toString(),
      productName: 'Royal Canin',
      variantId: variantId.toString(),
      variantName: '2kg',
    });

    const res1000 = await request(app)
      .get('/api/v1/inventory/items?limit=1000&forServiceMaterial=true')
      .set('Authorization', authHeader);

    expect(res1000.status).toBe(200);
    expect(res1000.body.items).toHaveLength(2);
  });

  it('accepts OpenAPI bulk limits on /api/v1/inventory/stocks (limit=1000, limit=2000) and /transactions (limit=500)', async () => {
    jest.spyOn(Branch, 'find').mockImplementation(() => makeQuery([{ _id: branchA }, { _id: branchB }]));
    jest.spyOn(InventoryItem, 'find').mockImplementation(() => makeQuery([{ _id: item1Id }, { _id: item2Id }, { _id: item3Id }]));
    jest.spyOn(InventoryStock, 'find').mockImplementation(() =>
      makeQuery([
        {
          branchId: branchA,
          inventoryItemId: item1Id,
          quantity: 12,
          lowStockThreshold: 5,
          thresholdConfigured: true,
          version: 1,
        },
      ])
    );
    jest.spyOn(InventoryTransaction, 'find').mockImplementation(() => makeQuery([]));

    const stockRes = await request(app)
      .get('/api/v1/inventory/stocks?limit=2000')
      .set('Authorization', authHeader);

    expect(stockRes.status).toBe(200);
    expect(stockRes.body.items).toHaveLength(6);
    expect(stockRes.body.nextCursor).toBeNull();

    const txRes = await request(app)
      .get('/api/v1/inventory/transactions?limit=500')
      .set('Authorization', authHeader);

    expect(txRes.status).toBe(200);
    expect(txRes.body.items).toEqual([]);
  });

  it('listStocks mathematically slices branch x item combinations across cursors and filters lowStock=true', async () => {
    const sortedBranches = [branchA, branchB].sort((a, b) => a.toString().localeCompare(b.toString()));
    jest.spyOn(Branch, 'find').mockImplementation(() => makeQuery(sortedBranches.map((id) => ({ _id: id }))));
    jest.spyOn(InventoryItem, 'find').mockImplementation(() => makeQuery([{ _id: item1Id }, { _id: item2Id }]));
    jest.spyOn(InventoryStock, 'find').mockImplementation(() =>
      makeQuery([
        {
          branchId: sortedBranches[0],
          inventoryItemId: item1Id,
          quantity: 2,
          lowStockThreshold: 5,
          thresholdConfigured: true,
          version: 1,
        },
        {
          branchId: sortedBranches[0],
          inventoryItemId: item2Id,
          quantity: 15,
          lowStockThreshold: 5,
          thresholdConfigured: true,
          version: 1,
        },
        {
          branchId: sortedBranches[1],
          inventoryItemId: item1Id,
          quantity: 30,
          lowStockThreshold: 5,
          thresholdConfigured: true,
          version: 1,
        },
        {
          branchId: sortedBranches[1],
          inventoryItemId: item2Id,
          quantity: 20,
          lowStockThreshold: 5,
          thresholdConfigured: true,
          version: 1,
        },
      ])
    );

    const adminActor = { id: adminId.toString(), systemRole: 'ADMIN', assignedBranchIds: [], authorizedBranchIds: [] };
    const page1 = await listStocks({ limit: 2 }, adminActor);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBe('2');

    const page2 = await listStocks({ limit: 2, cursor: page1.nextCursor }, adminActor);
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeNull();
    expect(page2.items[1].quantity).toBe(20);

    const lowPage = await listStocks({ limit: 10, lowStock: true }, adminActor);
    expect(lowPage.items).toHaveLength(1);
    expect(lowPage.items[0]).toMatchObject({
      branchId: sortedBranches[0].toString(),
      inventoryItemId: item1Id.toString(),
      lowStock: true,
    });
  });

  it('listInventoryItems joins default fallback categoryName/usageType when product link is absent', async () => {
    jest.spyOn(InventoryItem, 'find').mockImplementation(() =>
      makeQuery([
        { _id: item3Id, sku: 'MAT-02', name: 'Bơm tiêm', kind: 'MATERIAL', unit: 'cái', status: 'ACTIVE' },
      ])
    );
    jest.spyOn(Product, 'find').mockImplementation(() => makeQuery([]));
    jest.spyOn(Category, 'find').mockImplementation(() => makeQuery([]));

    const result = await listInventoryItems({ limit: 1000 }, { id: adminId.toString(), systemRole: 'ADMIN', assignedBranchIds: [] });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: item3Id.toString(),
        categoryName: 'Vật tư thú y',
        usageType: 'SERVICE_SUPPLY',
        productId: null,
      }),
    ]);
    expect(result.nextCursor).toBeNull();
  });
});

