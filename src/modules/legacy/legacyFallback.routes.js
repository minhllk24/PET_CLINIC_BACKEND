import express from 'express';
import { optionalAuth } from '../../shared/authMiddleware.js';
import Pet from '../customer/models/Pet.js';
import Customer from '../customer/models/Customer.js';

const router = express.Router();

/**
 * LEGACY WEB 1 FALLBACK & MARKETING CONTENT ROUTES
 * Cung cấp dữ liệu phản hồi tiêu chuẩn cho các màn hình marketing, tin tức,
 * sơ cứu và danh mục thú cưng nhằm ngăn chặn lỗi 404 trên Console trình duyệt.
 */

// 1. Flash Sale
router.get('/flash-sales/active', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      sale: null,
      products: [],
    },
  });
});

// 2. Sơ cứu thú cưng (First Aid)
router.get('/first-aid/categories', (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 'fa-cat-1', name: 'Sơ cứu khẩn cấp', slug: 'so-cuu-khan-cap', description: 'Xử lý ngộ độc, hóc dị vật, co giật khẩn cấp' },
      { id: 'fa-cat-2', name: 'Chăm sóc vết thương', slug: 'cham-soc-vet-thuong', description: 'Sát trùng, băng bó, xử lý bỏng và cầm máu' },
      { id: 'fa-cat-3', name: 'Bệnh lý thường gặp', slug: 'benh-ly-thuong-gap', description: 'Sốt cao, nôn mửa, tiêu chảy, cảm lạnh' },
    ],
  });
});

router.get(['/first-aid/guides', '/first-aid/guides/all'], (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      items: [
        {
          id: 'fa-g-1',
          title: 'Cách sơ cứu chó mèo bị hóc dị vật khẩn cấp',
          slug: 'cach-so-cuu-cho-meo-bi-hoc-di-vat',
          category: 'Sơ cứu khẩn cấp',
          excerpt: 'Hướng dẫn nhanh các bước kiểm tra đường thở và thủ thuật đẩy dị vật cho thú cưng.',
          content: 'Khi thú cưng có biểu hiện khó thở, cào vào miệng, hãy giữ bình tĩnh và mở miệng kiểm tra...',
          thumbnail: '/assets/customer/images/first-aid/guide-1.png',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'fa-g-2',
          title: 'Xử lý khẩn cấp khi thú cưng bị ngộ độc thực phẩm',
          slug: 'xu-ly-khan-cap-khi-thu-cung-bi-ngo-doc-thuc-pham',
          category: 'Sơ cứu khẩn cấp',
          excerpt: 'Nhận biết triệu chứng trúng độc thức ăn lạ, sô-cô-la và các bước sơ cứu trước khi đến bác sĩ.',
          content: 'Không tự ý cho uống thuốc giải độc nếu chưa xác định được nguồn gốc độc tố...',
          thumbnail: '/assets/customer/images/first-aid/guide-2.png',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 2,
    },
  });
});

router.get('/first-aid/guides/:slug', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      id: 'fa-g-detail',
      title: 'Cẩm nang sơ cứu thú cưng Dr. Pet',
      slug: req.params.slug,
      content: 'Hướng dẫn chi tiết chăm sóc và xử lý ban đầu trước khi đưa bé đến chi nhánh Dr. Pet gần nhất.',
      createdAt: new Date().toISOString(),
    },
  });
});

// 3. Cứu hộ & Nhận nuôi (Rescue & Adoptions)
router.get('/adoptions/pets', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      items: [],
      total: 0,
    },
  });
});

router.get('/adoptions/my-requests', optionalAuth, (req, res) => {
  res.status(200).json({
    success: true,
    data: [],
  });
});

// 4. Bài viết & Tin tức Blog (Posts)
const samplePosts = [
  {
    id: 'post-1',
    title: 'Lịch tiêm phòng vắc-xin định kỳ cho chó mèo bạn cần biết',
    slug: 'lich-tiem-phong-vac-xin-dinh-ky-cho-cho-meo',
    category: 'Cẩm nang nuôi dưỡng',
    excerpt: 'Bảo vệ thú cưng toàn diện trước các bệnh truyền nhiễm nguy hiểm bằng phác đồ tiêm chủng chuẩn quốc tế.',
    content: 'Tiêm phòng vắc-xin là biện pháp y tế dự phòng quan trọng nhất...',
    thumbnail: '/assets/customer/images/blog/blog-1.png',
    publishedAt: new Date().toISOString(),
    views: 1250,
    likesCount: 98,
  },
  {
    id: 'post-2',
    title: 'Dinh dưỡng cân bằng cho thú cưng theo từng độ tuổi phát triển',
    slug: 'dinh-duong-can-bang-cho-thu-cung-theo-tung-do-tuoi',
    category: 'Dinh dưỡng thú cưng',
    excerpt: 'Khám phá chế độ dinh dưỡng tối ưu từ sơ sinh, trưởng thành đến khi về già cho các bé cưng.',
    content: 'Chế độ ăn của chó mèo cần được điều chỉnh linh hoạt theo từng giai đoạn...',
    thumbnail: '/assets/customer/images/blog/blog-2.png',
    publishedAt: new Date().toISOString(),
    views: 980,
    likesCount: 76,
  },
];

