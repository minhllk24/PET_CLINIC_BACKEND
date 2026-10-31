import mongoose from 'mongoose';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';
import Voucher from '../modules/order/models/Voucher.js';

import Product from '../modules/catalog/models/Product.js';

export const VOUCHER_SEEDS = [
  // 1. Voucher giảm tiền mặt cho Đơn hàng Sản phẩm (Order Ecommerce) - Đang dùng
  {
    code: 'GIAM40K_DON150K',
    name: 'Giảm 40,000đ cho đơn hàng từ 150,000đ',
    discountType: 'FIXED',
    discountValue: 40000,
    minOrderAmount: 150000,
    scope: 'ORDER',
    quota: 500,
    usedCount: 142,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 2. Voucher giảm phần trăm có chặn trần - Sắp hết lượt
  {
    code: 'GIAM10_CAP50',
    name: 'Giảm 10% tối đa 50,000đ cho đơn hàng (Sắp hết lượt)',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxDiscountAmount: 50000,
    minOrderAmount: 100000,
    scope: 'ORDER',
    quota: 500,
    usedCount: 489,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 3. Voucher Miễn phí vận chuyển (Freeship)
  {
    code: 'FREESHIP',
    name: 'Miễn phí vận chuyển toàn quốc',
    discountType: 'FIXED',
    discountValue: 30000,
    minOrderAmount: 0,
    scope: 'ORDER',
    quota: 1000,
    usedCount: 320,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 4. Voucher giảm giá Dịch vụ Grooming / Spa / Khám bệnh (Service Scope)
  {
    code: 'SUMMER20',
    name: 'Khuyến mãi Mùa hè - Giảm 20% Dịch vụ & Spa thú cưng',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountAmount: 100000,
    minOrderAmount: 0,
    scope: 'SERVICE',
    quota: 200,
    usedCount: 85,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 5. Voucher giảm 50k cho Dịch vụ Y tế / Tiêm phòng
  {
    code: 'PETCLINIC50K',
    name: 'Ưu đãi Thành viên - Giảm 50,000đ cho Dịch vụ từ 200,000đ',
    discountType: 'FIXED',
    discountValue: 50000,
    minOrderAmount: 200000,
    scope: 'SERVICE',
    quota: 300,
    usedCount: 110,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 6. Voucher áp dụng riêng cho Sản phẩm
  {
    code: 'THUNHO20',
    name: 'Giảm 20% tối đa 100,000đ cho Sản phẩm thú nhỏ & Phụ kiện',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountAmount: 100000,
    minOrderAmount: 0,
    scope: 'PRODUCT',
    scopeRefs: [],
    quota: 200,
    usedCount: 45,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 7. Voucher Test UI: Điều kiện đơn hàng cao
  {
    code: 'VIP100K_DON500K',
    name: 'Ưu đãi Khách VIP - Giảm 100,000đ cho đơn từ 500,000đ',
    discountType: 'FIXED',
    discountValue: 100000,
    minOrderAmount: 500000,
    scope: 'ORDER',
    quota: 500,
    usedCount: 65,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 8. Voucher Test UI: Đã hết hạn (Hết hạn ngày 20/02/2026)
  {
    code: 'TET2026_EXPIRED',
    name: 'Mừng Xuân Bính Ngọ 2026 - Giảm 15% (Đã hết hạn)',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minOrderAmount: 0,
    scope: 'ORDER',
    quota: 100,
    usedCount: 38,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-02-20T23:59:59.000Z'),
  },
  // 9. Voucher Test UI: Đã hết số lượt (Cháy hàng)
  {
    code: 'HOTDEAL_MAXOUT',
    name: 'Deal Khai Trương Siêu Khủng - Giảm 50,000đ (Đã hết lượt)',
    discountType: 'FIXED',
    discountValue: 50000,
    minOrderAmount: 0,
    scope: 'ORDER',
    quota: 50,
    usedCount: 50,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 10. Voucher Flash Sale Khung Giờ Vàng
  {
    code: 'FLASHSALE50K',
    name: '⚡ Flash Sale Giờ Vàng - Giảm 50.000đ cho đơn từ 120.000đ',
    discountType: 'FIXED',
    discountValue: 50000,
    minOrderAmount: 120000,
    scope: 'ORDER',
    quota: 50,
    usedCount: 28,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-10-31T00:00:00.000Z'),
    effectiveTo: new Date('2026-10-31T23:59:59.000Z'),
  },
  // 11. Voucher Flash Sale Phụ kiện
  {
    code: 'FLASHACCESSORY',
    name: '⚡ Flash Sale Phụ Kiện - Giảm 30% tối đa 70.000đ',
    discountType: 'PERCENTAGE',
    discountValue: 30,
    maxDiscountAmount: 70000,
    minOrderAmount: 100000,
    scope: 'ORDER',
    quota: 30,
    usedCount: 12,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-10-31T00:00:00.000Z'),
    effectiveTo: new Date('2026-10-31T23:59:59.000Z'),
  },
];

export const seedVouchers = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    logger.info('Connected to MongoDB for vouchers seeding');

    // Dynamic resolution for THUNHO20 scopeRefs
    const activeProducts = await Product.find({ status: 'ACTIVE' }).select('_id').limit(10).lean();
    const productScopeRefs = activeProducts.map((p) => p._id);

    for (const vData of VOUCHER_SEEDS) {
      const dataToSave = { ...vData };
      if (dataToSave.code === 'THUNHO20' && productScopeRefs.length > 0) {
        dataToSave.scopeRefs = productScopeRefs;
      }

      await Voucher.updateOne(
        { code: dataToSave.code },
        { $set: dataToSave },
        { upsert: true }
      );
      console.log(`[UPSERTED] Voucher: ${dataToSave.code.padEnd(16)} | ${dataToSave.name} (${dataToSave.usedCount}/${dataToSave.quota} lượt)`);
    }

    console.log('\n========================================================================');
    console.log('              DANH SÁCH VOUCHER KHUYẾN MÃI DEMO ĐÃ TẠO (CHO FE HƯNG)     ');
    console.log('========================================================================');
    console.log('| Mã Voucher       | Loại       | Giảm           | Tối thiểu | Áp dụng    |');
    console.log('|------------------|------------|----------------|-----------|------------|');
    for (const v of VOUCHER_SEEDS) {
      const discountDisplay = v.discountType === 'PERCENTAGE'
        ? `${v.discountValue}% (Tối đa ${v.maxDiscountAmount?.toLocaleString('vi-VN')}đ)`
        : `${v.discountValue.toLocaleString('vi-VN')}đ`;
      const minDisplay = v.minOrderAmount > 0 ? `${v.minOrderAmount.toLocaleString('vi-VN')}đ` : '0đ';
      console.log(
        `| ${v.code.padEnd(16)} | ${v.discountType.padEnd(10)} | ${discountDisplay.padEnd(14)} | ${minDisplay.padEnd(9)} | ${v.scope.padEnd(10)} |`
      );
    }
    console.log('========================================================================\n');
    console.log('✅ Voucher seeding completed successfully!');
  } catch (error) {
    logger.error('Failed to seed vouchers:', error);
    console.error('Failed to seed vouchers:', error.message);
    throw error;
  }
};

// If run directly via CLI
const isDirectCli = process.argv[1] && (process.argv[1].endsWith('voucherSeed.js') || process.argv[1].endsWith('voucherSeed'));
if (isDirectCli) {
  seedVouchers()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(1);
    });
}
