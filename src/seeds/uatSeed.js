/* eslint-disable no-console */
import mongoose from 'mongoose';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';
import Branch from '../modules/branch/models/Branch.js';
import SystemSetting from '../modules/settings/models/SystemSetting.js';
import User from '../models/User.js';
import Customer from '../modules/customer/models/Customer.js';
import Category from '../modules/catalog/models/Category.js';
import Product from '../modules/catalog/models/Product.js';
import InventoryItem from '../modules/inventory/models/InventoryItem.js';
import InventoryStock from '../modules/inventory/models/InventoryStock.js';
import Order from '../modules/order/models/Order.js';
import OrderReturn from '../modules/order/models/OrderReturn.js';
import OrderRefund from '../modules/order/models/OrderRefund.js';
import Payment from '../modules/payment/models/Payment.js';
import { seedDemoUsers } from './demoUsersSeed.js';
import { seedVouchers } from './voucherSeed.js';

export const runUatSeed = async ({ dryRun = false } = {}) => {
  console.log(`\n========================================================================`);
  console.log(`🚀 [UAT_SEED] Khởi chạy bộ dữ liệu UAT E2E (Order, Return, Voucher, Staff)`);
  console.log(`   Database : ${config.mongoUri?.replace(/:([^@]+)@/, ':****@')}`);
  console.log(`   Chế độ   : ${dryRun ? 'DRY-RUN (Chỉ kiểm tra, KHÔNG ghi)' : 'LIVE SEED (Ghi an toàn, KHÔNG xóa dữ liệu cũ)'}`);
  console.log(`========================================================================\n`);

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.mongoUri);
  }

  // 1. Kiểm tra Branches & Cấu hình Commerce (Fulfillment Priority)
  console.log('📌 Bước 1: Đồng bộ Branch & SystemSetting (commerce)...');
  const branches = await Branch.find({ status: 'ACTIVE' }).sort({ code: 1 }).lean();
  if (branches.length === 0) {
    throw new Error('Chưa có chi nhánh (Branch) nào trong database! Vui lòng kiểm tra lại branches collection.');
  }

  const branch1 = branches.find((b) => b.code === 'BR-000001') || branches[0];
  const branch2 = branches.find((b) => b.code === 'BR-000002') || branches[1] || branch1;
  const branch3 = branches.find((b) => b.code === 'BR-000003') || branches[2] || branch1;
  const branchIds = [branch1._id, branch2._id, branch3._id];

  console.log(`   - Chi nhánh ưu tiên 1: ${branch1.code} (${branch1.name}) [${branch1._id}]`);
  console.log(`   - Chi nhánh ưu tiên 2: ${branch2.code} (${branch2.name}) [${branch2._id}]`);
  console.log(`   - Chi nhánh ưu tiên 3: ${branch3.code} (${branch3.name}) [${branch3._id}]`);

  if (!dryRun) {
    await SystemSetting.updateOne(
      { key: 'commerce' },
      {
        $set: {
          key: 'commerce',
          value: {
            fulfillmentBranchPriority: branchIds,
            freeShippingThreshold: 500000,
            standardShippingFee: 30000
          }
        }
      },
      { upsert: true }
    );
    console.log('   ✅ Đã cấu hình SystemSetting key "commerce" (Fulfillment priority + Free shipping threshold: 500,000đ)');
  }

  if (dryRun) {
    console.log('\n🔍 [DRY-RUN PREVIEW]');
    console.log(`   - Cấu hình SystemSetting key "commerce": [${branch1.code}, ${branch2.code}, ${branch3.code}]`);
    console.log(`   - Tài khoản Demo & Nhân sự: 7 Users (Admin, Manager, Doctor, Receptionist, Groomer, Nurse, Customer)`);
    console.log(`   - StaffProfiles & Ca trực: 4 nhân sự (Veterinarian, Receptionist, Groomer, Nurse), 28 ca trực`);
    console.log(`   - Danh mục: 4 nhóm (Thức ăn & Dinh dưỡng, Chăm sóc & Vệ sinh, Đồ chơi & Huấn luyện, Phụ kiện & Chuồng lồng)`);
    console.log(`   - Sản phẩm đa loài: 6 sản phẩm (Chó, Mèo, Thỏ/Bọ Ú, Chim/Vẹt, Cát vệ sinh, Đồ chơi KONG)`);
    console.log(`   - Tồn kho InventoryStock: 100 cái tại ${branch1.code}, 50 cái tại ${branch2.code}, 30 cái tại ${branch3.code}`);
    console.log(`   - Vouchers: 9 mã khuyến mãi (FREESHIP, GIAM10_CAP50, GIAM40K_DON150K, THUNHO20, ...)`);
    console.log(`   - Đơn hàng UAT: 12 đơn hàng (ORD-UAT-01 đến 12) bao phủ đầy đủ luồng PENDING -> COMPLETED, Return & Refund`);
    console.log('\n✅ [DRY-RUN] Kiểm tra hoàn tất thành công! Database KHÔNG bị thay đổi.');
    return;
  }

  // 2. Đồng bộ Tài khoản Demo, StaffProfile và Ca làm việc
  console.log('\n📌 Bước 2: Đồng bộ Tài khoản Demo, Phân quyền & Ca trực nhân sự...');
  if (!dryRun) {
    await seedDemoUsers();
    // Đảm bảo Customer profile tồn tại cho user customer
    const custUser = await User.findOne({ username: 'customer' });
    if (custUser) {
      await Customer.updateOne(
        { userId: custUser._id },
        {
          $set: {
            userId: custUser._id,
            contactPhone: custUser.phone,
            contactEmail: custUser.email,
            activationStatus: 'ACTIVATED',
            accountStatus: 'ACTIVE',
            activityBranchIds: [branch1._id]
          }
        },
        { upsert: true }
      );
      console.log(`   ✅ Đã liên kết Customer profile cho user ${custUser.username} (${custUser._id})`);
    }
  } else {
    console.log('   [DRY-RUN] Bỏ qua ghi seedDemoUsers');
  }

  // 3. Đồng bộ Danh mục & Sản phẩm Đa loài & Tồn kho
  console.log('\n📌 Bước 3: Đồng bộ Danh mục, Sản phẩm đa loài & Tồn kho chi nhánh...');
  const UAT_CATEGORIES = [
    { name: 'Thức ăn & Dinh dưỡng', slug: 'thuc-an-dinh-duong', status: 'ACTIVE' },
    { name: 'Chăm sóc & Vệ sinh', slug: 'cham-soc-ve-sinh', status: 'ACTIVE' },
    { name: 'Đồ chơi & Huấn luyện', slug: 'do-choi-huan-luyen', status: 'ACTIVE' },
    { name: 'Phụ kiện & Chuồng lồng', slug: 'phu-kien-chuong-long', status: 'ACTIVE' }
  ];

  const categoryMap = new Map();
  for (const cat of UAT_CATEGORIES) {
    if (!dryRun) {
      const doc = await Category.findOneAndUpdate(
        { slug: cat.slug },
        { $set: cat },
        { upsert: true, new: true }
      );
      categoryMap.set(cat.slug, doc._id);
    }
  }

  const foodCatId = categoryMap.get('thuc-an-dinh-duong') || (await Category.findOne({ slug: 'thuc-an-dinh-duong' }))?._id;
  const hygieneCatId = categoryMap.get('cham-soc-ve-sinh') || (await Category.findOne({ slug: 'cham-soc-ve-sinh' }))?._id;
  const toyCatId = categoryMap.get('do-choi-huan-luyen') || (await Category.findOne({ slug: 'do-choi-huan-luyen' }))?._id;

  const UAT_PRODUCTS = [
    {
      code: 'SP-UAT-DOG-001',
      name: 'Thức ăn hạt cao cấp cho chó Royal Canin Mini Adult',
      categoryId: foodCatId,
      productType: 'SIMPLE',
      usageType: 'SALE',
      status: 'ACTIVE',
      variants: [
        {
          sku: 'SP-UAT-DOG-001-01',
          label: 'Túi 2kg',
          price: 350000,
          discountPercent: 10,
          status: 'ACTIVE'
        }
      ]
    },
    {
      code: 'SP-UAT-CAT-001',
      name: 'Hạt dinh dưỡng cho mèo Whiskas vị cá biển tươi',
      categoryId: foodCatId,
      productType: 'VARIANT',
      usageType: 'SALE',
      status: 'ACTIVE',
      variants: [
        {
          sku: 'SP-UAT-CAT-001-01',
          label: '500g',
          price: 85000,
          discountPercent: 0,
          status: 'ACTIVE'
        },
        {
          sku: 'SP-UAT-CAT-001-02',
          label: '1.2kg',
          price: 180000,
          discountPercent: 5,
          status: 'ACTIVE'
        }
      ]
    },
    {
      code: 'SP-UAT-SMALL-001',
      name: 'Cỏ khô Alfalfa tự nhiên giàu dinh dưỡng cho Thỏ & Bọ Ú',
      categoryId: foodCatId,
      productType: 'SIMPLE',
      usageType: 'SALE',
      status: 'ACTIVE',
      variants: [
        {
          sku: 'SP-UAT-SMALL-001-01',
          label: 'Gói 500g',
          price: 120000,
          discountPercent: 0,
          status: 'ACTIVE'
        }
      ]
    },
    {
      code: 'SP-UAT-BIRD-001',
      name: 'Thức ăn hạt hỗn hợp giàu khoáng cho Vẹt và Chim cảnh',
      categoryId: foodCatId,
      productType: 'SIMPLE',
      usageType: 'SALE',
      status: 'ACTIVE',
      variants: [
        {
          sku: 'SP-UAT-BIRD-001-01',
          label: 'Hũ 500g',
          price: 95000,
          discountPercent: 0,
          status: 'ACTIVE'
        }
      ]
    },
    {
      code: 'SP-UAT-LITTER-001',
      name: 'Cát đậu nành hữu cơ Cature khử mùi vón nhanh cho Mèo 6L',
      categoryId: hygieneCatId,
      productType: 'SIMPLE',
      usageType: 'SALE',
      status: 'ACTIVE',
      variants: [
        {
          sku: 'SP-UAT-LITTER-001-01',
          label: 'Túi 6L (2.4kg)',
          price: 140000,
          discountPercent: 0,
          status: 'ACTIVE'
        }
      ]
    },
    {
      code: 'SP-UAT-TOY-001',
      name: 'Bóng gặm cao su tự nhiên huấn luyện chó KONG Classic',
      categoryId: toyCatId,
      productType: 'SIMPLE',
      usageType: 'SALE',
      status: 'ACTIVE',
      variants: [
        {
          sku: 'SP-UAT-TOY-001-01',
          label: 'Size M',
          price: 220000,
          discountPercent: 0,
          status: 'ACTIVE'
        }
      ]
    }
  ];

  const seededProducts = [];
  for (const prodData of UAT_PRODUCTS) {
    if (!dryRun) {
      // 3.1 Đảm bảo InventoryItem tồn tại cho từng biến thể
      const resolvedVariants = [];
      for (const v of prodData.variants) {
        const invItem = await InventoryItem.findOneAndUpdate(
          { sku: v.sku },
          {
            $set: {
              sku: v.sku,
              name: `${prodData.name} - ${v.label}`,
              kind: 'PRODUCT',
              unit: 'cái',
              status: 'ACTIVE'
            }
          },
          { upsert: true, new: true }
        );

        // 3.2 Nhập tồn kho cho các chi nhánh (BR-1: 100, BR-2: 50, BR-3: 30)
        await InventoryStock.updateOne(
          { branchId: branch1._id, inventoryItemId: invItem._id },
          { $set: { quantity: 100, lowStockThreshold: 10, thresholdConfigured: true, version: 1 } },
          { upsert: true }
        );
        await InventoryStock.updateOne(
          { branchId: branch2._id, inventoryItemId: invItem._id },
          { $set: { quantity: 50, lowStockThreshold: 10, thresholdConfigured: true, version: 1 } },
          { upsert: true }
        );
        await InventoryStock.updateOne(
          { branchId: branch3._id, inventoryItemId: invItem._id },
          { $set: { quantity: 30, lowStockThreshold: 5, thresholdConfigured: true, version: 1 } },
          { upsert: true }
        );

        resolvedVariants.push({
          ...v,
          inventoryItemId: invItem._id
        });
      }

      // 3.3 Upsert Product
      const existingProd = await Product.findOne({ $or: [{ productCode: prodData.code }, { name: prodData.name }] });
      let pDoc;
      if (existingProd) {
        existingProd.name = prodData.name;
        existingProd.categoryId = prodData.categoryId;
        existingProd.status = 'ACTIVE';
        existingProd.variants = resolvedVariants;
        await existingProd.save();
        pDoc = existingProd;
        console.log(`   - [SẢN PHẨM] Đã cập nhật: ${prodData.name} (${prodData.variants.length} SKU)`);
      } else {
        pDoc = await Product.create({
          productCode: prodData.code,
          name: prodData.name,
          categoryId: prodData.categoryId,
          productType: prodData.productType,
          usageType: prodData.usageType,
          status: 'ACTIVE',
          variants: resolvedVariants
        });
        console.log(`   - [SẢN PHẨM] Đã tạo mới: ${prodData.name} (${prodData.variants.length} SKU)`);
      }
      seededProducts.push(pDoc);
    }
  }

  // 4. Đồng bộ Vouchers
  console.log('\n📌 Bước 4: Đồng bộ Danh sách Voucher khuyến mãi...');
  if (!dryRun) {
    await seedVouchers();
  } else {
    console.log('   [DRY-RUN] Bỏ qua ghi seedVouchers');
  }

  // 5. Tạo bộ 12 Đơn hàng UAT (Orders) và Return/Refund
  console.log('\n📌 Bước 5: Đồng bộ 12 Đơn hàng UAT (TC01 - TC12) và Đổi trả hoàn tiền...');
  const customerUser = await User.findOne({ username: 'customer' }) || (await User.findOne({ systemRole: 'CUSTOMER' }));
  const customerId = customerUser ? customerUser._id : new mongoose.Types.ObjectId();

  const dogProd = seededProducts[0] || (await Product.findOne({ name: /Royal Canin/i }));
  const catProd = seededProducts[1] || (await Product.findOne({ name: /Whiskas/i }));
  const smallProd = seededProducts[2] || (await Product.findOne({ name: /Alfalfa/i }));
  const birdProd = seededProducts[3] || (await Product.findOne({ name: /Vẹt/i }));
  const litterProd = seededProducts[4] || (await Product.findOne({ name: /Cature/i }));
  const toyProd = seededProducts[5] || (await Product.findOne({ name: /KONG/i }));

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

  const defaultAddress = {
    recipientName: 'Lê Văn C',
    phone: '0905555555',
    line1: '123 Nguyễn Thị Minh Khai',
    ward: 'Phường Bến Thành',
    district: 'Quận 1',
    city: 'Hồ Chí Minh'
  };

  const defaultContact = {
    fullName: 'Lê Văn C',
    phone: '0905555555',
    email: 'customer.levanc@gmail.com'
  };

  const UAT_ORDERS = [
    // TC01: Chờ xác nhận - COD
    {
      code: 'ORD-UAT-01-PENDING-COD',
      status: 'PENDING',
      paymentMethod: 'COD',
      items: [
        {
          productId: dogProd._id,
          variantId: dogProd.variants[0]._id,
          nameSnapshot: `${dogProd.name} - ${dogProd.variants[0].label}`,
          skuSnapshot: dogProd.variants[0].sku,
          unitPrice: 350000,
          quantity: 1,
          lineSubtotal: 350000,
          allocatedDiscount: 0,
          lineNet: 350000
        }
      ],
      pricing: {
        merchandiseSubtotal: 350000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 380000
      },
      statusHistory: [{ status: 'PENDING', at: new Date(now.getTime() - 3600000), note: 'Khách đặt hàng COD' }]
    },
    // TC02: Chờ thanh toán - ONLINE_MOCK
    {
      code: 'ORD-UAT-02-PENDING-ONLINE',
      status: 'PENDING',
      paymentMethod: 'ONLINE_MOCK',
      items: [
        {
          productId: smallProd._id,
          variantId: smallProd.variants[0]._id,
          nameSnapshot: `${smallProd.name} - ${smallProd.variants[0].label}`,
          skuSnapshot: smallProd.variants[0].sku,
          unitPrice: 120000,
          quantity: 2,
          lineSubtotal: 240000,
          allocatedDiscount: 0,
          lineNet: 240000
        }
      ],
      pricing: {
        merchandiseSubtotal: 240000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 270000
      },
      statusHistory: [{ status: 'PENDING', at: new Date(now.getTime() - 1800000), note: 'Chờ thanh toán QR/Online' }]
    },
    // TC03: Đã xác nhận - COD
    {
      code: 'ORD-UAT-03-CONFIRMED',
      status: 'CONFIRMED',
      paymentMethod: 'COD',
      items: [
        {
          productId: litterProd._id,
          variantId: litterProd.variants[0]._id,
          nameSnapshot: `${litterProd.name} - ${litterProd.variants[0].label}`,
          skuSnapshot: litterProd.variants[0].sku,
          unitPrice: 140000,
          quantity: 2,
          lineSubtotal: 280000,
          allocatedDiscount: 0,
          lineNet: 280000
        }
      ],
      pricing: {
        merchandiseSubtotal: 280000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 310000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(now.getTime() - 7200000) },
        { status: 'CONFIRMED', at: new Date(now.getTime() - 3600000), note: 'Lễ tân đã xác nhận' }
      ]
    },
    // TC04: Đang đóng gói / xử lý - COD
    {
      code: 'ORD-UAT-04-PROCESSING',
      status: 'PROCESSING',
      paymentMethod: 'COD',
      items: [
        {
          productId: catProd._id,
          variantId: catProd.variants[1]._id,
          nameSnapshot: `${catProd.name} - ${catProd.variants[1].label}`,
          skuSnapshot: catProd.variants[1].sku,
          unitPrice: 180000,
          quantity: 1,
          lineSubtotal: 180000,
          allocatedDiscount: 0,
          lineNet: 180000
        },
        {
          productId: toyProd._id,
          variantId: toyProd.variants[0]._id,
          nameSnapshot: `${toyProd.name} - ${toyProd.variants[0].label}`,
          skuSnapshot: toyProd.variants[0].sku,
          unitPrice: 220000,
          quantity: 1,
          lineSubtotal: 220000,
          allocatedDiscount: 0,
          lineNet: 220000
        }
      ],
      pricing: {
        merchandiseSubtotal: 400000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 430000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(now.getTime() - 14400000) },
        { status: 'CONFIRMED', at: new Date(now.getTime() - 7200000) },
        { status: 'PROCESSING', at: new Date(now.getTime() - 3600000), note: 'Kho Quận 1 đang đóng gói' }
      ]
    },
    // TC05: Đang vận chuyển - COD
    {
      code: 'ORD-UAT-05-SHIPPED',
      status: 'SHIPPED',
      paymentMethod: 'COD',
      items: [
        {
          productId: birdProd._id,
          variantId: birdProd.variants[0]._id,
          nameSnapshot: `${birdProd.name} - ${birdProd.variants[0].label}`,
          skuSnapshot: birdProd.variants[0].sku,
          unitPrice: 95000,
          quantity: 2,
          lineSubtotal: 190000,
          allocatedDiscount: 0,
          lineNet: 190000
        }
      ],
      pricing: {
        merchandiseSubtotal: 190000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 220000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(now.getTime() - 86400000) },
        { status: 'CONFIRMED', at: new Date(now.getTime() - 72000000) },
        { status: 'PROCESSING', at: new Date(now.getTime() - 50000000) },
        { status: 'SHIPPED', at: new Date(now.getTime() - 20000000), note: 'Bàn giao ĐVVC' }
      ]
    },
    // TC06: Giao thành công còn hạn đổi trả (2 ngày trước, có voucher GIAM10_CAP50)
    {
      code: 'ORD-UAT-06-DELIVERED-RECENT',
      status: 'COMPLETED',
      paymentMethod: 'COD',
      deliveredAt: twoDaysAgo,
      voucher: { code: 'GIAM10_CAP50' },
      items: [
        {
          productId: dogProd._id,
          variantId: dogProd.variants[0]._id,
          nameSnapshot: `${dogProd.name} - ${dogProd.variants[0].label}`,
          skuSnapshot: dogProd.variants[0].sku,
          unitPrice: 350000,
          quantity: 2,
          lineSubtotal: 700000,
          allocatedDiscount: 50000,
          lineNet: 650000
        }
      ],
      pricing: {
        merchandiseSubtotal: 700000,
        voucherDiscount: 50000,
        shippingFee: 0, // Đơn trên 500k free ship
        totalAmount: 650000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(twoDaysAgo.getTime() - 86400000) },
        { status: 'CONFIRMED', at: new Date(twoDaysAgo.getTime() - 50000000) },
        { status: 'SHIPPED', at: new Date(twoDaysAgo.getTime() - 20000000) },
        { status: 'COMPLETED', at: twoDaysAgo, note: 'Khách đã nhận hàng và trả COD' }
      ]
    },
    // TC07: Giao thành công hết hạn đổi trả (10 ngày trước)
    {
      code: 'ORD-UAT-07-DELIVERED-EXPIRED',
      status: 'COMPLETED',
      paymentMethod: 'COD',
      deliveredAt: tenDaysAgo,
      items: [
        {
          productId: toyProd._id,
          variantId: toyProd.variants[0]._id,
          nameSnapshot: `${toyProd.name} - ${toyProd.variants[0].label}`,
          skuSnapshot: toyProd.variants[0].sku,
          unitPrice: 220000,
          quantity: 1,
          lineSubtotal: 220000,
          allocatedDiscount: 0,
          lineNet: 220000
        }
      ],
      pricing: {
        merchandiseSubtotal: 220000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 250000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(tenDaysAgo.getTime() - 86400000) },
        { status: 'COMPLETED', at: tenDaysAgo, note: 'Giao hàng thành công' }
      ]
    },
    // TC08: Hoàn tất đơn hàng thanh toán Online
    {
      code: 'ORD-UAT-08-COMPLETED-ONLINE',
      status: 'COMPLETED',
      paymentMethod: 'ONLINE_MOCK',
      deliveredAt: fifteenDaysAgo,
      items: [
        {
          productId: smallProd._id,
          variantId: smallProd.variants[0]._id,
          nameSnapshot: `${smallProd.name} - ${smallProd.variants[0].label}`,
          skuSnapshot: smallProd.variants[0].sku,
          unitPrice: 120000,
          quantity: 3,
          lineSubtotal: 360000,
          allocatedDiscount: 0,
          lineNet: 360000
        }
      ],
      pricing: {
        merchandiseSubtotal: 360000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 390000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(fifteenDaysAgo.getTime() - 86400000) },
        { status: 'COMPLETED', at: fifteenDaysAgo, note: 'Hoàn tất đơn hàng' }
      ]
    },
    // TC09: Đã hủy bởi Khách hàng (COD)
    {
      code: 'ORD-UAT-09-CANCELLED-CUSTOMER',
      status: 'CANCELLED',
      paymentMethod: 'COD',
      items: [
        {
          productId: catProd._id,
          variantId: catProd.variants[0]._id,
          nameSnapshot: `${catProd.name} - ${catProd.variants[0].label}`,
          skuSnapshot: catProd.variants[0].sku,
          unitPrice: 85000,
          quantity: 1,
          lineSubtotal: 85000,
          allocatedDiscount: 0,
          lineNet: 85000
        }
      ],
      pricing: {
        merchandiseSubtotal: 85000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 115000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(now.getTime() - 10000000) },
        { status: 'CANCELLED', at: new Date(now.getTime() - 5000000), note: 'Khách hàng hủy đơn: Đổi ý không mua nữa' }
      ]
    },
    // TC10: Đã hủy do Hết hạn thanh toán Online
    {
      code: 'ORD-UAT-10-CANCELLED-EXPIRED',
      status: 'CANCELLED',
      paymentMethod: 'ONLINE_MOCK',
      items: [
        {
          productId: dogProd._id,
          variantId: dogProd.variants[0]._id,
          nameSnapshot: `${dogProd.name} - ${dogProd.variants[0].label}`,
          skuSnapshot: dogProd.variants[0].sku,
          unitPrice: 350000,
          quantity: 1,
          lineSubtotal: 350000,
          allocatedDiscount: 0,
          lineNet: 350000
        }
      ],
      pricing: {
        merchandiseSubtotal: 350000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 380000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(now.getTime() - 7200000) },
        { status: 'CANCELLED', at: new Date(now.getTime() - 3600000), note: 'Tự động hủy: Hết hạn thanh toán QR 30 phút' }
      ]
    },
    // TC11: Đơn hàng Đang có yêu cầu Đổi trả (Return REQUESTED)
    {
      code: 'ORD-UAT-11-RETURN-REQUESTED',
      status: 'COMPLETED',
      paymentMethod: 'COD',
      deliveredAt: twoDaysAgo,
      items: [
        {
          productId: litterProd._id,
          variantId: litterProd.variants[0]._id,
          nameSnapshot: `${litterProd.name} - ${litterProd.variants[0].label}`,
          skuSnapshot: litterProd.variants[0].sku,
          unitPrice: 140000,
          quantity: 2,
          lineSubtotal: 280000,
          allocatedDiscount: 0,
          lineNet: 280000,
          returnReservedQty: 1,
          returnedQty: 0
        }
      ],
      pricing: {
        merchandiseSubtotal: 280000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 310000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(twoDaysAgo.getTime() - 86400000) },
        { status: 'COMPLETED', at: twoDaysAgo, note: 'Khách nhận hàng COD' }
      ]
    },
    // TC12: Đơn hàng Đã hoàn tất Đổi trả & Hoàn tiền (Return COMPLETED + Refunded)
    {
      code: 'ORD-UAT-12-RETURN-REFUNDED',
      status: 'COMPLETED',
      paymentMethod: 'ONLINE_MOCK',
      deliveredAt: fiveDaysAgo(now),
      items: [
        {
          productId: birdProd._id,
          variantId: birdProd.variants[0]._id,
          nameSnapshot: `${birdProd.name} - ${birdProd.variants[0].label}`,
          skuSnapshot: birdProd.variants[0].sku,
          unitPrice: 95000,
          quantity: 2,
          lineSubtotal: 190000,
          allocatedDiscount: 0,
          lineNet: 190000,
          returnReservedQty: 0,
          returnedQty: 1,
          refundedNet: 95000
        }
      ],
      pricing: {
        merchandiseSubtotal: 190000,
        voucherDiscount: 0,
        shippingFee: 30000,
        totalAmount: 220000
      },
      statusHistory: [
        { status: 'PENDING', at: new Date(now.getTime() - 500000000) },
        { status: 'COMPLETED', at: fiveDaysAgo(now), note: 'Đơn giao thành công' }
      ]
    }
  ];

  function fiveDaysAgo(base) {
    return new Date(base.getTime() - 5 * 24 * 60 * 60 * 1000);
  }

  for (const oData of UAT_ORDERS) {
    if (!dryRun) {
      const orderItems = oData.items.map((it) => ({
        ...it,
        orderItemId: new mongoose.Types.ObjectId().toString()
      }));

      // Payment mock
      const paymentDoc = await Payment.findOneAndUpdate(
        { code: `PAY-${oData.code}` },
        {
          $set: {
            code: `PAY-${oData.code}`,
            target: { type: 'ORDER' },
            kind: 'ORDER',
            method: oData.paymentMethod,
            amount: oData.pricing.totalAmount,
            status: ['COMPLETED', 'DELIVERED'].includes(oData.status) ? 'PAID' : (oData.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING'),
            paidAt: ['COMPLETED', 'DELIVERED'].includes(oData.status) ? (oData.deliveredAt || now) : null
          }
        },
        { upsert: true, new: true }
      );

      const orderDoc = await Order.findOneAndUpdate(
        { code: oData.code },
        {
          $set: {
            code: oData.code,
            customerId,
            fulfillmentBranchId: branch1._id,
            status: oData.status,
            paymentMethod: oData.paymentMethod,
            payment: {
              paymentId: paymentDoc._id,
              status: paymentDoc.status
            },
            items: orderItems,
            pricing: oData.pricing,
            voucher: oData.voucher || null,
            deliveredAt: oData.deliveredAt || null,
            shippingAddress: defaultAddress,
            contactSnapshot: defaultContact,
            statusHistory: oData.statusHistory
          }
        },
        { upsert: true, new: true }
      );

      paymentDoc.target.id = orderDoc._id;
      await paymentDoc.save();

      // Xử lý tạo OrderReturn cho TC11
      if (oData.code === 'ORD-UAT-11-RETURN-REQUESTED') {
        const item = orderDoc.items[0];
        await OrderReturn.findOneAndUpdate(
          { code: 'RET-UAT-11' },
          {
            $set: {
              code: 'RET-UAT-11',
              orderId: orderDoc._id,
              customerId,
              status: 'REQUESTED',
              reason: 'Bao bì bị rách nhẹ khi vận chuyển',
              items: [
                {
                  orderItemId: item.orderItemId,
                  productId: item.productId,
                  productName: item.nameSnapshot,
                  orderedQty: item.quantity,
                  alreadyReturnedQty: 0,
                  requestedQty: 1,
                  refundAmount: item.unitPrice
                }
              ],
              refundBreakdown: {
                merchandiseNet: item.unitPrice,
                shippingRefunded: 0,
                total: item.unitPrice
              },
              history: [
                { status: 'REQUESTED', at: new Date(now.getTime() - 3600000), note: 'Khách gửi yêu cầu trả hàng' }
              ]
            }
          },
          { upsert: true }
        );
        console.log(`   - [ORDER_RETURN] Đã tạo yêu cầu đổi trả RET-UAT-11 (REQUESTED) cho đơn ${oData.code}`);
      }

      // Xử lý tạo OrderReturn + OrderRefund cho TC12
      if (oData.code === 'ORD-UAT-12-RETURN-REFUNDED') {
        const item = orderDoc.items[0];
        const refundDoc = await OrderRefund.findOneAndUpdate(
          { code: 'REF-UAT-12' },
          {
            $set: {
              code: 'REF-UAT-12',
              cause: 'RETURN',
              orderId: orderDoc._id,
              amount: item.unitPrice,
              status: 'REFUNDED',
              provider: 'MOCK',
              refundedAt: new Date(now.getTime() - 86400000),
              history: [
                { status: 'PENDING', at: new Date(now.getTime() - 172800000) },
                { status: 'REFUNDED', at: new Date(now.getTime() - 86400000), note: 'Quản lý duyệt hoàn tiền ví MOCK' }
              ]
            }
          },
          { upsert: true, new: true }
        );

        await OrderReturn.findOneAndUpdate(
          { code: 'RET-UAT-12' },
          {
            $set: {
              code: 'RET-UAT-12',
              orderId: orderDoc._id,
              customerId,
              status: 'COMPLETED',
              reason: 'Thú cưng không hợp hạt, xin đổi trả',
              refundId: refundDoc._id,
              items: [
                {
                  orderItemId: item.orderItemId,
                  productId: item.productId,
                  productName: item.nameSnapshot,
                  orderedQty: item.quantity,
                  alreadyReturnedQty: 1,
                  requestedQty: 1,
                  refundAmount: item.unitPrice
                }
              ],
              refundBreakdown: {
                merchandiseNet: item.unitPrice,
                shippingRefunded: 0,
                total: item.unitPrice
              },
              history: [
                { status: 'REQUESTED', at: new Date(now.getTime() - 300000000) },
                { status: 'PROCESSING', at: new Date(now.getTime() - 250000000) },
                { status: 'RECEIVED', at: new Date(now.getTime() - 200000000) },
                { status: 'APPROVED', at: new Date(now.getTime() - 150000000) },
                { status: 'COMPLETED', at: new Date(now.getTime() - 86400000), note: 'Hoàn tiền thành công' }
              ]
            }
          },
          { upsert: true }
        );

        refundDoc.orderReturnId = (await OrderReturn.findOne({ code: 'RET-UAT-12' }))._id;
        await refundDoc.save();
        console.log(`   - [ORDER_RETURN] Đã tạo RET-UAT-12 (COMPLETED) & REF-UAT-12 (REFUNDED) cho đơn ${oData.code}`);
      }

      console.log(`   - [ĐƠN HÀNG] Đã upsert ${oData.code.padEnd(28)} | ${oData.status.padEnd(10)} | ${oData.paymentMethod.padEnd(11)} | ${oData.pricing.totalAmount.toLocaleString('vi-VN')}đ`);
    }
  }

  console.log('\n========================================================================');
  console.log('✅ HOÀN TẤT SEED DỮ LIỆU UAT THÀNH CÔNG!');
  console.log('========================================================================\n');
};

// Direct CLI invocation
const isDirectCli = process.argv[1] && (process.argv[1].endsWith('uatSeed.js') || process.argv[1].endsWith('uatSeed'));
if (isDirectCli) {
  const dryRun = process.argv.includes('--dry-run');
  runUatSeed({ dryRun })
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Lỗi seed UAT:', err);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(1);
    });
}
