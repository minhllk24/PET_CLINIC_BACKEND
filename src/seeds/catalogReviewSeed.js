import mongoose from 'mongoose';
import Review from '../modules/review/models/Review';
import Customer from '../modules/customer/models/Customer';
import User from '../models/User';
import Product from '../modules/catalog/models/Product';
import Category from '../modules/catalog/models/Category';
import Service from '../modules/catalog/models/Service';
import { logger } from '../shared/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

// Exclude demo/manual tester accounts so UAT & manual review submission never hit duplicate 409 conflicts
const EXCLUDED_CUSTOMER_PHONES = new Set([
  '0905555555', // Lê Văn Cường (primary demo customer)
  '0906666666', // Khách Hàng Bị Khóa
  '0907777777', // Khách Hàng Chưa Kích Hoạt
  '0336330971', // User test account
  '0968657205',
]);

const FALLBACK_REVIEWER_NAMES = [
  'Nguyễn Bích Phương',
  'Hoàng Minh Thắng',
  'Đặng Thu Thảo',
  'Vũ Đình Trọng',
  'Phan Thị Mai',
  'Bùi Gia Bảo',
  'Đỗ Thùy Trang',
  'Trịnh Hoàng Long',
  'Ngô Quốc Khánh',
  'Phạm Quỳnh Như',
  'Dương Văn Nam',
  'Lý Mỹ Linh',
  'Hà Trọng Nghĩa',
  'Tạ Thúy Nga',
  'Đinh Tuấn Anh',
  'Bạch Ngọc Lan',
  'Mai Khắc Tiệp',
  'Cao Xuân Hải',
  'Trần Văn Hùng',
];

