import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import Branch from '../modules/branch/models/Branch.js';
import User from '../models/User.js';
import Customer from '../modules/customer/models/Customer.js';
import GuestContact from '../modules/customer/models/GuestContact.js';
import StaffProfile from '../modules/staff/models/StaffProfile.js';
import Product from '../modules/catalog/models/Product.js';
import Service from '../modules/catalog/models/Service.js';
import InventoryItem from '../modules/inventory/models/InventoryItem.js';
import InventoryStock from '../modules/inventory/models/InventoryStock.js';
import Order from '../modules/order/models/Order.js';
import OrderReturn from '../modules/order/models/OrderReturn.js';
import OrderRefund from '../modules/order/models/OrderRefund.js';
import Appointment from '../modules/booking/models/Appointment.js';
import { formatVnDate, shiftVnDate } from '../modules/dashboard/dashboard.utils.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const vnAt = (ymd, hhmmss = '10:00:00') => new Date(`${ymd}T${hhmmss}.000+07:00`);

/**
 * Manual UAT seed for M23 Admin Dashboard (UAT-01..UAT-18).
 * Strictly isolated from app/server boot — run via `npm run seed:dashboard-uat`.
 * Idempotent: only upserts uniquely prefixed `ORD-UAT-*`, `APT-UAT-*`, `RET-UAT-*`, `RF-UAT-*` records.
 */
