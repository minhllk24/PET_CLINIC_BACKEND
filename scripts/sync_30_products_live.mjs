import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const productsData = JSON.parse(fs.readFileSync('scripts/complete_30_products_data.json', 'utf8'));

async function sync() {
  console.log('========================================================================');
  console.log('🚀 [SYNC 30 PRODUCTS] Bắt đầu đồng bộ 30 sản phẩm & 3 biến thể hình ảnh vào MongoDB Atlas');
  console.log('========================================================================');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment!');
  }

  await mongoose.connect(mongoUri);
  console.log('✅ Đã kết nối MongoDB Atlas thành công');

  const db = mongoose.connection.db;
  const Product = (await import('../src/modules/catalog/models/Product.js')).default;
  const InventoryItem = (await import('../src/modules/inventory/models/InventoryItem.js')).default;
  const InventoryStock = (await import('../src/modules/inventory/models/InventoryStock.js')).default;
  const Branch = (await import('../src/modules/branch/models/Branch.js')).default;
  const Category = (await import('../src/modules/catalog/models/Category.js')).default;

  const branches = await Branch.find({ status: 'ACTIVE' }).lean();
  console.log(`Tìm thấy ${branches.length} chi nhánh đang hoạt động`);

  let updatedCount = 0;

  for (const pData of productsData) {
    let product = await Product.findOne({ productCode: pData.code });
    if (!product) {
      // Find category
      let category = await Category.findOne({ slug: pData.categorySlug });
      if (!category) {
        category = await Category.findOne({ status: 'ACTIVE' });
      }
      product = new Product({
        productCode: pData.code,
        name: pData.name,
        description: pData.description,
        origin: pData.origin,
        categoryId: category._id,
        productType: 'VARIANT',
        usageType: 'SALE',
        status: 'ACTIVE'
      });
    } else {
      product.name = pData.name;
      product.description = pData.description;
      product.origin = pData.origin;
      product.productType = 'VARIANT';
      product.status = 'ACTIVE';
    }

    // Prepare 3 images
    product.images = pData.variants.map((v, idx) => ({
      id: `img-${idx + 1}`,
      url: v.image,
      isPrimary: idx === 0,
      sortOrder: idx
    }));

    // Prepare variants & InventoryItems
    const resolvedVariants = [];
    let seq = 1;

    for (const v of pData.variants) {
      const sku = `${pData.code}-${String(seq).padStart(2, '0')}`;
      const finalPrice = Math.round(v.price * (1 - (v.discountPercent || 0) / 100));

      const invItem = await InventoryItem.findOneAndUpdate(
        { sku },
        {
          $set: {
            sku,
            name: `${pData.name} - ${v.label}`,
            kind: 'PRODUCT',
            unit: 'cái',
            status: 'ACTIVE'
          }
        },
        { upsert: true, new: true }
      );

      // Ensure stock across all branches
      for (const br of branches) {
        const qty = br.code === 'BR-000001' ? 120 : (br.code === 'BR-000002' ? 60 : 40);
        await InventoryStock.findOneAndUpdate(
          { branchId: br._id, inventoryItemId: invItem._id },
          {
            $set: {
              quantity: qty,
              lowStockThreshold: 10,
              thresholdConfigured: true,
              version: 1
            }
          },
          { upsert: true }
        );
      }

      resolvedVariants.push({
        sku,
        label: v.label,
        price: v.price,
        discountPercent: v.discountPercent || 0,
        finalPrice,
        image: v.image,
        inventoryItemId: invItem._id,
        status: 'ACTIVE'
      });
      seq++;
    }

    product.variants = resolvedVariants;
    await product.save();
    updatedCount++;
    console.log(`[${updatedCount}/30] ✅ Đã cập nhật sản phẩm: ${product.productCode} | ${product.name} (3 variants với ảnh sắc nét)`);
  }

  // Also fix SP-BANNER-001 -> 004 and SP-UAT-... in MongoDB Atlas if present
  console.log('\n📌 Kiểm tra và cập nhật các sản phẩm Banner / UAT để tránh ảnh rỗng trên Frontend...');
  const bannerImages = {
    'SP-BANNER-001': [
      'https://cdn.hstatic.net/products/1000217401/c4be79046a7448ef97914daa2320f165_f5844f1d85224026b037c93b985585f3.png',
      'https://cdn.hstatic.net/products/1000217401/1da4377914e641609d225316bb722ba2_2e4729b1e2e44c368c472b57d7177c32.png',
      'https://cdn.hstatic.net/products/1000217401/8d610964ac9349ecbc7ece26e0569566_5e40830de67c4c24abba0d0c77e2079d.png'
    ],
    'SP-BANNER-002': [
      'https://product.hstatic.net/1000217401/product/108_d6cf7173244b44e999f8f8eb5ccf1745.png',
      'https://cdn.hstatic.net/products/1000104513/thiet_ke_chua_co_ten__36__de2feab3e8d04692a226560f4a0c6caa.png',
      'https://cdn.hstatic.net/products/1000104513/thiet_ke_chua_co_ten__35__7aecd32a1dc44fda8a69973b69344ca7.png'
    ],
    'SP-BANNER-003': [
      'https://www.petmart.vn/wp-content/uploads/2018/09/khay-ve-sinh-cho-meo-makar-cat-litter-station.jpg',
      'https://www.petmart.vn/wp-content/uploads/2018/09/ve-sinh-cho-meo-makar-cat-litter-station1.jpg',
      'https://www.petmart.vn/wp-content/uploads/2018/09/ve-sinh-cho-meo-makar-cat-litter-station2.jpg'
    ],
    'SP-BANNER-004': [
      'https://www.petmart.vn/wp-content/uploads/2021/08/vong-co-cho-meo-vai-du-co-be-hand-in-hand-pet-collar.jpg',
      'https://www.petmart.vn/wp-content/uploads/2019/05/vong-co-cho-meo-kem-day-dat-co-mini-hand-in-hand.jpg',
      'https://www.petmart.vn/wp-content/uploads/2019/05/vong-co-cho-meo-kem-day-dat-hand-in-hand-co-mini1.jpg'
    ],
    'SP-UAT-DOG-001': [
      'https://www.petmart.vn/wp-content/uploads/2021/06/thuc-an-cho-cho-truong-thanh-co-nho-royal-canin-mini-adult1.jpg',
      'https://www.petmart.vn/wp-content/uploads/2021/06/thuc-an-cho-cho-truong-thanh-co-nho-royal-canin-mini-adult2.jpg',
      'https://fexafkqzpbzjcupvbfhe.supabase.co/storage/v1/object/public/product-images/products/7bf9a2ec-7d5e-45be-a8fa-2f8171d5aa5a/029c8427-e0f4-44b7-9043-c1aef4d90eb5/th-c-n-h-t-cho-ch-tr-ng-th-nh-gi-ng-nh-royal-canin.png'
    ],
    'SP-UAT-CAT-001': [
      'https://fexafkqzpbzjcupvbfhe.supabase.co/storage/v1/object/public/product-images/products/1b7e6a49-8c76-47fa-a0f8-514ccebd0520/4b402154-86cc-4e51-8571-ca76d0a6e2a4/h-t-whiskas-adult-cho-m-o-tr-ng-th-nh.png',
      'https://fexafkqzpbzjcupvbfhe.supabase.co/storage/v1/object/public/product-images/products/1b7e6a49-8c76-47fa-a0f8-514ccebd0520/911c1642-b6d0-4f34-a877-085103a2c462/h-t-whiskas-adult-cho-m-o-tr-ng-th-nh.png',
      'https://fexafkqzpbzjcupvbfhe.supabase.co/storage/v1/object/public/product-images/products/1b7e6a49-8c76-47fa-a0f8-514ccebd0520/72c765e4-25ab-48e1-b85b-c6d05064a862/h-t-whiskas-adult-cho-m-o-tr-ng-th-nh.png'
    ],
    'SP-UAT-SMALL-001': [
      'https://khopetshop.net/assets/images/products/19032025041109_23293.jpg',
      'https://khopetshop.net/assets/images/products/19032025041109_232931.jpg',
      'https://khopetshop.net/assets/images/products/21092022010303_45489.png'
    ],
    'SP-UAT-BIRD-001': [
      'https://product.hstatic.net/1000217401/product/10_de86dc61cab3485b9a33bf3ff80edd70.png',
      'https://product.hstatic.net/1000217401/product/9_1__ed5e3353d74343c5b9d2046db206d241.png',
      'https://khopetshop.net/assets/images/products/19032025040921_63107.jpg'
    ],
    'SP-UAT-LITTER-001': [
      'https://fexafkqzpbzjcupvbfhe.supabase.co/storage/v1/object/public/product-images/products/63fe4e0f-e1a3-46f0-bac4-cafd329536f9/ea9e0ab4-c74c-4be5-a5c0-b9c0c9c5429c/c-t-u-n-nh-cho-m-o-cature-tofu-paddy-pet-shop.png',
      'https://fexafkqzpbzjcupvbfhe.supabase.co/storage/v1/object/public/product-images/products/63fe4e0f-e1a3-46f0-bac4-cafd329536f9/320d0e39-c458-45a1-823e-6574efcaf5e2/c-t-u-n-nh-cho-m-o-cature-tofu-paddy-pet-shop.jpg',
      'https://fexafkqzpbzjcupvbfhe.supabase.co/storage/v1/object/public/product-images/products/63fe4e0f-e1a3-46f0-bac4-cafd329536f9/f7154ebd-b0e0-478c-bb6e-95f162d2c81b/c-t-u-n-nh-cho-m-o-cature-tofu-paddy-pet-shop.png'
    ],
    'SP-UAT-TOY-001': [
      'https://product.hstatic.net/1000104513/product/a799ecc39efd4cc3a6996303f87eca34_f3e3a7521e8941d0826d21675230ddde_master.jpg',
      'https://product.hstatic.net/1000104513/product/a799ecc39efd4cc3a6996303f87eca34_f3e3a7521e8941d0826d21675230ddde_large.jpg',
      'https://cutepetshop.vn/wp-content/uploads/2024/05/images-upload-woo2F4b63d48139b813646f1b445af9b01c85.jpg'
    ]
  };

  for (const [code, imgs] of Object.entries(bannerImages)) {
    const prod = await Product.findOne({ productCode: code });
    if (prod) {
      prod.images = imgs.map((u, i) => ({ id: `img-${i + 1}`, url: u, isPrimary: i === 0, sortOrder: i }));
      if (Array.isArray(prod.variants)) {
        prod.variants.forEach((v, i) => {
          v.image = imgs[i % imgs.length];
        });
      }
      await prod.save();
      console.log(`✅ Đã cập nhật ảnh sắc nét cho UAT product: ${code}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`🎉 ĐỒNG BỘ HOÀN TẤT: Đã cập nhật thành công ${updatedCount} sản phẩm và tất cả biến thể!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

sync().catch(err => {
  console.error('LỖI ĐỒNG BỘ:', err);
  process.exit(1);
});