const PRODUCT_COMMENTS = {
  DOG_FOOD: {
    5: [
      'Bé cún nhà mình rất hợp vị này, hạt thơm tự nhiên không quá gắt dầu. Ăn đều 2 tuần thấy phân khuôn đẹp, ít mùi hơn hẳn.',
      'Đã mua lại lần thứ 3 tại Dr. Pets House. Hàng chính hãng date còn rất xa, túi có zip bảo quản tiện lợi, cún ăn sạch tô mỗi bữa.',
      'Bé Poodle nhà mình vốn kén ăn mà đổi sang loại này lại rất mê. Lông bóng mượt rõ rệt sau gần một tháng sử dụng.',
      'Hạt kích thước vừa miệng cho cún, nhai giòn rụm. Shop đóng gói chống sốc kỹ càng, giao nhanh trong ngày.',
      'Thành phần dinh dưỡng cân đối, bé Golden nhà mình ăn trộm vía tiêu hóa ổn định, chạy nhảy lanh lợi cả ngày.',
    ],
    4: [
      'Chất lượng hạt ổn, cún ăn ngon miệng và không bị rối loạn tiêu hóa. Trừ 1 sao nhẹ vì đợt giao hàng cuối tuần hơi chậm một chút.',
      'Sản phẩm chính hãng, mùi thơm dễ chịu. Bé nhà mình ăn khá tốt, giá hơi nhỉnh hơn dòng phổ thông nhưng chất lượng xứng đáng.',
      'Bao bì đẹp, hạn sử dụng còn dài. Mới đổi hạt nên bé ăn hơi chậm vài ngày đầu, sang ngày thứ 4 là quen và ăn hết suất.',
    ],
    3: [
      'Hạt thơm nhưng bé cún nhà mình hơi kén vị này nên phải trộn thêm chút pate mới chịu ăn hết.',
      'Chất lượng ổn định, tuy nhiên túi giao tới hơi móp nhẹ phần góc do vận chuyển, bên trong hạt vẫn nguyên vẹn.',
    ],
  },
  CAT_FOOD: {
    5: [
      'Hai bé mèo nhà mình mê tít mùi vị này, mới mở nắp/gói ra là chạy lại dụi chân ngay. Thức ăn thơm thịt cá thật, không bị tanh gắt.',
      'Mèo Anh lông ngắn nhà mình ăn rất hợp, không bị nôn trớ hay đi ngoài. Sẽ tiếp tục đặt combo nhiều vị cho bé đỡ ngán.',
      'Chất lượng rất ưng ý, nước sốt đậm đà giúp mèo nạp thêm nước tốt hơn. Giá bán tại phòng khám hợp lý và đảm bảo hàng chuẩn.',
      'Bé mèo con nhà mình tăng cân đều và lông mượt hơn từ khi dùng dòng này. Đóng gói sạch sẽ, date mới tinh.',
      'Thức ăn tơi mềm dễ tiêu hóa, rất phù hợp cho cả mèo kén ăn. Mình đã giới thiệu cho mấy người bạn nuôi mèo cùng mua.',
    ],
    4: [
      'Mèo nhà mình ăn sạch đĩa, mùi vị hấp dẫn. Mong shop về thêm nhiều gói combo tiết kiệm hơn nữa.',
      'Sản phẩm đúng mô tả, giao hàng nhanh. Bé mèo thích phần nước sốt hơn phần thịt một chút nhưng nhìn chung vẫn ăn hết.',
      'Chất lượng tốt, bao bì nguyên seal. Giá ổn so với mặt bằng chung các shop thú y uy tín.',
    ],
    3: [
      'Mùi thơm ổn nhưng bé mèo nhà mình chỉ ăn vào buổi sáng, buổi tối hơi ngán nếu cho ăn liên tục.',
      'Đóng gói cẩn thận, chất lượng khá ổn, phù hợp cho mèo ăn đổi bữa thỉnh thoảng.',
    ],
  },
  TREATS_BONES: {
    5: [
      'Dùng làm phần thưởng khi huấn luyện ngồi, bắt tay rất hiệu quả. Bé cún thấy cầm gói bánh là nghe lời ngay.',
      'Xương gặm có độ dai vừa phải, giúp bé giải tỏa stress khi ở nhà một mình và hạn chế gặm cắn đồ đạc, dép guốc.',
      'Bánh thưởng mềm, thơm mùi thịt tự nhiên, dễ bẻ nhỏ cho cún size mini. Không bị vụn hay dính tay.',
      'Bé gặm xong hơi thở thơm tho hơn hẳn, mảng bám răng cũng giảm bớt. Rất đáng mua dự trữ sẵn trong nhà.',
    ],
    4: [
      'Cún thích mê, ăn rất nhanh. Túi hơi nhỏ so với sức ăn của bé lớn nhưng chất lượng rất đảm bảo.',
      'Mùi thơm dễ chịu, không quá nồng hương liệu nhân tạo. Sẽ thử thêm các hương vị khác của hãng.',
    ],
    3: [
      'Bé ăn được nhưng có vẻ thích vị bò hơn vị này. Độ cứng vừa phải, an toàn cho răng.',
    ],
  },
  SMALL_PET_BIRD: {
    5: [
      'Cỏ và hạt rất sạch, ít bụi vụn, giữ được mùi thơm tự nhiên. Bé thỏ và bọ ú nhà mình gặm suốt ngày không chán.',
      'Hạt trộn đa dạng thành phần giàu khoáng chất, bé vẹt ăn rất khỏe, lông lên màu tươi và mượt mà hơn.',
      'Đóng gói hút ẩm kỹ nên sản phẩm không bị mốc dù thời tiết ẩm. Giao hàng nhanh và tư vấn khẩu phần ăn rất nhiệt tình.',
    ],
    4: [
      'Sản phẩm sạch sẽ, bé ăn ngon miệng. Gói lớn dùng được khá lâu và tiết kiệm.',
      'Hạt đều, không bị mọt hay lẫn tạp chất. Rất yên tâm khi mua đồ cho thú cưng nhỏ tại đây.',
    ],
    3: [
      'Chất lượng ổn, một số hạt hơi to với bé chim nhỏ nên mình phải giã nhẹ một chút.',
    ],
  },
  LITTER_HYGIENE: {
    5: [
      'Cát vón cục cực nhanh và chắc, xúc không bị vỡ vụn ra khay. Khả năng khử mùi rất ấn tượng dù đặt khay trong phòng máy lạnh.',
      'Ít bụi tối đa nên không làm bé mèo bị hắt hơi hay bám bột trắng ở chân. Xả thẳng bồn cầu tan nhanh tiện vô cùng.',
      'Tấm lót thấm hút siêu nhanh, khóa ẩm tốt giúp chân cún không bị ướt lem ra sàn nhà. Đã mua nhiều bịch dùng dần.',
      'Dùng rất tiết kiệm, không bị bết đáy khay vệ sinh. Hàng chuẩn hãng nên dùng rất yên tâm cho hệ hô hấp của bé.',
    ],
    4: [
      'Khử mùi tốt, vón nhanh, mùi hương dịu nhẹ không quá hắc. Giá nhỉnh hơn cát đất sét chút nhưng sạch nhà hơn hẳn.',
      'Thấm hút ổn, giữ mùi tốt trong 2-3 ngày. Giao hàng đóng thùng carton gọn gàng.',
    ],
    3: [
      'Độ vón cục khá tốt, chỉ có điểm nhỏ là hạt hơi nhẹ nên đôi lúc bé mèo bới mạnh bị văng ra ngoài khay.',
    ],
  },
  DENTAL_HEALTH_CARE: {
    5: [
      'Dùng đều đặn 10 ngày thấy hơi thở của bé đỡ hôi rõ rệt, mảng bám ố vàng ở răng hàm cũng mờ đi nhiều.',
      'Rất tiện vì không cần chải mạnh khiến bé sợ, chỉ cần nhỏ/bôi nhẹ là bé tự liếm đều. Thành phần an toàn nên mình rất an tâm.',
      'Sữa tắm/dưỡng chất mùi dịu nhẹ tự nhiên, tắm xong lông bé mềm tơi và giảm hẳn tình trạng gãi ngứa do khô da.',
      'Sản phẩm hỗ trợ sức khỏe cực tốt, bé uống/dùng dễ dàng không phản kháng. Bác sĩ ở phòng khám cũng khuyên dùng dòng này.',
      'Hiệu quả rõ rệt sau vài lần sử dụng, lông đỡ rụng hơn và da bé khỏe mạnh hồng hào. Chắc chắn sẽ mua lại.',
    ],
    4: [
      'Sản phẩm dễ dùng, mùi thơm dễ chịu. Cần kiên trì dùng đều mỗi ngày để thấy hiệu quả khử mùi rõ nhất.',
      'Dung tích chai khá nhiều, dùng tiết kiệm. Giao hàng cẩn thận có bọc chống sốc kỹ không bị đổ.',
    ],
    3: [
      'Mùi khá dễ chịu, tuy nhiên bé nhà mình chưa quen vị lắm nên cần tập từ từ vài hôm đầu.',
    ],
  },
  TOYS: {
    5: [
      'Chất liệu cao su/vải rất dày dặn và an toàn, bé nhà mình gặm cắn suốt mấy tuần rồi mà vẫn chưa bị rách hỏng.',
      'Món đồ chơi chân ái giúp bé vận động tiêu hao năng lượng, tối về ngủ ngoan hẳn và không còn cắn phá sofa nữa.',
      'Màu sắc bắt mắt, kích thước vừa vặn. Vừa thả ra là bé vờn chơi say sưa cả buổi.',
    ],
    4: [
      'Đồ chơi bền đẹp, dễ vệ sinh sau khi bé chơi xong. Giá hợp lý so với chất lượng hoàn thiện.',
      'Bé mèo rất thích tiếng chuông/chút chít vui tai. Đường may chắc chắn.',
    ],
    3: [
      'Thiết kế dễ thương, bé chơi được lúc đầu, lúc sau hơi nhanh chán nếu không có người chơi cùng.',
    ],
  },
  ACCESSORIES_ESSENTIALS: {
    5: [
      'Chất liệu chắc chắn, đường may tỉ mỉ và khóa cài an toàn. Đeo đi dạo công viên rất êm cổ, không bị cọ rát lông bé.',
      'Bát ăn/khay vệ sinh nhựa dày dặn, không có mùi nhựa rẻ tiền, đế chống trượt tốt nên bé ăn không bị đẩy chạy khắp nhà.',
      'Nệm êm ái, vải thoáng khí nhưng vẫn giữ ấm tốt vào ban đêm. Bé nằm vào là ngủ say ngay.',
    ],
    4: [
      'Thiết kế đẹp, màu sắc đúng như hình ảnh minh họa. Dễ tháo rời vệ sinh sạch sẽ.',
      'Dây dắt cầm chắc tay, phản quang ban đêm rất an toàn khi dắt bé đi dạo buổi tối.',
    ],
    3: [
      'Sản phẩm dùng ổn trong tầm giá, mình chọn size hơi rộng một xíu nhưng điều chỉnh dây lại vẫn vừa.',
    ],
  },
};

