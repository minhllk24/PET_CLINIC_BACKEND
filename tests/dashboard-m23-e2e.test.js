import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import request from 'supertest';

dotenv.config({ path: path.join(__dirname, '../.env'), override: true });

import app from '../src/app.js';
import config from '../src/shared/config.js';
import User from '../src/models/User.js';
import Branch from '../src/modules/branch/models/Branch.js';
import Category from '../src/modules/catalog/models/Category.js';
import Product from '../src/modules/catalog/models/Product.js';
import Service from '../src/modules/catalog/models/Service.js';
import StaffProfile from '../src/modules/staff/models/StaffProfile.js';
import Customer from '../src/modules/customer/models/Customer.js';
import GuestContact from '../src/modules/customer/models/GuestContact.js';
import InventoryItem from '../src/modules/inventory/models/InventoryItem.js';
import InventoryStock from '../src/modules/inventory/models/InventoryStock.js';
import Order from '../src/modules/order/models/Order.js';
import OrderReturn from '../src/modules/order/models/OrderReturn.js';
import OrderRefund from '../src/modules/order/models/OrderRefund.js';
import Appointment from '../src/modules/booking/models/Appointment.js';

const signToken = (user) => jwt.sign(
  {
    id: user._id.toString(),
    systemRole: user.systemRole,
    staffSubRole: user.staffSubRole || null,
    assignedBranchIds: (user.assignedBranchIds || []).map((b) => b.toString()),
    authorizedBranchIds: (user.assignedBranchIds || []).map((b) => b.toString()),
  },
  config.jwt.accessSecret,
  { expiresIn: '1h' }
);

const vnIso = (ymd, hhmmss = '10:00:00') => new Date(`${ymd}T${hhmmss}.000+07:00`);

