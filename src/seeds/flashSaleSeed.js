import mongoose from 'mongoose';
import FlashSale from '../modules/flash-sale/models/FlashSale.js';
import Product from '../modules/catalog/models/Product.js';
import { logger } from '../shared/logger.js';

export const seedFlashSales = async () => {
  try {
    const products = await Product.find({ status: { $ne: 'ARCHIVED' } }).limit(10).lean();
    if (products.length === 0) {
      logger.info('No products found to link with flash sales, skipping');
      return;
    }

    const now = Date.now();
    const adminId = new mongoose.Types.ObjectId();

    const campaigns = [
      {
        code: 'FS-RUNNING-01',
        name: 'Giờ Vàng Giá Sốc - Bùng Nổ Ưu Đãi',
        description: 'Chiến dịch Flash Sale đang diễn ra trực tiếp trên toàn hệ thống',
        startAt: new Date(now - 2 * 3600000),
        endAt: new Date(now + 72 * 3600000),
        activationMode: 'AUTO',
        isPaused: false,
        status: 'PUBLISHED',
        items: products.slice(0, 6).map((p, idx) => {
          const basePrice = p.variants?.[0]?.price || p.price || (180000 + idx * 35000);
          const discountRatio = [0.7, 0.65, 0.6, 0.75, 0.68, 0.72][idx % 6];
          return {
            productId: p._id,
            variantId: p.variants?.[0]?._id || null,
            sku: p.variants?.[0]?.sku || `SKU-FS-00${idx + 1}`,
            productName: p.name,
            variantLabel: p.variants?.[0]?.label || 'Mặc định',
            originalPrice: basePrice,
            salePrice: Math.round((basePrice * discountRatio) / 1000) * 1000,
            quantityLimit: 50,
            soldQuantity: 10 + idx * 3,
          };
        }),
        createdBy: adminId,
      },
      {
        code: 'FS-UPCOMING-02',
        name: 'Flash Sale Cuối Tuần - Giảm Đến 50%',
        description: 'Chiến dịch săn sale sắp bắt đầu vào ngày mai',
        startAt: new Date(now + 24 * 3600000),
        endAt: new Date(now + 48 * 3600000),
        activationMode: 'AUTO',
        isPaused: false,
        status: 'PUBLISHED',
        items: products.slice(2, 4).map((p, idx) => ({
          productId: p._id,
          sku: p.variants?.[0]?.sku || `SKU-UPCOMING-${idx + 1}`,
          originalPrice: p.price || 200000,
          salePrice: Math.round((p.price || 200000) * 0.6),
          quantityLimit: 30,
          soldQuantity: 0,
        })),
        createdBy: adminId,
      },
      {
        code: 'FS-PAUSED-03',
        name: 'Siêu Sale Dinh Dưỡng Thú Cưng (Tạm Dừng)',
        description: 'Chiến dịch đang tạm ngưng do điều chỉnh kỹ thuật kho',
        startAt: new Date(now - 1 * 3600000),
        endAt: new Date(now + 5 * 3600000),
        activationMode: 'MANUAL',
        isPaused: true,
        status: 'PUBLISHED',
        items: products.slice(4, 5).map((p) => ({
          productId: p._id,
          sku: p.variants?.[0]?.sku || 'SKU-PAUSED-001',
          originalPrice: p.price || 350000,
          salePrice: Math.round((p.price || 350000) * 0.75),
          quantityLimit: 20,
          soldQuantity: 5,
        })),
        createdBy: adminId,
      },
      {
        code: 'FS-ENDED-04',
        name: 'Flash Sale Mùa Thu Vừa Qua',
        description: 'Chiến dịch ưu đãi đã kết thúc thành công',
        startAt: new Date(now - 72 * 3600000),
        endAt: new Date(now - 24 * 3600000),
        activationMode: 'AUTO',
        isPaused: false,
        status: 'PUBLISHED',
        items: products.slice(0, 2).map((p, idx) => ({
          productId: p._id,
          sku: `SKU-ENDED-${idx + 1}`,
          originalPrice: p.price || 180000,
          salePrice: Math.round((p.price || 180000) * 0.8),
          quantityLimit: 50,
          soldQuantity: 50,
        })),
        createdBy: adminId,
      },
      {
        code: 'FS-DRAFT-05',
        name: 'Bản Nháp Chiến Dịch Tháng 12',
        description: 'Đang lên kế hoạch danh mục hàng khuyến mãi mùa đông',
        startAt: new Date(now + 7 * 24 * 3600000),
        endAt: new Date(now + 8 * 24 * 3600000),
        activationMode: 'AUTO',
        isPaused: false,
        status: 'DRAFT',
        items: products.slice(5, 7).map((p, idx) => ({
          productId: p._id,
          sku: p.variants?.[0]?.sku || `SKU-DRAFT-${idx + 1}`,
          originalPrice: p.price || 250000,
          salePrice: Math.round((p.price || 250000) * 0.7),
          quantityLimit: 25,
          soldQuantity: 0,
        })),
        createdBy: adminId,
      },
    ];

    for (const c of campaigns) {
      await FlashSale.findOneAndUpdate(
        { code: c.code },
        { $set: c },
        { upsert: true, new: true }
      );
    }

    console.log(`⚡ Đã seed thành công 5 chiến dịch Flash Sale đủ 5 trạng thái (RUNNING, UPCOMING, PAUSED, ENDED, DRAFT)`);
  } catch (err) {
    logger.error('Error seeding Flash Sales:', err);
  }
};