const SERVICE_COMMENTS = {
  GROOMING: {
    5: [
      'Các bạn groomer làm việc cực kỳ nhẹ nhàng, kiên nhẫn với bé. Tắm sấy xong lông tơi bồng bềnh, thơm dịu lâu cả tuần.',
      'Cắt tỉa tạo kiểu rất khéo và đúng form mình yêu cầu, khu vực bàn chân và móng được mài tròn mịn không còn cào xước da.',
      'Quy trình làm sạch tai, vắt tuyến hôi và vệ sinh bàn chân rất bài bản. Phòng spa thoáng sạch không bị ám mùi thú cưng.',
      'Bé nhà mình vốn rất sợ tiếng máy sấy nhưng nhân viên dỗ dành khéo nên hợp tác ngoan ngoãn từ đầu đến cuối.',
    ],
    4: [
      'Dịch vụ chu đáo, bé về nhà sạch sẽ thơm tho và rất vui vẻ. Cuối tuần hơi đông nên đặt lịch trước sẽ đỡ phải chờ.',
      'Groomer tư vấn kiểu cắt phù hợp với chất lông của bé, làm cẩn thận và sạch sẽ.',
    ],
    3: [
      'Chất lượng tắm và cắt móng tốt, thời gian hoàn thành hơi lâu hơn dự kiến khoảng 15 phút do đông khách.',
    ],
  },
  MEDICAL: {
    5: [
      'Bác sĩ thăm khám rất cẩn thận, giải thích rõ ràng từng chỉ số sức khỏe và hướng dẫn chế độ chăm sóc tại nhà dễ hiểu.',
      'Quy trình tiêm phòng và theo dõi sau tiêm chuyên nghiệp, thuốc được kiểm tra hạn dùng công khai minh bạch trước mặt chủ nuôi.',
      'Trang thiết bị hiện đại, bác sĩ giàu kinh nghiệm xử lý tình huống bình tĩnh giúp bé nhanh chóng ổn định sức khỏe.',
      'Điều dưỡng hỗ trợ nhiệt tình, vệ sinh vết thương và thay băng nhẹ nhàng nên bé không bị hoảng sợ.',
    ],
    4: [
      'Bác sĩ tận tâm, phòng khám khử khuẩn sạch sẽ. Chi phí được báo minh bạch trước khi thực hiện dịch vụ.',
      'Nhân viên lễ tân tiếp đón niềm nở, nhắc lịch tái khám rõ ràng qua hệ thống.',
    ],
    3: [
      'Bác sĩ tư vấn kỹ càng, khu vực chờ giờ cao điểm hơi đông một chút.',
    ],
  },
};

