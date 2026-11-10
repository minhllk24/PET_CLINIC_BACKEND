import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const CATEGORY_MAP = {
  THUC_AN: new mongoose.Types.ObjectId('6ae1b15cb1d650ca8dafe56c'), // Thức ăn (thuc-an)
  THIET_YEU: new mongoose.Types.ObjectId('6ae1b15cb1d650ca8dafe56d'), // Đồ dùng thiết yếu (do-dung-thiet-yeu)
  SUC_KHOE: new mongoose.Types.ObjectId('6ae1b15db1d650ca8dafe56e'), // Chăm sóc sức khỏe (cham-soc-suc-khoe)
  DO_CHOI: new mongoose.Types.ObjectId('6ae1b15db1d650ca8dafe56f'), // Đồ chơi (do-choi)
  PHU_KIEN: new mongoose.Types.ObjectId('6ae1b15db1d650ca8dafe570') // Phụ kiện (phu-kien)
};

export function classifyProduct(p) {
  const name = (p.name || '').toLowerCase();
  const code = (p.productCode || '').toLowerCase();

  // 1. Phụ kiện
  if (
    name.includes('vòng cổ') ||
    name.includes('dây dắt') ||
    name.includes('yếm') ||
    name.includes('đai ngực') ||
    name.includes('xích') ||
    name.includes('chuông gắn') ||
    code.includes('leash') ||
    code.includes('collar') ||
    name.includes('jewpet')
  ) {
    return { catId: CATEGORY_MAP.PHU_KIEN, catName: 'Phụ kiện' };
  }

  // 2. Đồ chơi
  if (
    name.includes('đồ chơi') ||
    name.includes('cần câu') ||
    name.includes('chuột cói') ||
    name.includes('cào móng') ||
    name.includes('bàn cào') ||
    name.includes('trụ cào') ||
    name.includes('catnip') ||
    name.includes('chút chít') ||
    name.includes('bóng gặm') ||
    code.includes('cattoy') ||
    code.includes('scratch') ||
    (code.includes('toy') && !name.includes('thức ăn'))
  ) {
    return { catId: CATEGORY_MAP.DO_CHOI, catName: 'Đồ chơi' };
  }

  // 3. Đồ dùng thiết yếu
  if (
    name.includes('bát ăn') ||
    name.includes('bình nước') ||
    name.includes('khay vệ sinh') ||
    name.includes('cát vệ sinh') ||
    name.includes('cát đậu nành') ||
    name.includes('cát đất sét') ||
    name.includes('nệm') ||
    name.includes('đệm') ||
    name.includes('chuồng') ||
    name.includes('lồng') ||
    name.includes('balo') ||
    name.includes('vận chuyển') ||
    name.includes('miếng lót') ||
    name.includes('clean pet sheets') ||
    name.includes('dụng cụ ăn uống') ||
    code.includes('bowl') ||
    code.includes('bed') ||
    code.includes('litter') ||
    code.includes('carrier')
  ) {
    return { catId: CATEGORY_MAP.THIET_YEU, catName: 'Đồ dùng thiết yếu' };
  }

  // 4. Chăm sóc sức khỏe
  if (
    name.includes('răng miệng') ||
    name.includes('súc miệng') ||
    name.includes('sữa tắm') ||
    name.includes('tắm khô') ||
    name.includes('xịt khử mùi') ||
    name.includes('ve rận') ||
    name.includes('bọ chét') ||
    name.includes('thuốc') ||
    name.includes('dầu cá') ||
    name.includes('nutri-plus') ||
    name.includes('gimcat') ||
    name.includes('lược') ||
    name.includes('grooming') ||
    name.includes('demodex') ||
    name.includes('bravecto') ||
    name.includes('nexgard') ||
    name.includes('frontline') ||
    name.includes('máy sấy') ||
    name.includes('dinh dưỡng khỏe mạnh') ||
    name.includes('tropiclean') ||
    name.includes('clean teeth') ||
    code.includes('shamp') ||
    code.includes('med') ||
    code.includes('comb')
  ) {
    return { catId: CATEGORY_MAP.SUC_KHOE, catName: 'Chăm sóc sức khỏe' };
  }

  // 5. Thức ăn (Mặc định cho các loại hạt, pate, bánh thưởng, cỏ khô,...)
  return { catId: CATEGORY_MAP.THUC_AN, catName: 'Thức ăn' };
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const products = await db.collection('products').find().toArray();
  console.log(`Bắt đầu đồng bộ danh mục & khoảng giá cho ${products.length} sản phẩm...`);

  let updatedCount = 0;
  const categoryStats = {
    'Thức ăn': 0,
    'Đồ dùng thiết yếu': 0,
    'Chăm sóc sức khỏe': 0,
    'Đồ chơi': 0,
    'Phụ kiện': 0
  };

  for (const prod of products) {
    const { catId, catName } = classifyProduct(prod);
    categoryStats[catName]++;

    const variants = Array.isArray(prod.variants) ? prod.variants : [];
    let minPrice = 0;
    let maxPrice = 0;
    let minFinalPrice = 0;
    let maxFinalPrice = 0;

    if (variants.length > 0) {
      const prices = variants.map(v => Number(v.price) || 0);
      const finalPrices = variants.map(v => (v.finalPrice !== undefined && v.finalPrice !== null ? Number(v.finalPrice) : Number(v.price) || 0));
      minPrice = Math.min(...prices);
      maxPrice = Math.max(...prices);
      minFinalPrice = Math.min(...finalPrices);
      maxFinalPrice = Math.max(...finalPrices);
    }

    const resolvedFinal = minFinalPrice || minPrice || 0;
    const primaryVar = variants.find(v => {
      const vf = (v.finalPrice !== undefined && v.finalPrice !== null) ? Number(v.finalPrice) : Number(v.price) || 0;
      return vf === resolvedFinal;
    }) || variants[0] || {};

    const primaryPrice = Number(primaryVar.price) || resolvedFinal;
    const hasDiscount = (Number(primaryVar.discountPercent) > 0) || (primaryPrice > resolvedFinal);
    const resolvedOriginal = hasDiscount ? primaryPrice : resolvedFinal;

    await db.collection('products').updateOne(
      { _id: prod._id },
      {
        $set: {
          categoryId: catId,
          minPrice,
          maxPrice,
          minFinalPrice,
          maxFinalPrice,
          displayPrice: resolvedFinal,
          sellingPrice: resolvedFinal,
          price: resolvedFinal,
          originalPrice: resolvedOriginal,
          discountPercent: hasDiscount ? (Number(primaryVar.discountPercent) || Math.round(((primaryPrice - resolvedFinal) / primaryPrice) * 100)) : 0
        }
      }
    );
    updatedCount++;
  }

  console.log(`\nĐã cập nhật thành công ${updatedCount} sản phẩm!`);
  console.log('Thống kê số lượng sản phẩm theo từng danh mục chuẩn:');
  console.table(categoryStats);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('LỖI ĐỒNG BỘ:', err);
  process.exit(1);
});