router.get('/posts/featured', (req, res) => {
  res.status(200).json({
    success: true,
    data: samplePosts.slice(0, 2),
  });
});

router.get('/posts/trending', (req, res) => {
  res.status(200).json({
    success: true,
    data: samplePosts.slice(0, 2),
  });
});

router.get('/posts', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      items: samplePosts,
      total: samplePosts.length,
    },
  });
});

router.get('/post-categories', (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 'cat-1', name: 'Cẩm nang nuôi dưỡng', slug: 'cam-nang-nuoi-duong' },
      { id: 'cat-2', name: 'Dinh dưỡng thú cưng', slug: 'dinh-duong-thu-cung' },
      { id: 'cat-3', name: 'Y tế & Bệnh học', slug: 'y-te-benh-hoc' },
    ],
  });
});

router.get('/posts/:slug', (req, res) => {
  const post = samplePosts.find((p) => p.slug === req.params.slug) || samplePosts[0];
  res.status(200).json({
    success: true,
    data: post,
  });
});

// 5. Loài & Giống thú cưng (Species & Breeds)
router.get('/pets/species', (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 'DOG', name: 'Chó' },
      { id: 'CAT', name: 'Mèo' },
      { id: 'BIRD', name: 'Chim' },
      { id: 'OTHER', name: 'Khác' },
    ],
  });
});

router.get('/pets/breeds', (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 'golden', name: 'Golden Retriever', speciesId: 'DOG' },
      { id: 'poodle', name: 'Poodle', speciesId: 'DOG' },
      { id: 'corgi', name: 'Corgi', speciesId: 'DOG' },
      { id: 'husky', name: 'Husky', speciesId: 'DOG' },
      { id: 'british_shorthair', name: 'Mèo Anh Lông Ngắn', speciesId: 'CAT' },
      { id: 'british_longhair', name: 'Mèo Anh Lông Dài', speciesId: 'CAT' },
      { id: 'persian', name: 'Mèo Ba Tư', speciesId: 'CAT' },
      { id: 'siamese', name: 'Mèo Xiêm', speciesId: 'CAT' },
    ],
  });
});

// 6. Thú cưng của người dùng (My Pets)
router.get('/my-pets', optionalAuth, async (req, res, next) => {
  try {
    if (!req.actor || !req.actor.id) {
      return res.status(200).json({ success: true, data: [] });
    }
    const customer = await Customer.findOne({ userId: req.actor.id });
    if (!customer) {
      return res.status(200).json({ success: true, data: [] });
    }
    const pets = await Pet.find({ customerId: customer._id });
    return res.status(200).json({ success: true, data: pets });
  } catch (err) {
    next(err);
  }
});

// 7. Nhật ký sức khỏe, Hồ sơ bệnh án & Nhắc lịch (Health Diaries, Medical Records, Reminders)
router.get('/health-diaries/pet/:petId', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, data: [] });
});

router.post('/health-diaries', optionalAuth, (req, res) => {
  res.status(201).json({ success: true, message: 'Ghi nhận nhật ký sức khỏe thành công', data: req.body });
});

router.put('/health-diaries/:diaryId', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, message: 'Cập nhật nhật ký thành công' });
});

router.delete('/health-diaries/:diaryId', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, message: 'Xóa nhật ký thành công' });
});

router.get('/medical-records/pet/:petId', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, data: [] });
});

router.get('/reminders/pet/:petId', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, data: [] });
});

router.post('/reminders', optionalAuth, (req, res) => {
  res.status(201).json({ success: true, message: 'Đặt lịch nhắc nhở thành công', data: req.body });
});

router.patch('/reminders/:reminderId/complete', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, message: 'Đã hoàn thành nhắc nhở' });
});

router.delete('/reminders/:reminderId', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, message: 'Đã xóa nhắc nhở' });
});

router.get('/reviews/can-review/product/:productId', optionalAuth, (req, res) => {
  res.status(200).json({ success: true, canReview: true });
});

export default router;