const STAFF_REPLIES = [
  'Dạ Dr. Pet\'s House xin chân thành cảm ơn đánh giá của quý khách. Chúc bé cưng luôn khỏe mạnh và hay ăn chóng lớn ạ!',
  'Cảm ơn bạn đã tin tưởng lựa chọn dịch vụ và sản phẩm chính hãng tại Dr. Pet\'s House. Hẹn gặp lại bạn và bé trong những lần tới!',
  'Dr. Pet\'s House rất vui khi bé yêu thích sản phẩm này. Nếu cần tư vấn thêm về dinh dưỡng hoặc chăm sóc, đừng ngại nhắn cho tụi mình nhé!',
  'Cảm ơn phản hồi chân thành từ bạn! Đội ngũ Dr. Pet\'s House luôn ghi nhận để nâng cao chất lượng phục vụ ngày một tốt hơn ạ.',
];

// Deterministic PRNG based on string seed so seeded reviews stay repeatable across runs
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function classifyProductBucket(name = '', categoryName = '') {
  const n = `${name} ${categoryName}`.toLowerCase();
  if (n.includes('cát vệ sinh') || n.includes('cát đậu nành') || n.includes('miếng lót') || n.includes('tấm lót')) {
    return 'LITTER_HYGIENE';
  }
  if (n.includes('cần câu') || n.includes('đồ chơi') || n.includes('bóng gặm') || n.includes('kong') || n.includes('chút chít')) {
    return 'TOYS';
  }
  if (n.includes('răng miệng') || n.includes('súc miệng') || n.includes('dental') || n.includes('hôi miệng') || n.includes('sữa tắm') || n.includes('dầu cá') || n.includes('vitamin') || n.includes('bravecto') || n.includes('gimcat') || n.includes('máy sấy') || n.includes('dinh dưỡng khỏe mạnh')) {
    return 'DENTAL_HEALTH_CARE';
  }
  if (n.includes('dây dắt') || n.includes('vòng cổ') || n.includes('nệm') || n.includes('bát ăn') || n.includes('khay vệ sinh') || n.includes('dụng cụ ăn')) {
    return 'ACCESSORIES_ESSENTIALS';
  }
  if (n.includes('cỏ khô') || n.includes('alfalfa') || n.includes('vẹt') || n.includes('chim') || n.includes('thỏ')) {
    return 'SMALL_PET_BIRD';
  }
  if (n.includes('bánh thưởng') || n.includes('snack') || n.includes('xương') || n.includes('bowwow') || n.includes('vegebrand')) {
    return 'TREATS_BONES';
  }
  if (n.includes('mèo') || n.includes('whiskas') || n.includes('ciao') || n.includes('catidea') || n.includes('cat sea') || n.includes('love meow') || n.includes('kitten')) {
    return 'CAT_FOOD';
  }
  return 'DOG_FOOD';
}