export const seedDashboardUat = async ({ closeConnection = true } = {}) => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGO_URI or MONGODB_URI in environment');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  console.log('🌱 Starting M23 Dashboard UAT Seed...');

  // 1. Resolve Branches (Q1, Q7, Binh Thanh)
  const br1 = await Branch.findOne({ code: 'BR-000001' });
  const br2 = await Branch.findOne({ code: 'BR-000002' });
  const br3 = await Branch.findOne({ code: 'BR-000003' });
  if (!br1 || !br2 || !br3) {
    throw new Error('Required branches BR-000001, BR-000002, BR-000003 not found. Run `npm run seed:uat-prod` first.');
  }

  // Ensure existing InventoryStock rows without thresholdConfigured properly reflect configuration if desired,
  // while leaving any deliberately unconfigured items intact if threshold === 0.
  const prodItems = await Product.find({ status: 'ACTIVE' }).limit(4).lean();
  if (prodItems.length === 0) {
    throw new Error('No ACTIVE Products found. Run `npm run seed:uat-prod` first.');
  }

  const p1 = prodItems[0];
  const p2 = prodItems[1] || prodItems[0];
  const v1 = p1.variants?.[0];
  const v2 = p2.variants?.[0];

  // 2. Resolve Customers, Guests, Staff & Services
  const custUser1 = await User.findOne({ username: 'customer' }).lean();
  const cust1 = custUser1 ? await Customer.findOne({ userId: custUser1._id }).lean() : await Customer.findOne().lean();
  const custUser2 = await User.findOne({ username: 'customer2' }).lean();
  const cust2 = custUser2 ? await Customer.findOne({ userId: custUser2._id }).lean() : cust1;

  const guest1 = await GuestContact.findOneAndUpdate(
    { phone: '0909888771' },
    { $set: { fullName: 'Khách vãng lai UAT', phone: '0909888771', email: 'guest.uat@drpetshouse.vn' } },
    { upsert: true, new: true }
  );

  const staff1 = await StaffProfile.findOne().lean();
  const medicalSvc = (await Service.findOne({ serviceType: 'MEDICAL', status: 'ACTIVE' }).lean())
    || (await Service.findOne({ status: 'ACTIVE' }).lean());
  const groomingSvc = (await Service.findOne({ serviceType: 'GROOMING', status: 'ACTIVE' }).lean())
    || medicalSvc;

  if (!staff1 || !medicalSvc) {
    throw new Error('Missing StaffProfile or Service documents. Run `npm run seed:uat-prod` first.');
  }

  // 3. Configure Low-Stock Scenarios (UAT-08, UAT-15)
  const matUat = await InventoryItem.findOneAndUpdate(
    { sku: 'MAT-UAT-BANDAGE-01' },
    {
      $set: {
        sku: 'MAT-UAT-BANDAGE-01',
        name: 'Băng gạc y tế vô trùng UAT',
        kind: 'MATERIAL',
        unit: 'Cuộn',
        usageType: 'SERVICE_SUPPLY',
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true }
  );

  if (v1?.inventoryItemId) {
    // SKU #1 at Q1 -> qty 0, threshold 5 -> OUT_OF_STOCK (with real Product image)
    await InventoryStock.findOneAndUpdate(
      { branchId: br1._id, inventoryItemId: v1.inventoryItemId },
      { $set: { quantity: 0, lowStockThreshold: 5, thresholdConfigured: true } },
      { upsert: true }
    );
    // Same SKU #1 at Q7 -> qty 15, threshold 5 -> HEALTHY (verifies SKU x branch isolation)
    await InventoryStock.findOneAndUpdate(
      { branchId: br2._id, inventoryItemId: v1.inventoryItemId },
      { $set: { quantity: 15, lowStockThreshold: 5, thresholdConfigured: true } },
      { upsert: true }
    );
  }
  if (v2?.inventoryItemId) {
    // SKU #2 at Q1 -> qty 3, threshold 8 -> LOW_STOCK
    await InventoryStock.findOneAndUpdate(
      { branchId: br1._id, inventoryItemId: v2.inventoryItemId },
      { $set: { quantity: 3, lowStockThreshold: 8, thresholdConfigured: true } },
      { upsert: true }
    );
  }
  // MATERIAL SKU at Binh Thanh -> qty 2, threshold 5 -> LOW_STOCK, imageUrl: null
  await InventoryStock.findOneAndUpdate(
    { branchId: br3._id, inventoryItemId: matUat._id },
    { $set: { quantity: 2, lowStockThreshold: 5, thresholdConfigured: true } },
    { upsert: true }
  );

  // 4. Relative VN Dates for repeatable UAT across current calendar
  const now = new Date();
  const todayVn = formatVnDate(now);
  const dMinus1 = shiftVnDate(todayVn, -1);
  const dMinus2 = shiftVnDate(todayVn, -2);
  const dMinus5 = shiftVnDate(todayVn, -5);
  const dMinus10 = shiftVnDate(todayVn, -10);
  const dMinus12 = shiftVnDate(todayVn, -12);
  const dMinus35 = shiftVnDate(todayVn, -35);
  const dMinus40 = shiftVnDate(todayVn, -40);
  const dPlus25 = shiftVnDate(todayVn, 25);

  const upsertOrderWithTimestamps = async (code, doc) => {
    const res = await Order.findOneAndUpdate(
      { code },
      { $set: doc },
      { upsert: true, new: true, timestamps: false }
    );
    if (doc.createdAt || doc.updatedAt) {
      await Order.collection.updateOne(
        { _id: res._id },
        {
          $set: {
            createdAt: doc.createdAt || res.createdAt,
            updatedAt: doc.updatedAt || doc.deliveredAt || doc.createdAt || res.updatedAt,
          },
        }
      );
    }
    return res;
  };

  const makeItem = (prod, variant, lineNet, qty = 1, disc = 0) => ({
    orderItemId: new mongoose.Types.ObjectId().toString(),
    productId: prod._id,
    variantId: variant._id,
    nameSnapshot: `${prod.name} - ${variant.label}`,
    skuSnapshot: variant.sku,
    image: variant.image || prod.images?.[0]?.url || null,
    unitPrice: lineNet + disc,
    quantity: qty,
    lineSubtotal: lineNet + disc,
    allocatedDiscount: disc,
    lineNet,
  });

  // UAT-01: Created previous period (-35d), delivered in current period (-2d) at Q1
  await upsertOrderWithTimestamps('ORD-UAT-01', {
    code: 'ORD-UAT-01',
    customerId: cust1?._id || null,
    contactSnapshot: { fullName: custUser1?.fullName || 'Khách UAT 01', phone: custUser1?.phone || '0900000001' },
    fulfillmentBranchId: br1._id,
    status: 'COMPLETED',
    paymentMethod: 'ONLINE_MOCK',
    items: [makeItem(p1, v1, 450000, 1, 50000)],
    pricing: { merchandiseSubtotal: 500000, voucherDiscount: 50000, shippingFee: 30000, totalAmount: 480000 },
    deliveredAt: vnAt(dMinus2, '14:30:00'),
    statusHistory: [{ status: 'COMPLETED', at: vnAt(dMinus2, '14:30:00'), note: 'UAT-01 cross-period delivery' }],
    createdAt: vnAt(dMinus35, '09:00:00'),
  });

  // UAT-01 + FREESHIP: Free shipping voucher must not subtract 30k twice from lineNet (Q1, Today)
  await upsertOrderWithTimestamps('ORD-UAT-FREESHIP', {
    code: 'ORD-UAT-FREESHIP',
    customerId: cust1?._id || null,
    contactSnapshot: { fullName: custUser1?.fullName || 'Khách UAT 01', phone: custUser1?.phone || '0900000001' },
    fulfillmentBranchId: br1._id,
    status: 'COMPLETED',
    paymentMethod: 'ONLINE_MOCK',
    items: [makeItem(p1, v1, 300000, 1, 0)],
    pricing: { merchandiseSubtotal: 300000, voucherDiscount: 30000, shippingFee: 30000, totalAmount: 300000 },
    voucher: { code: 'FREESHIP' },
    deliveredAt: vnAt(todayVn, '09:15:00'),
    statusHistory: [{ status: 'COMPLETED', at: vnAt(todayVn, '09:15:00') }],
    createdAt: vnAt(todayVn, '08:00:00'),
  });

  // UAT-02: Order completed previous period (-40d) + Refunded current period (-5d) at Q1 (shippingRefunded excluded)
  const ordUat02 = await upsertOrderWithTimestamps('ORD-UAT-02-SRC', {
    code: 'ORD-UAT-02-SRC',
    customerId: cust2?._id || null,
    contactSnapshot: { fullName: custUser2?.fullName || 'Khách UAT 02', phone: custUser2?.phone || '0900000002' },
    fulfillmentBranchId: br1._id,
    status: 'COMPLETED',
    paymentMethod: 'ONLINE_MOCK',
    items: [makeItem(p2, v2, 600000, 1, 0)],
    pricing: { merchandiseSubtotal: 600000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 630000 },
    deliveredAt: vnAt(dMinus40, '11:00:00'),
    createdAt: vnAt(dMinus40, '09:00:00'),
  });

  const retUat02 = await OrderReturn.findOneAndUpdate(
    { code: 'RET-UAT-02' },
    {
      $set: {
        code: 'RET-UAT-02',
        orderId: ordUat02._id,
        customerId: ordUat02.customerId,
        status: 'COMPLETED',
        reason: 'UAT-02 cross-period return',
        items: [],
        refundBreakdown: { merchandiseNet: 150000, shippingRefunded: 30000, total: 180000 },
      },
    },
    { upsert: true, new: true }
  );

  await OrderRefund.findOneAndUpdate(
    { code: 'RF-UAT-02' },
    {
      $set: {
        code: 'RF-UAT-02',
        cause: 'RETURN',
        orderReturnId: retUat02._id,
        orderId: ordUat02._id,
        amount: 180000,
        status: 'REFUNDED',
        refundedAt: vnAt(dMinus5, '16:00:00'),
      },
    },
    { upsert: true, new: true }
  );

  // Cancellation Refund Guard at Q7 (must NOT affect Q7 revenue because order never completed)
  const ordUatCancel = await upsertOrderWithTimestamps('ORD-UAT-CANCEL', {
    code: 'ORD-UAT-CANCEL',
    customerId: cust2?._id || null,
    contactSnapshot: { fullName: custUser2?.fullName || 'Khách UAT Cancel', phone: '0900000002' },
    fulfillmentBranchId: br2._id,
    status: 'CANCELLED',
    paymentMethod: 'ONLINE_MOCK',
    items: [makeItem(p1, v1, 220000, 1, 0)],
    pricing: { merchandiseSubtotal: 220000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 250000 },
    createdAt: vnAt(dMinus5, '10:00:00'),
  });

  await OrderRefund.findOneAndUpdate(
    { code: 'RF-UAT-CANCEL' },
    {
      $set: {
        code: 'RF-UAT-CANCEL',
        cause: 'CANCELLATION',
        orderId: ordUatCancel._id,
        amount: 250000,
        status: 'REFUNDED',
        refundedAt: vnAt(dMinus5, '11:00:00'),
      },
    },
    { upsert: true }
  );

  // UAT-18: Negative net revenue day/range at Binh Thanh (dMinus12: only refund -250k, 0 sales on dMinus12)
  const ordUatBtSrc = await upsertOrderWithTimestamps('ORD-UAT-BT-SRC', {
    code: 'ORD-UAT-BT-SRC',
    customerId: cust1?._id || null,
    contactSnapshot: { fullName: custUser1?.fullName || 'Khách UAT BT', phone: '0900000001' },
    fulfillmentBranchId: br3._id,
    status: 'COMPLETED',
    paymentMethod: 'ONLINE_MOCK',
    items: [makeItem(p2, v2, 500000, 1, 0)],
    pricing: { merchandiseSubtotal: 500000, voucherDiscount: 0, shippingFee: 0, totalAmount: 500000 },
    deliveredAt: vnAt(dMinus40, '13:00:00'),
    createdAt: vnAt(dMinus40, '12:00:00'),
  });

  await OrderRefund.findOneAndUpdate(
    { code: 'RF-UAT-BT-NEG' },
    {
      $set: {
        code: 'RF-UAT-BT-NEG',
        cause: 'RETURN',
        orderId: ordUatBtSrc._id,
        amount: 250000,
        status: 'REFUNDED',
        refundedAt: vnAt(dMinus12, '15:00:00'),
      },
    },
    { upsert: true }
  );

  // UAT-07 + UAT-14: Guest order & overdue >30d backlog PENDING order
  await upsertOrderWithTimestamps('ORD-UAT-GUEST', {
    code: 'ORD-UAT-GUEST',
    customerId: null,
    guestContactId: guest1._id,
    contactSnapshot: { fullName: guest1.fullName, phone: guest1.phone },
    fulfillmentBranchId: br2._id,
    status: 'COMPLETED',
    paymentMethod: 'COD',
    items: [makeItem(p1, v1, 200000, 1, 0)],
    pricing: { merchandiseSubtotal: 200000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 230000 },
    deliveredAt: vnAt(dMinus1, '17:00:00'),
    createdAt: vnAt(dMinus1, '12:00:00'),
  });

  await upsertOrderWithTimestamps('ORD-UAT-BACKLOG-OLD', {
    code: 'ORD-UAT-BACKLOG-OLD',
    customerId: cust2?._id || null,
    contactSnapshot: { fullName: 'Đơn tồn đọng > 35 ngày (UAT-14)', phone: '0900000099' },
    fulfillmentBranchId: br1._id,
    status: 'PENDING',
    paymentMethod: 'COD',
    items: [makeItem(p1, v1, 180000, 1, 0)],
    pricing: { merchandiseSubtotal: 180000, voucherDiscount: 0, shippingFee: 30000, totalAmount: 210000 },
    createdAt: vnAt(dMinus35, '08:00:00'),
  });

  // 5. Appointments UAT-03, UAT-04, UAT-05, UAT-14, UAT-17
  const upsertAppointmentWithTimestamps = async (code, doc) => {
    const res = await Appointment.findOneAndUpdate(
      { code },
      { $set: doc },
      { upsert: true, new: true, timestamps: false }
    );
    await Appointment.collection.updateOne(
      { _id: res._id },
      {
        $set: {
          createdAt: doc.createdAt || res.createdAt,
          updatedAt: doc.updatedAt || doc.completedAt || doc.createdAt || res.updatedAt,
        },
      }
    );
    return res;
  };

  // UAT-03: Created in current period (-2d), scheduled next month (+25d), Guest
  await upsertAppointmentWithTimestamps('APT-UAT-03', {
    code: 'APT-UAT-03',
    customerId: null,
    guestContactId: guest1._id,
    contactSnapshot: { fullName: guest1.fullName, phone: guest1.phone },
    petSnapshot: { name: 'Milo Guest' },
    branchId: br1._id,
    serviceType: 'MEDICAL',
    paymentMethod: 'PAY_AT_STORE',
    status: 'CONFIRMED',
    scheduledStart: vnAt(dPlus25, '09:00:00'),
    scheduledEnd: vnAt(dPlus25, '10:00:00'),
    scheduledDurationMinutes: 60,
    services: [
      {
        serviceId: medicalSvc._id,
        serviceName: medicalSvc.name,
        serviceType: 'MEDICAL',
        unitPrice: 250000,
        durationMinutes: 60,
        requiredStaffRole: 'VETERINARIAN',
        sequence: 1,
        scheduledStart: vnAt(dPlus25, '09:00:00'),
        scheduledEnd: vnAt(dPlus25, '10:00:00'),
        assignedStaffId: staff1._id,
        executionStatus: 'NOT_STARTED',
      },
    ],
    pricing: { subtotal: 250000, finalAmount: 250000, depositAmount: 75000, paidAmount: 75000, balanceAmount: 175000 },
    deposit: { status: 'HELD' },
    createdAt: vnAt(dMinus2, '10:00:00'),
  });

  // UAT-04: 2 COMPLETED segments + 1 IN_PROGRESS segment while appointment status is IN_PROGRESS
  await upsertAppointmentWithTimestamps('APT-UAT-04', {
    code: 'APT-UAT-04',
    customerId: cust1?._id || null,
    contactSnapshot: { fullName: custUser1?.fullName || 'Khách UAT 04', phone: '0900000001' },
    petSnapshot: { name: 'Buddy' },
    branchId: br1._id,
    serviceType: 'MIXED',
    paymentMethod: 'PAY_AT_STORE',
    status: 'IN_PROGRESS',
    scheduledStart: vnAt(dMinus1, '09:00:00'),
    scheduledEnd: vnAt(dMinus1, '12:00:00'),
    scheduledDurationMinutes: 180,
    services: [
      {
        serviceId: medicalSvc._id,
        serviceName: medicalSvc.name,
        serviceType: 'MEDICAL',
        unitPrice: 200000,
        durationMinutes: 60,
        requiredStaffRole: 'VETERINARIAN',
        sequence: 1,
        scheduledStart: vnAt(dMinus1, '09:00:00'),
        scheduledEnd: vnAt(dMinus1, '10:00:00'),
        assignedStaffId: staff1._id,
        executionStatus: 'COMPLETED',
        executionCompletedAt: vnAt(dMinus1, '10:00:00'),
      },
      {
        serviceId: groomingSvc._id,
        serviceName: groomingSvc.name,
        serviceType: 'GROOMING',
        unitPrice: 180000,
        durationMinutes: 60,
        requiredStaffRole: 'CARE_STAFF_GROOMER',
        sequence: 2,
        scheduledStart: vnAt(dMinus1, '10:00:00'),
        scheduledEnd: vnAt(dMinus1, '11:00:00'),
        assignedStaffId: staff1._id,
        executionStatus: 'COMPLETED',
        executionCompletedAt: vnAt(dMinus1, '11:00:00'),
      },
      {
        serviceId: groomingSvc._id,
        serviceName: groomingSvc.name,
        serviceType: 'GROOMING',
        unitPrice: 150000,
        durationMinutes: 60,
        requiredStaffRole: 'CARE_STAFF_GROOMER',
        sequence: 3,
        scheduledStart: vnAt(dMinus1, '11:00:00'),
        scheduledEnd: vnAt(dMinus1, '12:00:00'),
        assignedStaffId: staff1._id,
        executionStatus: 'IN_PROGRESS',
      },
    ],
    pricing: { subtotal: 530000, finalAmount: 530000, depositAmount: 159000, paidAmount: 159000, balanceAmount: 371000 },
    deposit: { status: 'HELD' },
    createdAt: vnAt(dMinus10, '11:00:00'),
  });

  // UAT-05: Deposit 30% + 70% balance COMPLETED appointment today at Q1 -> counts 420k once
  await upsertAppointmentWithTimestamps('APT-UAT-05', {
    code: 'APT-UAT-05',
    customerId: cust1?._id || null,
    contactSnapshot: { fullName: custUser1?.fullName || 'Khách UAT 05', phone: '0900000001' },
    petSnapshot: { name: 'Luna' },
    branchId: br1._id,
    serviceType: 'MEDICAL',
    paymentMethod: 'PAY_AT_STORE',
    status: 'COMPLETED',
    completedAt: vnAt(todayVn, '11:00:00'),
    scheduledStart: vnAt(todayVn, '10:00:00'),
    scheduledEnd: vnAt(todayVn, '11:00:00'),
    scheduledDurationMinutes: 60,
    services: [
      {
        serviceId: medicalSvc._id,
        serviceName: medicalSvc.name,
        serviceType: 'MEDICAL',
        unitPrice: 450000,
        durationMinutes: 60,
        requiredStaffRole: 'VETERINARIAN',
        sequence: 1,
        scheduledStart: vnAt(todayVn, '10:00:00'),
        scheduledEnd: vnAt(todayVn, '11:00:00'),
        assignedStaffId: staff1._id,
        executionStatus: 'COMPLETED',
        executionCompletedAt: vnAt(todayVn, '11:00:00'),
      },
    ],
    pricing: { subtotal: 450000, voucherDiscount: 30000, finalAmount: 420000, depositAmount: 126000, paidAmount: 420000, balanceAmount: 0 },
    deposit: { status: 'APPLIED' },
    createdAt: vnAt(dMinus5, '09:00:00'),
  });

  // UAT-14: Upcoming appointment within next 24h (now + 3h) at Q1
  const upcomingStart = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const upcomingEnd = new Date(upcomingStart.getTime() + 60 * 60 * 1000);
  await upsertAppointmentWithTimestamps('APT-UAT-UPCOMING-24H', {
    code: 'APT-UAT-UPCOMING-24H',
    customerId: cust2?._id || null,
    contactSnapshot: { fullName: 'Khách hẹn sắp tới (24h UAT)', phone: '0900000088' },
    petSnapshot: { name: 'Lucky' },
    branchId: br1._id,
    serviceType: 'GROOMING',
    paymentMethod: 'PAY_AT_STORE',
    status: 'CONFIRMED',
    scheduledStart: upcomingStart,
    scheduledEnd: upcomingEnd,
    scheduledDurationMinutes: 60,
    services: [
      {
        serviceId: groomingSvc._id,
        serviceName: groomingSvc.name,
        serviceType: 'GROOMING',
        unitPrice: 200000,
        durationMinutes: 60,
        requiredStaffRole: 'CARE_STAFF_GROOMER',
        sequence: 1,
        scheduledStart: upcomingStart,
        scheduledEnd: upcomingEnd,
        assignedStaffId: staff1._id,
        executionStatus: 'NOT_STARTED',
      },
    ],
    pricing: { subtotal: 200000, finalAmount: 200000 },
    createdAt: vnAt(dMinus1, '15:00:00'),
  });

  // UAT-17: Remaining Appointment statuses (PENDING_PAYMENT, PENDING_CONFIRMATION, NO_SHOW)
  const extraStatuses = [
    { code: 'APT-UAT-ST-PP', status: 'PENDING_PAYMENT', branchId: br2._id },
    { code: 'APT-UAT-ST-PC', status: 'PENDING_CONFIRMATION', branchId: br2._id },
    { code: 'APT-UAT-ST-NS', status: 'NO_SHOW', branchId: br2._id },
  ];
  for (const st of extraStatuses) {
    await upsertAppointmentWithTimestamps(st.code, {
      code: st.code,
      customerId: cust2?._id || null,
      contactSnapshot: { fullName: 'Khách Trạng Thái UAT', phone: '0900000077' },
      petSnapshot: { name: 'Mimi' },
      branchId: st.branchId,
      serviceType: 'MEDICAL',
      paymentMethod: 'PAY_AT_STORE',
      status: st.status,
      scheduledStart: vnAt(dMinus1, '13:00:00'),
      scheduledEnd: vnAt(dMinus1, '14:00:00'),
      scheduledDurationMinutes: 60,
      services: [
        {
          serviceId: medicalSvc._id,
          serviceName: medicalSvc.name,
          serviceType: 'MEDICAL',
          unitPrice: 200000,
          durationMinutes: 60,
          requiredStaffRole: 'VETERINARIAN',
          sequence: 1,
          scheduledStart: vnAt(dMinus1, '13:00:00'),
          scheduledEnd: vnAt(dMinus1, '14:00:00'),
          assignedStaffId: staff1._id,
          executionStatus: 'NOT_STARTED',
        },
      ],
      pricing: { subtotal: 200000, finalAmount: 200000 },
      createdAt: vnAt(dMinus1, '11:00:00'),
    });
  }

  console.log('✅ M23 Dashboard UAT Seed completed cleanly across Q1, Q7, Binh Thanh.');
  if (closeConnection) {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  seedDashboardUat({ closeConnection: true })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Dashboard UAT Seed failed:', err);
      process.exit(1);
    });
}

