import mongoose from 'mongoose';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';
import Voucher from '../modules/order/models/Voucher.js';

export const VOUCHER_SEEDS = [
  // 1. Voucher giảm tiền mặt cho Đơn hàng Sản phẩm (Order Ecommerce)
  {
    code: 'GIAM40K_DON150K',
    name: 'Giảm 40,000đ cho đơn hàng từ 150,000đ',
    discountType: 'FIXED',
    discountValue: 40000,
    minOrderAmount: 150000,
    scope: 'ORDER',
    quota: 1000,
    usedCount: 0,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 2. Voucher giảm phần trăm có chặn trần (Capped Percentage)
  {
    code: 'GIAM10_CAP50',
    name: 'Giảm 10% tối đa 50,000đ cho đơn hàng',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxDiscountAmount: 50000,
    minOrderAmount: 100000,
    scope: 'ORDER',
    quota: 1000,
    usedCount: 0,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 3. Voucher Miễn phí vận chuyển (Freeship)
  {
    code: 'FREESHIP',
    name: 'Hỗ trợ 30,000đ phí vận chuyển toàn quốc',
    discountType: 'FIXED',
    discountValue: 30000,
    minOrderAmount: 100000,
    scope: 'ORDER',
    quota: 1000,
    usedCount: 0,
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
    quota: 1000,
    usedCount: 0,
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
    quota: 1000,
    usedCount: 0,
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
    quota: 1000,
    usedCount: 0,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 7. Voucher Test UI: Điều kiện đơn hàng cao (để FE test lỗi MIN_CONDITION_NOT_MET)
  {
    code: 'VIP100K_DON500K',
    name: 'Ưu đãi Khách VIP - Giảm 100,000đ cho đơn từ 500,000đ',
    discountType: 'FIXED',
    discountValue: 100000,
    minOrderAmount: 500000,
    scope: 'ORDER',
    quota: 500,
    usedCount: 0,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
  // 8. Voucher Test UI: Đã hết hạn (để FE test lỗi EXPIRED)
  {
    code: 'EXPIRED_TEST',
    name: 'Mã giảm giá đã hết hạn (Dành cho kiểm thử UI)',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minOrderAmount: 0,
    scope: 'ORDER',
    quota: 100,
    usedCount: 0,
    status: 'ACTIVE',
    effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2025-12-31T23:59:59.000Z'),
  },
  // 9. Voucher Test UI: Đã hết lượt sử dụng (để FE test lỗi QUOTA_EXCEEDED)
  {
    code: 'MAXOUT_TEST',
    name: 'Mã giảm giá đã hết số lượt (Dành cho kiểm thử UI)',
    discountType: 'FIXED',
    discountValue: 20000,
    minOrderAmount: 0,
    scope: 'ORDER',
    quota: 50,
    usedCount: 50,
    status: 'ACTIVE',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-12-31T23:59:59.000Z'),
  },
];

export const seedVouchers = async () => {
  try {
    console.log(`Connecting to MongoDB for vouchers seeding: ${config.mongoUri}...`);
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    logger.info('Connected to MongoDB for vouchers seeding');

    for (const vData of VOUCHER_SEEDS) {
      const existing = await Voucher.findOne({ code: vData.code });
      if (existing) {
        await Voucher.updateOne({ _id: existing._id }, { $set: vData });
        console.log(`[UPDATED] Voucher: ${vData.code.padEnd(16)} | ${vData.name} (${vData.scope})`);
      } else {
        await Voucher.create(vData);
        console.log(`[CREATED] Voucher: ${vData.code.padEnd(16)} | ${vData.name} (${vData.scope})`);
      }
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
if (require.main === module) {
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