function chooseRating(seed, reviewIdx) {
  const roll = (seed + reviewIdx * 37) % 100;
  if (roll < 68) return 5;
  if (roll < 93) return 4;
  return 3;
}

function pickFrom(arr, seed, offset = 0) {
  if (!arr || arr.length === 0) return '';
  return arr[(seed + offset) % arr.length];
}

/**
 * Recompute and bulk-sync ratingAvg & ratingCount on all active Products and Services
 */
export const syncAllCatalogRatings = async () => {
  if (mongoose.connection.readyState !== 1) return { updatedProducts: 0, updatedServices: 0 };

  const stats = await Review.aggregate([
    { $match: { status: 'ACTIVE', hidden: { $ne: true } } },
    {
      $group: {
        _id: { targetType: '$targetType', targetId: '$targetId' },
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const productOps = [];
  const serviceOps = [];
  for (const row of stats) {
    const ratingAvg = Math.round(row.avgRating * 10) / 10;
    const ratingCount = row.count;
    if (row._id.targetType === 'PRODUCT') {
      productOps.push({
        updateOne: {
          filter: { _id: row._id.targetId },
          update: { $set: { ratingAvg, ratingCount } },
        },
      });
    } else if (row._id.targetType === 'SERVICE') {
      serviceOps.push({
        updateOne: {
          filter: { _id: row._id.targetId },
          update: { $set: { ratingAvg, ratingCount } },
        },
      });
    }
  }

  if (productOps.length > 0) await Product.bulkWrite(productOps);
  if (serviceOps.length > 0) await Service.bulkWrite(serviceOps);
  return { updatedProducts: productOps.length, updatedServices: serviceOps.length };
};

/**
 * Populate realistic, domain-matched Vietnamese reviews for Products & Services
 * that currently have few or zero reviews (< 2 active reviews).
 * Idempotent & non-destructive to existing reviews.
 */
export const seedCatalogReviews = async () => {
  try {
    if (mongoose.connection?.readyState !== 1) return { inserted: 0 };
    if (process.env.NODE_ENV === 'test') return { inserted: 0 };

    const [products, categories, services, customers, adminUser] = await Promise.all([
      Product.find({ status: { $ne: 'ARCHIVED' } }).select('_id name categoryId ratingCount').lean(),
      Category.find({}).select('_id name').lean(),
      Service.find({ status: { $ne: 'ARCHIVED' } }).select('_id name serviceType ratingCount').lean(),
      Customer.find({}).populate('userId', 'fullName phone').lean(),
      User.findOne({ systemRole: 'ADMIN' }).select('_id').lean(),
    ]);

    const catMap = new Map(categories.map((c) => [c._id.toString(), c.name]));

    const reviewerPool = customers.filter((c) => {
      const phone = c.userId?.phone || c.phone || '';
      return !EXCLUDED_CUSTOMER_PHONES.has(phone);
    });
    if (reviewerPool.length === 0) {
      logger.warn('[CatalogReviewSeed] No eligible reviewer customers found; skipping.');
      return { inserted: 0 };
    }

    // Load existing (targetId -> Set<customerId>, count) in one query
    const existingReviews = await Review.find({ status: { $ne: 'DELETED' } })
      .select('targetType targetId customerId status hidden')
      .lean();

    const targetMap = new Map();
    for (const r of existingReviews) {
      const key = `${r.targetType}:${r.targetId?.toString()}`;
      if (!targetMap.has(key)) {
        targetMap.set(key, { activeCount: 0, customerIds: new Set() });
      }
      const entry = targetMap.get(key);
      if (r.status === 'ACTIVE' && !r.hidden) {
        entry.activeCount += 1;
      }
      if (r.customerId) {
        entry.customerIds.add(r.customerId.toString());
      }
    }

    const adminId = adminUser ? adminUser._id : null;
    const now = Date.now();
    const docsToInsert = [];

    // Helper to queue missing reviews for either PRODUCT or SERVICE
    const enqueueForTarget = (targetType, item, bucketMap, bucketKey) => {
      const idStr = item._id.toString();
      const mapKey = `${targetType}:${idStr}`;
      const existing = targetMap.get(mapKey) || { activeCount: 0, customerIds: new Set() };

      // Skip items that already have >= 2 active reviews
      if (existing.activeCount >= 2) return;

      const seed = hashSeed(idStr);
      // Desired total active reviews: 3 to 6 per item
      const desiredTotal = 3 + (seed % 4);
      const needed = Math.max(0, desiredTotal - existing.activeCount);

      let offset = seed % reviewerPool.length;
      let added = 0;
      let guard = 0;

      while (added < needed && guard < reviewerPool.length) {
        const cust = reviewerPool[(offset + guard) % reviewerPool.length];
        guard += 1;
        const custIdStr = cust._id.toString();
        if (existing.customerIds.has(custIdStr)) continue;
        existing.customerIds.add(custIdStr);

        const rating = chooseRating(seed, added);
        const commentPool = bucketMap[bucketKey]?.[rating] || bucketMap[bucketKey]?.[5] || [];
        const comment = pickFrom(commentPool, seed, added * 3 + rating);
        const isAnon = ((seed + added * 13) % 9) === 0; // ~11% anonymous reviews
        const reviewerName = cust.userId?.fullName || cust.fullName || FALLBACK_REVIEWER_NAMES[(offset + added) % FALLBACK_REVIEWER_NAMES.length];

        const ageDays = 2 + ((seed + added * 11) % 43);
        const createdAt = new Date(now - ageDays * DAY_MS - ((added * 3600 + seed % 3600) * 1000));

        const doc = {
          customerId: cust._id,
          ownerUserId: cust.userId?._id || cust.userId || undefined,
          sourceType: targetType === 'PRODUCT' ? 'ORDER' : 'APPOINTMENT',
          // Omit sourceId so partial unique index { sourceId: { $exists: true } } never collides
          targetType,
          targetId: item._id,
          rating,
          comment,
          anonymous: isAnon,
          displayName: isAnon ? null : reviewerName,
          hidden: false,
          status: 'ACTIVE',
          createdAt,
          updatedAt: createdAt,
        };

        // ~20% receive a realistic staff reply
        if (adminId && ((seed + added * 7) % 5) === 0) {
          doc.staffReply = {
            text: pickFrom(STAFF_REPLIES, seed, added),
            repliedBy: adminId,
            repliedAt: new Date(createdAt.getTime() + 6 * 3600 * 1000),
          };
        }

        docsToInsert.push(doc);
        added += 1;
      }
    };

    for (const product of products) {
      const catName = catMap.get(product.categoryId?.toString()) || '';
      const bucketKey = classifyProductBucket(product.name, catName);
      enqueueForTarget('PRODUCT', product, PRODUCT_COMMENTS, bucketKey);
    }

    for (const service of services) {
      const bucketKey = service.serviceType === 'MEDICAL' ? 'MEDICAL' : 'GROOMING';
      enqueueForTarget('SERVICE', service, SERVICE_COMMENTS, bucketKey);
    }

    if (docsToInsert.length > 0) {
      await Review.insertMany(docsToInsert, { ordered: false });
      logger.info(`[CatalogReviewSeed] Inserted ${docsToInsert.length} realistic reviews across catalog products & services.`);
    }

    const syncRes = await syncAllCatalogRatings();
    return { inserted: docsToInsert.length, ...syncRes };
  } catch (err) {
    logger.error('[CatalogReviewSeed] Error seeding catalog reviews:', err);
    return { inserted: 0, error: err.message };
  }
};
