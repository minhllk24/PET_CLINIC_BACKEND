/* eslint-disable no-console */
/**
 * MIGRATE LEGACY PRODUCTS SCRIPT
 * Di trú 100 sản phẩm gốc từ MySQL (PetMart legacy) sang MongoDB Atlas
 *
 * Tiêu chuẩn:
 * - Mã sản phẩm: SP-LEG-001 -> SP-LEG-100
 * - Danh mục: Ánh xạ 1:1 vào 5 danh mục chuẩn UI (thuc-an, do-dung-thiet-yeu, cham-soc-suc-khoe, do-choi, phu-kien)
 * - Biến thể: 1 biến thể 'Tiêu chuẩn' (sku: SP-LEG-xxx-01) với giá gốc
 * - Tồn kho: Khởi tạo InventoryItem và InventoryStock tại cả 3 chi nhánh (BR-000001: 100, BR-000002: 50, BR-000003: 30)
 * - Đảm bảo tính Idempotent (chạy nhiều lần an toàn, không sinh rác, không xóa đè 12 SP UAT)
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import config from '../shared/config.js';
import Category from '../modules/catalog/models/Category.js';
import Product from '../modules/catalog/models/Product.js';
import InventoryItem from '../modules/inventory/models/InventoryItem.js';
import InventoryStock from '../modules/inventory/models/InventoryStock.js';
import Branch from '../modules/branch/models/Branch.js';

export const runMigrateLegacyProducts = async () => {
  console.log('\n========================================================================');
  console.log('📦 [MIGRATION] BẮT ĐẦU DI TRÚ 100 SẢN PHẨM TỪ MYSQL SANG MONGODB ATLAS');
  console.log(`   Database Target: ${config.mongoUri?.replace(/:([^@]+)@/, ':****@')}`);
  console.log('========================================================================\n');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(config.mongoUri);
  }

  // 1. Đọc dữ liệu JSON 100 sản phẩm đã chuẩn hóa
  const jsonPath = path.resolve(__dirname, 'data/legacyProducts.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Không tìm thấy file dữ liệu: ${jsonPath}`);
  }
  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const legacyProducts = JSON.parse(rawData);
  console.log(`📂 Đã nạp ${legacyProducts.length} sản phẩm từ legacyProducts.json.`);

  // 2. Tra cứu 5 danh mục chuẩn trên MongoDB Atlas
  const categories = await Category.find({ status: 'ACTIVE' });
  const categoryMap = new Map();
  for (const cat of categories) {
    categoryMap.set(cat.slug, cat._id);
  }

  const REQUIRED_SLUGS = ['thuc-an', 'do-dung-thiet-yeu', 'cham-soc-suc-khoe', 'do-choi', 'phu-kien'];
  for (const slug of REQUIRED_SLUGS) {
    if (!categoryMap.has(slug)) {
      throw new Error(`Danh mục bắt buộc '${slug}' không tồn tại trong database! Hãy chạy seed danh mục trước.`);
    }
  }

  // 3. Tra cứu 3 chi nhánh thực tế
  const branches = await Branch.find({ status: 'ACTIVE' });
  if (branches.length === 0) {
    throw new Error('Chưa có chi nhánh nào hoạt động trong database! Cần ít nhất 1 chi nhánh để cấp tồn kho.');
  }
  console.log(`🏢 Đã tìm thấy ${branches.length} chi nhánh hoạt động: ${branches.map(b => b.code).join(', ')}.`);

  // 4. Tiến hành Upsert từng sản phẩm, biến thể và tồn kho
  console.log('\n🔄 Đang tiến hành tạo InventoryItem, phân bổ InventoryStock và lưu Product...');
  let migratedCount = 0;

  for (const p of legacyProducts) {
    const catId = categoryMap.get(p.categorySlug);
    const sku = `${p.code}-01`;

    // 4.1 Upsert InventoryItem
    const invItem = await InventoryItem.findOneAndUpdate(
      { sku },
      {
        $set: {
          sku,
          name: `${p.name} (Tiêu chuẩn)`,
          kind: 'PRODUCT',
          unit: 'Cái',
          status: 'ACTIVE'
        }
      },
      { upsert: true, new: true }
    );

    // 4.2 Cấp tồn kho cho cả 3 chi nhánh
    for (const br of branches) {
      const qty = br.code === 'BR-000001' ? 100 : (br.code === 'BR-000002' ? 50 : 30);
      await InventoryStock.findOneAndUpdate(
        { branchId: br._id, inventoryItemId: invItem._id },
        {
          $set: {
            branchId: br._id,
            inventoryItemId: invItem._id,
            quantity: qty,
            lowStockThreshold: 10,
            thresholdConfigured: true,
            version: 1
          }
        },
        { upsert: true }
      );
    }

    // 4.3 Chuẩn bị biến thể chuẩn (1 variant theo giá gốc)
    const variants = [
      {
        sku,
        label: 'Tiêu chuẩn',
        price: p.price,
        discountPercent: 0,
        finalPrice: p.price,
        inventoryItemId: invItem._id,
        status: 'ACTIVE'
      }
    ];

    // 4.4 Upsert Product document
    await Product.findOneAndUpdate(
      { productCode: p.code },
      {
        $set: {
          productCode: p.code,
          name: p.name,
          categoryId: catId,
          productType: 'SIMPLE',
          usageType: 'SALE',
          status: 'ACTIVE',
          origin: 'Chính hãng',
          description: p.description,
          images: p.images,
          variants
        }
      },
      { upsert: true, new: true }
    );

    migratedCount++;
    if (migratedCount % 20 === 0 || migratedCount === legacyProducts.length) {
      console.log(`   - Tiến độ: ${migratedCount}/${legacyProducts.length} sản phẩm di trú hoàn tất...`);
    }
  }

  // 5. Thống kê kiểm chứng sau di trú
  const totalInDb = await Product.countDocuments({ status: 'ACTIVE' });
  const categoryStats = await Product.aggregate([
    { $match: { status: 'ACTIVE' } },
    {
      $lookup: {
        from: 'categories',
        localField: 'categoryId',
        foreignField: '_id',
        as: 'cat'
      }
    },
    { $unwind: '$cat' },
    {
      $group: {
        _id: '$cat.slug',
        name: { $first: '$cat.name' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  console.log('\n========================================================================');
  console.log('🎉 DI TRÚ HOÀN TẤT THÀNH CÔNG!');
  console.log(`   - Tổng sản phẩm đang hoạt động trên Atlas: ${totalInDb} sản phẩm (12 UAT + ${migratedCount} MySQL)`);
  console.log('   - Phân bổ theo 5 danh mục:');
  for (const s of categoryStats) {
    console.log(`     + ${s.name} (${s._id}): ${s.count} sản phẩm`);
  }
  console.log('========================================================================\n');

  return { migratedCount, totalInDb, categoryStats };
};

// Thực thi nếu chạy trực tiếp qua CLI
if (process.argv[1]?.includes('migrateLegacyProducts')) {
  runMigrateLegacyProducts()
    .then(() => {
      console.log('✅ Hoàn tất script migrateLegacyProducts. Thoát tiến trình an toàn.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Lỗi trong quá trình di trú sản phẩm:', err);
      process.exit(1);
    });
}