describe('M23 Admin Dashboard Real MongoDB + Supertest HTTP E2E Suite (UAT-01..UAT-18)', () => {
  jest.setTimeout(90000);

  const tag = `M23E2E_${Date.now()}`;
  const createdIds = {
    branches: [],
    users: [],
    categories: [],
    products: [],
    services: [],
    staffProfiles: [],
    customers: [],
    guests: [],
    inventoryItems: [],
    orders: [],
    orderReturns: [],
    orderRefunds: [],
    appointments: [],
  };

  let brQ1;
  let brQ7;
  let brBT;

  let adminUser;
  let mgrQ1User;
  let mgrDualUser;
  let mgrEmptyUser;
  let staffUser;
  let cust1User;
  let cust2User;

  let adminToken;
  let mgrQ1Token;
  let mgrDualToken;
  let mgrEmptyToken;
  let staffToken;
  let custToken;

  let cust1Profile;
  let cust2Profile;
  let guestContact;
  let staffProfile;
  let svcMed;
  let svcGroom;

  let prodWithVariantImg;
  let prodPrimaryFallback;
  let matSupply;
  let invUnconfigured;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }

    // Create 3 isolated test branches
    [brQ1, brQ7, brBT] = await Branch.insertMany([
      { code: `${tag}_Q1`, name: `${tag} Quận 1`, address: 'Q1 Test', phone: '0281111001', status: 'ACTIVE' },
      { code: `${tag}_Q7`, name: `${tag} Quận 7`, address: 'Q7 Test', phone: '0281111002', status: 'ACTIVE' },
      { code: `${tag}_BT`, name: `${tag} Bình Thạnh`, address: 'BT Test', phone: '0281111003', status: 'ACTIVE' },
    ]);
    createdIds.branches.push(brQ1._id, brQ7._id, brBT._id);

    // Create isolated Users with distinct RBAC profiles
    const phoneBase = String(Math.floor(100000 + Math.random() * 800000));
    [adminUser, mgrQ1User, mgrDualUser, mgrEmptyUser, staffUser, cust1User, cust2User] = await User.insertMany([
      { username: `${tag}_admin`, fullName: 'M23 Admin', email: `${tag}_admin@test.local`, systemRole: 'ADMIN', accountStatus: 'ACTIVE', passwordHash: 'x' },
      { username: `${tag}_mgr1`, fullName: 'M23 Mgr Q1', email: `${tag}_mgr1@test.local`, systemRole: 'MANAGER', assignedBranchIds: [brQ1._id], accountStatus: 'ACTIVE', passwordHash: 'x' },
      { username: `${tag}_mgrdual`, fullName: 'M23 Mgr Dual', email: `${tag}_mgrdual@test.local`, systemRole: 'MANAGER', assignedBranchIds: [brQ1._id, brQ7._id], accountStatus: 'ACTIVE', passwordHash: 'x' },
      { username: `${tag}_mgrempty`, fullName: 'M23 Mgr Empty', email: `${tag}_mgrempty@test.local`, systemRole: 'MANAGER', assignedBranchIds: [], accountStatus: 'ACTIVE', passwordHash: 'x' },
      { username: `${tag}_staff`, fullName: 'M23 Staff', email: `${tag}_staff@test.local`, systemRole: 'STAFF', staffSubRole: 'VETERINARIAN', assignedBranchIds: [brQ1._id], accountStatus: 'ACTIVE', passwordHash: 'x' },
      { username: `${tag}_cust1`, fullName: 'Khách Thành Viên 1', phone: `0901${phoneBase}`, email: `${tag}_c1@test.local`, systemRole: 'CUSTOMER', accountStatus: 'ACTIVE', passwordHash: 'x' },
      { username: `${tag}_cust2`, fullName: 'Khách Thành Viên 2', phone: `0902${phoneBase}`, email: `${tag}_c2@test.local`, systemRole: 'CUSTOMER', accountStatus: 'ACTIVE', passwordHash: 'x' },
    ]);
    createdIds.users.push(
      adminUser._id, mgrQ1User._id, mgrDualUser._id, mgrEmptyUser._id, staffUser._id, cust1User._id, cust2User._id
    );

    adminToken = signToken(adminUser);
    mgrQ1Token = signToken(mgrQ1User);
    mgrDualToken = signToken(mgrDualUser);
    mgrEmptyToken = signToken(mgrEmptyUser);
    staffToken = signToken(staffUser);
    custToken = signToken(cust1User);

    [cust1Profile, cust2Profile] = await Customer.insertMany([
      { userId: cust1User._id, contactPhone: cust1User.phone, contactEmail: cust1User.email, activationStatus: 'ACTIVATED', accountStatus: 'ACTIVE' },
      { userId: cust2User._id, contactPhone: cust2User.phone, contactEmail: cust2User.email, activationStatus: 'ACTIVATED', accountStatus: 'ACTIVE' },
    ]);
    createdIds.customers.push(cust1Profile._id, cust2Profile._id);

    guestContact = await GuestContact.create({ fullName: 'Guest M23 E2E', phone: `0908${phoneBase}`, email: `${tag}_g@test.local` });
    createdIds.guests.push(guestContact._id);

    staffProfile = await StaffProfile.create({
      userId: staffUser._id,
      staffCode: `${tag}_STF`,
      staffSubRole: 'VETERINARIAN',
      authorizedBranchIds: [brQ1._id, brQ7._id, brBT._id],
      homeBranchId: brQ1._id,
    });
    createdIds.staffProfiles.push(staffProfile._id);

    // Catalog: Category, InventoryItems, Products, Services, InventoryStocks
    const cat = await Category.create({ name: `${tag} Food`, slug: `${tag.toLowerCase()}-food`, status: 'ACTIVE' });
    createdIds.categories.push(cat._id);

    const [invA, invB, invMat, invUnconf] = await InventoryItem.insertMany([
      { sku: `${tag}-SKU-A`, name: `${tag} Royal Canin A`, kind: 'PRODUCT', unit: 'Bao', usageType: 'SALE', status: 'ACTIVE' },
      { sku: `${tag}-SKU-B`, name: `${tag} Pate Mèo B`, kind: 'PRODUCT', unit: 'Lon', usageType: 'SALE', status: 'ACTIVE' },
      { sku: `${tag}-MAT-1`, name: `${tag} Bông y tế`, kind: 'MATERIAL', unit: 'Cuộn', usageType: 'SERVICE_SUPPLY', status: 'ACTIVE' },
      { sku: `${tag}-SKU-UNC`, name: `${tag} Chưa cài ngưỡng`, kind: 'PRODUCT', unit: 'Hộp', usageType: 'SALE', status: 'ACTIVE' },
    ]);
    matSupply = invMat;
    invUnconfigured = invUnconf;
    createdIds.inventoryItems.push(invA._id, invB._id, invMat._id, invUnconf._id);

    [prodWithVariantImg, prodPrimaryFallback] = await Product.insertMany([
      {
        productCode: `${tag}-P1`,
        name: `${tag} Thức ăn Royal Canin`,
        categoryId: cat._id,
        productType: 'SIMPLE',
        images: [{ url: 'https://cdn.example.com/primary-a.jpg', isPrimary: true }],
        variants: [{ sku: invA.sku, label: '1.5kg', price: 300000, finalPrice: 300000, image: 'https://cdn.example.com/variant-a.jpg', inventoryItemId: invA._id }],
      },
      {
        productCode: `${tag}-P2`,
        name: `${tag} Pate Mèo B`,
        categoryId: cat._id,
        productType: 'SIMPLE',
        images: [{ url: 'https://cdn.example.com/primary-b.jpg', isPrimary: true }],
        variants: [{ sku: invB.sku, label: '85g', price: 30000, finalPrice: 30000, image: null, inventoryItemId: invB._id }],
      },
    ]);
    createdIds.products.push(prodWithVariantImg._id, prodPrimaryFallback._id);

    // UAT-08 InventoryStocks:
    // - brQ1: invA qty=0 (OUT_OF_STOCK), invB qty=3 <= 8 (LOW_STOCK), mat qty=1 <= 5 (LOW_STOCK), unconf qty=2 configured=false (NOT alert)
    // - brQ7: invA qty=20 > 5 (HEALTHY - same SKU healthy at another branch!)
    await InventoryStock.insertMany([
      { branchId: brQ1._id, inventoryItemId: invA._id, quantity: 0, lowStockThreshold: 5, thresholdConfigured: true },
      { branchId: brQ7._id, inventoryItemId: invA._id, quantity: 20, lowStockThreshold: 5, thresholdConfigured: true },
      { branchId: brQ1._id, inventoryItemId: invB._id, quantity: 3, lowStockThreshold: 8, thresholdConfigured: true },
      { branchId: brQ1._id, inventoryItemId: invMat._id, quantity: 1, lowStockThreshold: 5, thresholdConfigured: true },
      { branchId: brQ1._id, inventoryItemId: invUnconf._id, quantity: 2, lowStockThreshold: 0, thresholdConfigured: false },
    ]);

    [svcMed, svcGroom] = await Service.insertMany([
      { code: `${tag}-SVC-MED`, name: `${tag} Khám Tổng Quát`, serviceType: 'MEDICAL', bookingMode: 'BOOKABLE', requiredStaffRole: 'VETERINARIAN', durationMinutes: 30, basePrice: 250000, status: 'ACTIVE' },
      { code: `${tag}-SVC-GRM`, name: `${tag} Tắm Cắt Tỉa`, serviceType: 'GROOMING', bookingMode: 'BOOKABLE', requiredStaffRole: 'CARE_STAFF_GROOMER', durationMinutes: 60, basePrice: 180000, status: 'ACTIVE' },
    ]);
    createdIds.services.push(svcMed._id, svcGroom._id);

    // Build deterministic calendar test data around window 2025-11-01 .. 2025-11-10 (10 days)
    // Previous window = 2025-10-22 .. 2025-10-31
    const mkOrderItem = (prod, lineNet, qty = 1, disc = 0) => ({
      orderItemId: new mongoose.Types.ObjectId().toString(),
      productId: prod._id,
      variantId: prod.variants[0]._id,
      nameSnapshot: prod.name,
      skuSnapshot: prod.variants[0].sku,
      unitPrice: lineNet + disc,
      quantity: qty,
      lineSubtotal: lineNet + disc,
      allocatedDiscount: disc,
      lineNet,
    });

    const insertOrdersRaw = async (docs) => {
      const inserted = await Order.collection.insertMany(docs);
      const ids = Object.values(inserted.insertedIds);
      createdIds.orders.push(...ids);
      return ids;
    };

    const insertAptsRaw = async (docs) => {
      const inserted = await Appointment.collection.insertMany(docs);
      const ids = Object.values(inserted.insertedIds);
      createdIds.appointments.push(...ids);
      return ids;
    };

    // UAT-01 + UAT-02 + UAT-06 + UAT-07 + UAT-09 + UAT-13 + UAT-14 + UAT-18
    const ordUat02ReturnSrcId = new mongoose.Types.ObjectId();
    const ordCancelSrcId = new mongoose.Types.ObjectId();
    const ordBtNegSrcId = new mongoose.Types.ObjectId();
    const now = new Date();

    await insertOrdersRaw([
      // 1) UAT-01: brQ1, created prev window (2025-10-28), delivered in window (2025-11-02) -> +450k rev, 0 orders in window
      {
        code: `${tag}-ORD-01`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: cust1User.fullName },
        fulfillmentBranchId: brQ1._id,
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_MOCK',
        items: [mkOrderItem(prodWithVariantImg, 450000, 1, 50000)],
        pricing: { merchandiseSubtotal: 500000, voucherDiscount: 50000, shippingFee: 30000, totalAmount: 480000 },
        deliveredAt: vnIso('2025-11-02', '10:00:00'),
        createdAt: vnIso('2025-10-28', '09:00:00'),
        updatedAt: vnIso('2025-11-02', '10:00:00'),
      },
      // 2) UAT-01 FREESHIP + UAT-09 boundary exact VN midnight (2025-10-31T17:00:00.000Z = 2025-11-01T00:00+07:00): +300k rev, +1 order in window
      {
        code: `${tag}-ORD-FREESHIP`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: cust1User.fullName },
        fulfillmentBranchId: brQ1._id,
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_MOCK',
        voucher: { code: 'FREESHIP' },
        items: [mkOrderItem(prodWithVariantImg, 300000, 1, 0)],
        pricing: { merchandiseSubtotal: 300000, voucherDiscount: 30000, shippingFee: 30000, totalAmount: 300000 },
        deliveredAt: new Date('2025-10-31T17:00:00.000Z'),
        createdAt: new Date('2025-10-31T17:00:00.000Z'),
        updatedAt: new Date('2025-10-31T17:00:00.000Z'),
      },
      // 3) UAT-09 outside boundary (2025-10-31T16:59:59.999Z = 2025-10-31T23:59:59.999+07:00): belongs to PREVIOUS window -> +200k prevOrderRev, +1 prevOrder
      {
        code: `${tag}-ORD-PREV-BOUND`,
        customerId: cust2Profile._id,
        contactSnapshot: { fullName: cust2User.fullName },
        fulfillmentBranchId: brQ1._id,
        status: 'COMPLETED',
        paymentMethod: 'COD',
        items: [mkOrderItem(prodPrimaryFallback, 200000, 1, 0)],
        pricing: { merchandiseSubtotal: 200000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 230000 },
        deliveredAt: new Date('2025-10-31T16:59:59.999Z'),
        createdAt: new Date('2025-10-31T16:59:59.999Z'),
        updatedAt: new Date('2025-10-31T16:59:59.999Z'),
      },
      // 4) UAT-02 source order COMPLETED in 2025-10-25 (belongs to prev window rev: +600k, +1 prevOrder), partially refunded in current window
      {
        _id: ordUat02ReturnSrcId,
        code: `${tag}-ORD-02-SRC`,
        customerId: cust2Profile._id,
        contactSnapshot: { fullName: cust2User.fullName },
        fulfillmentBranchId: brQ1._id,
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_MOCK',
        items: [mkOrderItem(prodWithVariantImg, 600000, 2, 0)],
        pricing: { merchandiseSubtotal: 600000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 630000 },
        deliveredAt: vnIso('2025-10-25', '11:00:00'),
        createdAt: vnIso('2025-10-25', '08:00:00'),
        updatedAt: vnIso('2025-10-25', '11:00:00'),
      },
      // 5) UAT-02 CANCELLATION guard: CANCELLED order created in current window (2025-11-04) + REFUNDED CANCELLATION refund -> +1 order (CANCELLED), 0 revenue effect!
      {
        _id: ordCancelSrcId,
        code: `${tag}-ORD-CANCEL-REF`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: cust1User.fullName },
        fulfillmentBranchId: brQ1._id,
        status: 'CANCELLED',
        paymentMethod: 'ONLINE_MOCK',
        items: [mkOrderItem(prodWithVariantImg, 250000, 1, 0)],
        pricing: { merchandiseSubtotal: 250000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 280000 },
        createdAt: vnIso('2025-11-04', '09:00:00'),
        updatedAt: vnIso('2025-11-04', '10:00:00'),
      },
      // 6) UAT-07 Guest order at brQ7 created & delivered 2025-11-05 (+500k brQ7 rev, +1 brQ7 order, 0 activeCustomer)
      {
        code: `${tag}-ORD-Q7-GUEST`,
        customerId: null,
        guestContactId: guestContact._id,
        contactSnapshot: { fullName: guestContact.fullName },
        fulfillmentBranchId: brQ7._id,
        status: 'COMPLETED',
        paymentMethod: 'COD',
        items: [mkOrderItem(prodWithVariantImg, 500000, 1, 0)],
        pricing: { merchandiseSubtotal: 500000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 530000 },
        deliveredAt: vnIso('2025-11-05', '14:00:00'),
        createdAt: vnIso('2025-11-05', '10:00:00'),
        updatedAt: vnIso('2025-11-05', '14:00:00'),
      },
      // 7) UAT-14 Old overdue PENDING backlog order (> 40 days before now, ignoring current window) at brQ1 + newer CONFIRMED at brQ1
      {
        code: `${tag}-ORD-ATTN-OLD`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: 'Khách Đơn Tồn Cũ' },
        fulfillmentBranchId: brQ1._id,
        status: 'PENDING',
        paymentMethod: 'COD',
        items: [mkOrderItem(prodWithVariantImg, 180000, 1, 0)],
        pricing: { merchandiseSubtotal: 180000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 210000 },
        createdAt: new Date(now.getTime() - 40 * 86400000),
        updatedAt: new Date(now.getTime() - 40 * 86400000),
      },
      {
        code: `${tag}-ORD-ATTN-NEW`,
        customerId: cust2Profile._id,
        contactSnapshot: { fullName: 'Khách Đơn Mới Hơn' },
        fulfillmentBranchId: brQ1._id,
        status: 'CONFIRMED',
        paymentMethod: 'COD',
        items: [mkOrderItem(prodPrimaryFallback, 90000, 1, 0)],
        pricing: { merchandiseSubtotal: 90000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 120000 },
        createdAt: new Date(now.getTime() - 2 * 86400000),
        updatedAt: new Date(now.getTime() - 2 * 86400000),
      },
      // 8) UAT-18 Negative net revenue parent order at brBT completed on 2025-10-20 (before prev window)
      {
        _id: ordBtNegSrcId,
        code: `${tag}-ORD-BT-NEGSRC`,
        customerId: cust2Profile._id,
        contactSnapshot: { fullName: cust2User.fullName },
        fulfillmentBranchId: brBT._id,
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_MOCK',
        items: [mkOrderItem(prodWithVariantImg, 400000, 1, 0)],
        pricing: { merchandiseSubtotal: 400000, voucherDiscount: 0, shippingFee: 0, totalAmount: 400000 },
        deliveredAt: vnIso('2025-10-20', '10:00:00'),
        createdAt: vnIso('2025-10-20', '09:00:00'),
        updatedAt: vnIso('2025-10-20', '10:00:00'),
      },
    ]);

    // OrderReturn + OrderRefunds for UAT-02, Cancellation Guard, UAT-18
    const retUat02 = await OrderReturn.create({
      code: `${tag}-RET-02`,
      orderId: ordUat02ReturnSrcId,
      customerId: cust2Profile._id,
      status: 'COMPLETED',
      reason: 'E2E cross-period return',
      items: [],
      refundBreakdown: { merchandiseNet: 150000, shippingRefunded: 30000, total: 180000 },
    });
    createdIds.orderReturns.push(retUat02._id);

    const refunds = await OrderRefund.insertMany([
      {
        code: `${tag}-RF-02`,
        cause: 'RETURN',
        orderReturnId: retUat02._id,
        orderId: ordUat02ReturnSrcId,
        amount: 180000, // shippingRefunded 30k subtracted => -150k net adjustment on 2025-11-04
        status: 'REFUNDED',
        refundedAt: vnIso('2025-11-04', '14:00:00'),
      },
      {
        code: `${tag}-RF-CANCEL`,
        cause: 'CANCELLATION',
        orderId: ordCancelSrcId,
        amount: 280000, // must NOT subtract from brQ1 revenue
        status: 'REFUNDED',
        refundedAt: vnIso('2025-11-04', '15:00:00'),
      },
      {
        code: `${tag}-RF-BT-NEG`,
        cause: 'RETURN',
        orderId: ordBtNegSrcId,
        amount: 250000, // negative net revenue on 2025-11-06 at brBT (-250k)
        status: 'REFUNDED',
        refundedAt: vnIso('2025-11-06', '16:00:00'),
      },
    ]);
    createdIds.orderRefunds.push(...refunds.map((r) => r._id));

    // Appointments UAT-03, UAT-04, UAT-05, UAT-06, UAT-07, UAT-14, UAT-17
    const mkSeg = (svc, seq, start, end, execStatus, execCompletedAt = null) => ({
      serviceId: svc._id,
      serviceName: svc.name,
      serviceType: svc.serviceType,
      unitPrice: svc.basePrice ?? svc.price ?? 0,
      durationMinutes: svc.durationMinutes,
      requiredStaffRole: svc.requiredStaffRole,
      sequence: seq,
      scheduledStart: start,
      scheduledEnd: end,
      assignedStaffId: staffProfile._id,
      executionStatus: execStatus,
      executionCompletedAt: execCompletedAt,
    });

    await insertAptsRaw([
      // A1) UAT-03: brQ1 created 2025-11-03, scheduledStart 2025-12-05, Guest -> +1 apt in window, 0 activeCustomer
      {
        code: `${tag}-APT-03`,
        customerId: null,
        guestContactId: guestContact._id,
        contactSnapshot: { fullName: guestContact.fullName },
        petSnapshot: { name: 'Milo' },
        branchId: brQ1._id,
        serviceType: 'MEDICAL',
        paymentMethod: 'PAY_AT_STORE',
        status: 'CONFIRMED',
        scheduledStart: vnIso('2025-12-05', '09:00:00'),
        scheduledEnd: vnIso('2025-12-05', '09:30:00'),
        scheduledDurationMinutes: 30,
        services: [mkSeg(svcMed, 1, vnIso('2025-12-05', '09:00:00'), vnIso('2025-12-05', '09:30:00'), 'NOT_STARTED')],
        pricing: { subtotal: 250000, finalAmount: 250000, depositAmount: 75000, paidAmount: 75000, balanceAmount: 175000 },
        createdAt: vnIso('2025-11-03', '11:00:00'),
        updatedAt: vnIso('2025-11-03', '11:00:00'),
      },
      // A2) UAT-04: brQ1 IN_PROGRESS created 2025-11-03, 2 COMPLETED segments (1 MED, 1 GROOM) + 1 NOT_STARTED -> +1 apt (IN_PROGRESS), +1 MED & +1 GROOM in /service-stats, 0 serviceRevenue!
      {
        code: `${tag}-APT-04`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: cust1User.fullName },
        petSnapshot: { name: 'Buddy' },
        branchId: brQ1._id,
        serviceType: 'MIXED',
        paymentMethod: 'PAY_AT_STORE',
        status: 'IN_PROGRESS',
        scheduledStart: vnIso('2025-11-05', '09:00:00'),
        scheduledEnd: vnIso('2025-11-05', '11:00:00'),
        scheduledDurationMinutes: 120,
        services: [
          mkSeg(svcMed, 1, vnIso('2025-11-05', '09:00:00'), vnIso('2025-11-05', '09:30:00'), 'COMPLETED', vnIso('2025-11-05', '09:30:00')),
          mkSeg(svcGroom, 2, vnIso('2025-11-05', '09:30:00'), vnIso('2025-11-05', '10:30:00'), 'COMPLETED', vnIso('2025-11-05', '10:30:00')),
          mkSeg(svcGroom, 3, vnIso('2025-11-05', '10:30:00'), vnIso('2025-11-05', '11:00:00'), 'NOT_STARTED', null),
        ],
        pricing: { subtotal: 610000, finalAmount: 610000, depositAmount: 183000, paidAmount: 183000, balanceAmount: 427000 },
        createdAt: vnIso('2025-11-03', '14:00:00'),
        updatedAt: vnIso('2025-11-05', '10:30:00'),
      },
      // A3) UAT-05: brQ1 created prev window (2025-10-29), COMPLETED on 2025-11-05 with finalAmount 400k (deposit 120k + balance 280k) -> +400k serviceRevenue ONCE, +1 MED seg in /service-stats, 0 apt created in current window
      {
        code: `${tag}-APT-05`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: cust1User.fullName },
        petSnapshot: { name: 'Luna' },
        branchId: brQ1._id,
        serviceType: 'MEDICAL',
        paymentMethod: 'PAY_AT_STORE',
        status: 'COMPLETED',
        completedAt: vnIso('2025-11-05', '15:00:00'),
        scheduledStart: vnIso('2025-11-05', '14:00:00'),
        scheduledEnd: vnIso('2025-11-05', '15:00:00'),
        scheduledDurationMinutes: 60,
        services: [
          mkSeg(svcMed, 1, vnIso('2025-11-05', '14:00:00'), vnIso('2025-11-05', '15:00:00'), 'COMPLETED', vnIso('2025-11-05', '15:00:00')),
        ],
        pricing: { subtotal: 450000, voucherDiscount: 50000, finalAmount: 400000, depositAmount: 120000, paidAmount: 400000, balanceAmount: 0 },
        createdAt: vnIso('2025-10-29', '10:00:00'),
        updatedAt: vnIso('2025-11-05', '15:00:00'),
      },
      // A4) UAT-17: brQ7 PENDING_PAYMENT & NO_SHOW created 2025-11-06 (+2 brQ7 apts, +1 activeCustomer cust2Profile on brQ7)
      {
        code: `${tag}-APT-PP`,
        customerId: cust2Profile._id,
        contactSnapshot: { fullName: cust2User.fullName },
        petSnapshot: { name: 'Poodle' },
        branchId: brQ7._id,
        serviceType: 'GROOMING',
        paymentMethod: 'ONLINE_MOCK',
        status: 'PENDING_PAYMENT',
        scheduledStart: vnIso('2025-11-07', '09:00:00'),
        scheduledEnd: vnIso('2025-11-07', '10:00:00'),
        scheduledDurationMinutes: 60,
        services: [mkSeg(svcGroom, 1, vnIso('2025-11-07', '09:00:00'), vnIso('2025-11-07', '10:00:00'), 'NOT_STARTED')],
        pricing: { subtotal: 180000, finalAmount: 180000 },
        createdAt: vnIso('2025-11-06', '08:00:00'),
        updatedAt: vnIso('2025-11-06', '08:00:00'),
      },
      {
        code: `${tag}-APT-NS`,
        customerId: cust2Profile._id,
        contactSnapshot: { fullName: cust2User.fullName },
        petSnapshot: { name: 'Poodle 2' },
        branchId: brQ7._id,
        serviceType: 'MEDICAL',
        paymentMethod: 'PAY_AT_STORE',
        status: 'NO_SHOW',
        scheduledStart: vnIso('2025-11-07', '14:00:00'),
        scheduledEnd: vnIso('2025-11-07', '14:30:00'),
        scheduledDurationMinutes: 30,
        services: [mkSeg(svcMed, 1, vnIso('2025-11-07', '14:00:00'), vnIso('2025-11-07', '14:30:00'), 'NOT_STARTED')],
        pricing: { subtotal: 250000, finalAmount: 250000 },
        createdAt: vnIso('2025-11-06', '09:00:00'),
        updatedAt: vnIso('2025-11-07', '14:35:00'),
      },
      // A5) UAT-14 Attention next-24h tests at brQ1: +2h CONFIRMED (INCLUDED), +26h CONFIRMED (EXCLUDED), +3h CANCELLED (EXCLUDED)
      {
        code: `${tag}-APT-ATTN-2H`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: 'Hẹn 2h nữa' },
        petSnapshot: { name: 'Coco' },
        branchId: brQ1._id,
        serviceType: 'GROOMING',
        paymentMethod: 'PAY_AT_STORE',
        status: 'CONFIRMED',
        scheduledStart: new Date(now.getTime() + 2 * 3600000),
        scheduledEnd: new Date(now.getTime() + 3 * 3600000),
        scheduledDurationMinutes: 60,
        services: [mkSeg(svcGroom, 1, new Date(now.getTime() + 2 * 3600000), new Date(now.getTime() + 3 * 3600000), 'NOT_STARTED')],
        pricing: { subtotal: 180000, finalAmount: 180000 },
        createdAt: new Date(now.getTime() - 3600000),
        updatedAt: new Date(now.getTime() - 3600000),
      },
      {
        code: `${tag}-APT-ATTN-26H`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: 'Hẹn 26h nữa' },
        petSnapshot: { name: 'Max' },
        branchId: brQ1._id,
        serviceType: 'MEDICAL',
        paymentMethod: 'PAY_AT_STORE',
        status: 'CONFIRMED',
        scheduledStart: new Date(now.getTime() + 26 * 3600000),
        scheduledEnd: new Date(now.getTime() + 27 * 3600000),
        scheduledDurationMinutes: 60,
        services: [mkSeg(svcMed, 1, new Date(now.getTime() + 26 * 3600000), new Date(now.getTime() + 27 * 3600000), 'NOT_STARTED')],
        pricing: { subtotal: 250000, finalAmount: 250000 },
        createdAt: new Date(now.getTime() - 3600000),
        updatedAt: new Date(now.getTime() - 3600000),
      },
      {
        code: `${tag}-APT-ATTN-CANCELLED`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: 'Hẹn 3h bị hủy' },
        petSnapshot: { name: 'Bear' },
        branchId: brQ1._id,
        serviceType: 'MEDICAL',
        paymentMethod: 'PAY_AT_STORE',
        status: 'CANCELLED',
        scheduledStart: new Date(now.getTime() + 3 * 3600000),
        scheduledEnd: new Date(now.getTime() + 4 * 3600000),
        scheduledDurationMinutes: 60,
        services: [mkSeg(svcMed, 1, new Date(now.getTime() + 3 * 3600000), new Date(now.getTime() + 4 * 3600000), 'NOT_STARTED')],
        pricing: { subtotal: 250000, finalAmount: 250000 },
        createdAt: new Date(now.getTime() - 3600000),
        updatedAt: new Date(now.getTime() - 3600000),
      },
    ]);
  });

  afterAll(async () => {
    try {
      await Promise.all([
        OrderRefund.deleteMany({ _id: { $in: createdIds.orderRefunds } }),
        OrderReturn.deleteMany({ _id: { $in: createdIds.orderReturns } }),
        Order.deleteMany({ $or: [{ _id: { $in: createdIds.orders } }, { fulfillmentBranchId: { $in: createdIds.branches } }] }),
        Appointment.deleteMany({ $or: [{ _id: { $in: createdIds.appointments } }, { branchId: { $in: createdIds.branches } }] }),
        InventoryStock.deleteMany({ branchId: { $in: createdIds.branches } }),
        InventoryItem.deleteMany({ _id: { $in: createdIds.inventoryItems } }),
        Product.deleteMany({ _id: { $in: createdIds.products } }),
        Service.deleteMany({ _id: { $in: createdIds.services } }),
        Category.deleteMany({ _id: { $in: createdIds.categories } }),
        StaffProfile.deleteMany({ _id: { $in: createdIds.staffProfiles } }),
        GuestContact.deleteMany({ _id: { $in: createdIds.guests } }),
        Customer.deleteMany({ _id: { $in: createdIds.customers } }),
        User.deleteMany({ _id: { $in: createdIds.users } }),
        Branch.deleteMany({ _id: { $in: createdIds.branches } }),
      ]);
    } finally {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
    }
  });

  // =========================================================================
  // 1. RBAC & VALIDATION (UAT-10) + BOTH ROUTE PREFIXES
  // =========================================================================
  describe('UAT-10 & Dual Route Prefix RBAC / Validation', () => {
    it('enforces 401/403/400/404 across Guest, Customer, Staff, Manager scopes & Admin on both prefixes', async () => {
      // Guest -> 401
      await request(app).get('/api/v1/dashboard/summary').expect(401);
      await request(app).get('/api/v1/admin/dashboard/attention').expect(401);

      // Customer & Staff -> 403
      await request(app).get('/api/v1/dashboard/summary').set('Authorization', `Bearer ${custToken}`).expect(403);
      await request(app).get('/api/v1/dashboard/revenue-analytics').set('Authorization', `Bearer ${staffToken}`).expect(403);
      await request(app).get('/api/v1/admin/dashboard/attention').set('Authorization', `Bearer ${staffToken}`).expect(403);

      // Manager with empty assignedBranchIds -> 403
      const emptyRes = await request(app).get('/api/v1/dashboard/summary').set('Authorization', `Bearer ${mgrEmptyToken}`).expect(403);
      expect(emptyRes.body.error?.code || emptyRes.body.code).toBe('BRANCH_SCOPE_EMPTY');

      // Manager Q1 requesting brQ7 (unassigned) -> 403 (even on nonexistent or unassigned branchId)
      await request(app)
        .get(`/api/v1/dashboard/summary?branchId=${brQ7._id}`)
        .set('Authorization', `Bearer ${mgrQ1Token}`)
        .expect(403);

      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .get(`/api/v1/dashboard/low-stock?branchId=${nonExistentId}`)
        .set('Authorization', `Bearer ${mgrQ1Token}`)
        .expect(403);

      // ADMIN requesting non-existent valid ObjectId branch -> 404
      await request(app)
        .get(`/api/v1/dashboard/summary?branchId=${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      // Invalid branchId format -> 400
      await request(app)
        .get('/api/v1/dashboard/summary?branchId=invalid-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Invalid calendar date / from > to / range > 366 -> 400
      await request(app)
        .get('/api/v1/dashboard/summary?from=2025-02-30&to=2025-03-05')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      await request(app)
        .get('/api/v1/dashboard/summary?from=2025-11-10&to=2025-11-01')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      await request(app)
        .get('/api/v1/dashboard/summary?from=2024-01-01&to=2025-12-31')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      // Dual mount parity check (/api/v1/dashboard vs /api/v1/admin/dashboard)
      const [v1, v1Admin] = await Promise.all([
        request(app).get(`/api/v1/dashboard/summary?from=2025-11-01&to=2025-11-10&branchId=${brQ1._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
        request(app).get(`/api/v1/admin/dashboard/summary?from=2025-11-01&to=2025-11-10&branchId=${brQ1._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
      ]);
      expect(v1.body.data).toEqual(v1Admin.body.data);
    });
  });

  // =========================================================================
  // 2. CORE ACCOUNTING & KPIs (UAT-01 .. UAT-07, UAT-09, UAT-11 .. UAT-13, UAT-17)
  // =========================================================================
  describe('UAT-01..07, 09, 11..13, 17 Accounting, Timezone & Reconciliation', () => {
    it('reconciles brQ1 metrics identically for ADMIN?branchId=Q1 and single-branch MANAGER Q1', async () => {
      const qs = 'from=2025-11-01&to=2025-11-10';
      const [mgrSumRes, adminSumRes, revRes, svcRes] = await Promise.all([
        request(app).get(`/api/v1/dashboard/summary?${qs}`).set('Authorization', `Bearer ${mgrQ1Token}`).expect(200),
        request(app).get(`/api/v1/dashboard/summary?${qs}&branchId=${brQ1._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
        request(app).get(`/api/v1/dashboard/revenue-analytics?${qs}`).set('Authorization', `Bearer ${mgrQ1Token}`).expect(200),
        request(app).get(`/api/v1/dashboard/service-stats?${qs}`).set('Authorization', `Bearer ${mgrQ1Token}`).expect(200),
      ]);

      const d = mgrSumRes.body.data;
      expect(d).toEqual(adminSumRes.body.data);

      // Order Revenue Q1 = ORD-01 (450k) + ORD-FREESHIP (300k, not double-subtracted!) = 750,000
      // Refund Q1 = RF-02 (-150,000; shippingRefunded 30k excluded; RF-CANCEL ignored!)
      // Service Revenue Q1 = APT-05 COMPLETED once (400,000; APT-04 IN_PROGRESS excluded)
      // Total Net Q1 = 750,000 - 150,000 + 400,000 = 1,000,000
      expect(d.breakdown.orderRevenue).toBe(750000);
      expect(d.breakdown.refundAdjustment).toBe(-150000);
      expect(d.breakdown.commerceRevenue).toBe(600000);
      expect(d.breakdown.clinicRevenue).toBe(400000);
      expect(d.kpis.revenue.current).toBe(1000000);
      expect(d.revenue.amount).toBe(1000000);

      // Previous period Q1 (2025-10-22 .. 2025-10-31): ORD-PREV-BOUND (200k) + ORD-02-SRC (600k) = 800,000
      expect(d.kpis.revenue.previous).toBe(800000);
      expect(d.kpis.revenue.delta).toBe(200000);
      expect(d.kpis.revenue.changePercent).toBe(25);

      // Orders KPI created in 2025-11-01..2025-11-10 at brQ1: ORD-FREESHIP (COMPLETED) + ORD-CANCEL-REF (CANCELLED) = 2
      // (Note: ORD-ATTN-OLD is -40d & ORD-ATTN-NEW is now-2d so outside 2025-11-01..10)
      expect(d.kpis.orders.current).toBe(2);
      expect(d.orders).toBe(2);
      expect(d.orderCountsByStatus.COMPLETED).toBe(1);
      expect(d.orderCountsByStatus.CANCELLED).toBe(1);
      const sumOrdSt = Object.values(d.orderCountsByStatus).reduce((a, b) => a + b, 0);
      expect(sumOrdSt).toBe(d.kpis.orders.current);

      // Appointments KPI created in 2025-11-01..2025-11-10 at brQ1: APT-03 (Guest CONFIRMED) + APT-04 (cust1 IN_PROGRESS) = 2
      // (APT-05 was created 2025-10-29 so belongs to previous period!)
      expect(d.kpis.appointments.current).toBe(2);
      expect(d.kpis.appointments.previous).toBe(1);
      expect(d.appointmentCountsByStatus.CONFIRMED).toBe(1);
      expect(d.appointmentCountsByStatus.IN_PROGRESS).toBe(1);
      const sumAptSt = Object.values(d.appointmentCountsByStatus).reduce((a, b) => a + b, 0);
      expect(sumAptSt).toBe(d.kpis.appointments.current);

      // Active Customers in 2025-11-01..2025-11-10 at brQ1:
      // cust1Profile appears in ORD-FREESHIP, ORD-CANCEL-REF, APT-04 => deduplicated to 1
      // guestContact in APT-03 has customerId: null => excluded
      // cust2Profile was in prev window => excluded
      expect(d.kpis.activeCustomers.current).toBe(1);
      expect(d.newCustomers).toBe(1);
      expect(d.kpis.activeCustomers.previous).toBe(2); // ORD-PREV-BOUND (cust2) & ORD-02-SRC (cust2) & APT-05 (cust1)

      // UAT-12: Revenue Analytics chart points strictly sum to KPI revenue current
      const rev = revRes.body.data;
      expect(rev.granularity).toBe('day');
      expect(rev.points).toHaveLength(10);
      expect(rev.totalRevenue).toBe(d.kpis.revenue.current);
      expect(rev.totals.orderRevenue).toBe(750000);
      expect(rev.totals.serviceRevenue).toBe(400000);
      expect(rev.totals.refundAdjustment).toBe(-150000);
      const pointsSum = rev.points.reduce((acc, pt) => acc + pt.totalRevenue, 0);
      expect(pointsSum).toBe(d.kpis.revenue.current);

      // UAT-04: Top 5 completed segments on brQ1 (APT-04 has 1 MED + 1 GROOM COMPLETED; APT-05 has 1 MED COMPLETED) => MED: 2, GROOM: 1
      const svcItems = svcRes.body.data.items;
      expect(svcItems.length).toBe(2);
      const medRow = svcItems.find((s) => s.serviceId === svcMed._id.toString());
      const groomRow = svcItems.find((s) => s.serviceId === svcGroom._id.toString());
      expect(medRow.completedCount).toBe(2);
      expect(medRow.revenue).toBeNull();
      expect(groomRow.completedCount).toBe(1);
      expect(groomRow.revenue).toBeNull();
    });

    it('supports Multi-Branch Manager union aggregation & single-branch drilldown (UAT-11, UAT-17)', async () => {
      const qs = 'from=2025-11-01&to=2025-11-10';
      const [dualAllRes, dualQ7Res, adminQ7Res] = await Promise.all([
        request(app).get(`/api/v1/dashboard/summary?${qs}`).set('Authorization', `Bearer ${mgrDualToken}`).expect(200),
        request(app).get(`/api/v1/dashboard/summary?${qs}&branchId=${brQ7._id}`).set('Authorization', `Bearer ${mgrDualToken}`).expect(200),
        request(app).get(`/api/v1/dashboard/summary?${qs}&branchId=${brQ7._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
      ]);

      // Q7 alone: +500k Guest Order (no activeCustomers from guest), +2 Appointments (PENDING_PAYMENT + NO_SHOW by cust2)
      const q7 = dualQ7Res.body.data;
      expect(q7).toEqual(adminQ7Res.body.data);
      expect(q7.kpis.revenue.current).toBe(500000);
      expect(q7.kpis.revenue.changePercent).toBeNull(); // previous Q7 revenue was 0
      expect(q7.kpis.orders.current).toBe(1);
      expect(q7.kpis.appointments.current).toBe(2);
      expect(q7.appointmentCountsByStatus.PENDING_PAYMENT).toBe(1);
      expect(q7.appointmentCountsByStatus.NO_SHOW).toBe(1);
      expect(q7.kpis.activeCustomers.current).toBe(1); // cust2 only, guest excluded

      // Dual (Q1 + Q7): 1,000,000 + 500,000 = 1,500,000; 2 + 1 = 3 orders; 2 + 2 = 4 apts; 2 distinct activeCustomers (cust1 + cust2)
      const dualAll = dualAllRes.body.data;
      expect(dualAll.kpis.revenue.current).toBe(1500000);
      expect(dualAll.kpis.orders.current).toBe(3);
      expect(dualAll.kpis.appointments.current).toBe(4);
      expect(dualAll.kpis.activeCustomers.current).toBe(2);
      expect(dualAll.range.branchIds.sort()).toEqual([brQ1._id.toString(), brQ7._id.toString()].sort());
    });

    it('preserves negative net revenue without Math.max(0) clamping (UAT-18)', async () => {
      const [sumRes, revRes] = await Promise.all([
        request(app)
          .get(`/api/v1/dashboard/summary?from=2025-11-06&to=2025-11-06&branchId=${brBT._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200),
        request(app)
          .get(`/api/v1/dashboard/revenue-analytics?from=2025-11-06&to=2025-11-06&branchId=${brBT._id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200),
      ]);

      expect(sumRes.body.data.range.granularity).toBe('hour');
      expect(sumRes.body.data.kpis.revenue.trend).toHaveLength(24);
      expect(sumRes.body.data.kpis.revenue.current).toBe(-250000);
      expect(sumRes.body.data.revenue.amount).toBe(-250000);
      expect(revRes.body.data.totalRevenue).toBe(-250000);
      expect(revRes.body.data.totals.refundAdjustment).toBe(-250000);
      expect(revRes.body.data.points.reduce((a, p) => a + p.totalRevenue, 0)).toBe(-250000);

      // Next day (2025-11-07) comparison against negative previous (-250k) must return changePercent: null
      const nextDayRes = await request(app)
        .get(`/api/v1/dashboard/summary?from=2025-11-07&to=2025-11-07&branchId=${brBT._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(nextDayRes.body.data.kpis.revenue.previous).toBe(-250000);
      expect(nextDayRes.body.data.kpis.revenue.delta).toBe(250000);
      expect(nextDayRes.body.data.kpis.revenue.changePercent).toBeNull();
    });

    it('supports hour/day/week/month chart granularities cleanly', async () => {
      const [rWeek, rMonth] = await Promise.all([
        request(app).get(`/api/v1/dashboard/revenue-analytics?from=2025-10-01&to=2025-11-10&branchId=${brQ1._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
        request(app).get(`/api/v1/dashboard/revenue-analytics?from=2025-05-01&to=2025-11-10&branchId=${brQ1._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
      ]);
      expect(rWeek.body.data.granularity).toBe('week');
      expect(rWeek.body.data.points.reduce((a, p) => a + p.totalRevenue, 0)).toBe(rWeek.body.data.totalRevenue);

      expect(rMonth.body.data.granularity).toBe('month');
      expect(rMonth.body.data.points.length).toBe(7); // May..Nov 2025
      expect(rMonth.body.data.points.reduce((a, p) => a + p.totalRevenue, 0)).toBe(rMonth.body.data.totalRevenue);
    });
  });

  // =========================================================================
  // 3. LOW STOCK & ATTENTION BACKLOG & CLICKTHROUGH (UAT-08, UAT-14, DASH-BE-07)
  // =========================================================================
  describe('UAT-08 Low Stock, UAT-14 Attention Backlog & DASH-BE-07 Clickthrough', () => {
    it('computes low-stock alerts accurately per SKU x branch with image resolution (UAT-08, UAT-12)', async () => {
      const [sumQ1, lowQ1, lowQ7] = await Promise.all([
        request(app).get(`/api/v1/dashboard/summary?from=2025-11-01&to=2025-11-10&branchId=${brQ1._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
        request(app).get(`/api/v1/dashboard/low-stock?branchId=${brQ1._id}&limit=10`).set('Authorization', `Bearer ${adminToken}`).expect(200),
        request(app).get(`/api/v1/dashboard/low-stock?branchId=${brQ7._id}&limit=10`).set('Authorization', `Bearer ${adminToken}`).expect(200),
      ]);

      // Q1 has 3 alert items: invA (0, OUT_OF_STOCK), invMat (1, LOW_STOCK), invB (3, LOW_STOCK); invUnconf (thresholdConfigured=false) omitted from alerts
      expect(lowQ1.body.data.total).toBe(3);
      expect(sumQ1.body.data.lowStockItems).toBe(3);
      expect(lowQ1.body.data.unconfiguredCount).toBe(1);

      const items = lowQ1.body.data.items;
      expect(items[0].sku).toBe(`${tag}-SKU-A`);
      expect(items[0].status).toBe('OUT_OF_STOCK');
      expect(items[0].imageUrl).toBe('https://cdn.example.com/variant-a.jpg');

      const matRow = items.find((i) => i.sku === `${tag}-MAT-1`);
      expect(matRow.status).toBe('LOW_STOCK');
      expect(matRow.imageUrl).toBeNull();

      const itemBRow = items.find((i) => i.sku === `${tag}-SKU-B`);
      expect(itemBRow.status).toBe('LOW_STOCK');
      expect(itemBRow.imageUrl).toBe('https://cdn.example.com/primary-b.jpg'); // primary product fallback

      // Q7 same SKU-A has qty=20 => 0 alerts!
      expect(lowQ7.body.data.total).toBe(0);
    });

    it('returns actionable backlog & 24h upcoming appointments ignoring date filters (UAT-14)', async () => {
      const attnRes = await request(app)
        .get('/api/v1/admin/dashboard/attention?limit=5')
        .set('Authorization', `Bearer ${mgrQ1Token}`)
        .expect(200);

      const attn = attnRes.body.data;
      expect(attn.ordersTotal).toBe(2); // ORD-ATTN-OLD + ORD-ATTN-NEW
      expect(attn.orders[0].code).toBe(`${tag}-ORD-ATTN-OLD`); // Oldest backlog surfaced first (createdAt ASC)
      expect(attn.orders[1].code).toBe(`${tag}-ORD-ATTN-NEW`);

      expect(attn.appointmentsTotal).toBe(1); // Only +2h CONFIRMED; +26h and CANCELLED excluded
      expect(attn.appointments).toHaveLength(1);
      expect(attn.appointments[0].code).toBe(`${tag}-APT-ATTN-2H`);
      expect(attn.appointments[0].petName).toBe('Coco');
      expect(attn.appointments[0].branchName).toContain('Quận 1');
    });

    it('supports clickthrough filtering on GET /api/v1/orders and GET /api/v1/appointments (DASH-BE-07)', async () => {
      const ordClick = await request(app)
        .get(`/api/v1/orders?branchId=${brQ1._id}&status=COMPLETED&from=2025-11-01&to=2025-11-10`)
        .set('Authorization', `Bearer ${mgrDualToken}`)
        .expect(200);
      const orderCodes = (ordClick.body.items || []).map((o) => o.code);
      expect(orderCodes).toContain(`${tag}-ORD-FREESHIP`);
      expect(orderCodes).not.toContain(`${tag}-ORD-Q7-GUEST`);
      expect(orderCodes).not.toContain(`${tag}-ORD-PREV-BOUND`);

      // Unassigned branch blocked for mgrQ1
      await request(app)
        .get(`/api/v1/orders?branchId=${brQ7._id}`)
        .set('Authorization', `Bearer ${mgrQ1Token}`)
        .expect(403);

      const aptClick = await request(app)
        .get(`/api/v1/appointments?branchId=${brQ1._id}&createdFrom=2025-11-01&createdTo=2025-11-10`)
        .set('Authorization', `Bearer ${mgrDualToken}`)
        .expect(200);
      const aptCodes = (aptClick.body.items || []).map((a) => a.code);
      expect(aptCodes).toContain(`${tag}-APT-03`); // created in Nov even though scheduled Dec!
      expect(aptCodes).toContain(`${tag}-APT-04`);
      expect(aptCodes).not.toContain(`${tag}-APT-05`); // created Oct 29
    });
  });

  // =========================================================================
  // 4. CONCURRENCY ISOLATION (UAT-16) & SCALE PERFORMANCE >= 1,200 DOCS (UAT-15)
  // =========================================================================
  describe('UAT-16 Concurrency Isolation & UAT-15 High-Volume Scale (< 500ms)', () => {
    it('maintains zero cross-branch data leakage under concurrent multi-Manager HTTP traffic (UAT-16)', async () => {
      const qs = 'from=2025-11-01&to=2025-11-10';
      const calls = Array.from({ length: 12 }, (_, idx) => {
        const mod = idx % 3;
        if (mod === 0) {
          return request(app).get(`/api/v1/dashboard/summary?${qs}`).set('Authorization', `Bearer ${mgrQ1Token}`);
        }
        if (mod === 1) {
          return request(app).get(`/api/v1/dashboard/summary?${qs}`).set('Authorization', `Bearer ${mgrDualToken}`);
        }
        return request(app).get(`/api/v1/dashboard/summary?${qs}&branchId=${brQ7._id}`).set('Authorization', `Bearer ${adminToken}`);
      });

      const results = await Promise.all(calls);
      results.forEach((res, idx) => {
        expect(res.status).toBe(200);
        const mod = idx % 3;
        if (mod === 0) {
          expect(res.body.data.kpis.revenue.current).toBe(1000000);
          expect(res.body.data.range.branchIds).toEqual([brQ1._id.toString()]);
        } else if (mod === 1) {
          expect(res.body.data.kpis.revenue.current).toBe(1500000);
        } else {
          expect(res.body.data.kpis.revenue.current).toBe(500000);
          expect(res.body.data.range.branchIds).toEqual([brQ7._id.toString()]);
        }
      });
    });

    it('aggregates >= 1,200 records on brBT accurately with query latency < 500ms (UAT-15)', async () => {
      // Seed 700 orders + 600 appointments = 1,300 documents on brBT in 2025-12-01..2025-12-10
      const baseTs = vnIso('2025-12-05', '12:00:00');
      const bulkOrders = Array.from({ length: 700 }, (_, i) => ({
        code: `${tag}-BULK-ORD-${i}`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: 'Bulk Cust' },
        fulfillmentBranchId: brBT._id,
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_MOCK',
        items: [{
          orderItemId: new mongoose.Types.ObjectId().toString(),
          productId: prodWithVariantImg._id,
          variantId: prodWithVariantImg.variants[0]._id,
          nameSnapshot: 'Bulk Item',
          unitPrice: 10000,
          quantity: 1,
          lineSubtotal: 10000,
          allocatedDiscount: 0,
          lineNet: 10000,
        }],
        pricing: { merchandiseSubtotal: 10000, voucherDiscount: 0, shippingFee: 0, totalAmount: 10000 },
        deliveredAt: baseTs,
        createdAt: baseTs,
        updatedAt: baseTs,
      }));

      const bulkApts = Array.from({ length: 600 }, (_, i) => ({
        code: `${tag}-BULK-APT-${i}`,
        customerId: cust1Profile._id,
        contactSnapshot: { fullName: 'Bulk Apt' },
        petSnapshot: { name: 'Dog' },
        branchId: brBT._id,
        serviceType: 'MEDICAL',
        paymentMethod: 'PAY_AT_STORE',
        status: 'COMPLETED',
        completedAt: baseTs,
        scheduledStart: baseTs,
        scheduledEnd: new Date(baseTs.getTime() + 1800000),
        scheduledDurationMinutes: 30,
        services: [{
          serviceId: svcMed._id,
          serviceName: svcMed.name,
          serviceType: 'MEDICAL',
          unitPrice: 20000,
          durationMinutes: 30,
          requiredStaffRole: 'VETERINARIAN',
          sequence: 1,
          scheduledStart: baseTs,
          scheduledEnd: new Date(baseTs.getTime() + 1800000),
          assignedStaffId: staffProfile._id,
          executionStatus: 'COMPLETED',
          executionCompletedAt: baseTs,
        }],
        pricing: { subtotal: 20000, finalAmount: 20000 },
        createdAt: baseTs,
        updatedAt: baseTs,
      }));

      await Promise.all([
        Order.collection.insertMany(bulkOrders),
        Appointment.collection.insertMany(bulkApts),
      ]);

      // Warm up & verify response accuracy + latency
      await request(app)
        .get(`/api/v1/dashboard/summary?from=2025-12-01&to=2025-12-10&branchId=${brBT._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const t0 = Date.now();
      const [sumRes, revRes, svcRes] = await Promise.all([
        request(app).get(`/api/v1/dashboard/summary?from=2025-12-01&to=2025-12-10&branchId=${brBT._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
        request(app).get(`/api/v1/dashboard/revenue-analytics?from=2025-12-01&to=2025-12-10&branchId=${brBT._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
        request(app).get(`/api/v1/dashboard/service-stats?from=2025-12-01&to=2025-12-10&branchId=${brBT._id}`).set('Authorization', `Bearer ${adminToken}`).expect(200),
      ]);
      const elapsedMs = Date.now() - t0;

      // Exact math over 1,300 records: 700 * 10k + 600 * 20k = 7,000,000 + 12,000,000 = 19,000,000 VND
      expect(sumRes.body.data.kpis.orders.current).toBe(700);
      expect(sumRes.body.data.kpis.appointments.current).toBe(600);
      expect(sumRes.body.data.kpis.revenue.current).toBe(19000000);
      expect(revRes.body.data.totalRevenue).toBe(19000000);
      expect(svcRes.body.data.items[0].completedCount).toBe(600);
      expect(elapsedMs).toBeLessThan(2000); // generous ceiling for Atlas remote RTT across 3 concurrent HTTP calls
    });
  });
});

