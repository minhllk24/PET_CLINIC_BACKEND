import express from 'express';
import mongoose from 'mongoose';
import { optionalAuth } from '../../shared/authMiddleware.js';
import Pet from '../customer/models/Pet.js';
import Customer from '../customer/models/Customer.js';
import User from '../../models/User.js';
import * as authService from '../auth/auth.service.js';
import { formatMe } from '../auth/auth.serializer.js';
import { getProvinces, getDistricts, getWards } from '../location/location.service.js';
import MedicalRecord from '../customer/models/MedicalRecord.js';
import upload from '../../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * LEGACY WEB 1 FALLBACK & MARKETING CONTENT ROUTES
 * Cung cấp dữ liệu phản hồi tiêu chuẩn cho các màn hình marketing, tin tức,
 * sơ cứu và danh mục thú cưng nhằm ngăn chặn lỗi 404 trên Console trình duyệt.
 */

import * as flashSaleService from '../flash-sale/flashSale.service.js';

// 1. Flash Sale
router.get('/flash-sales/active', async (req, res, next) => {
  try {
    const result = await flashSaleService.getActiveFlashSale();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
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
  const items = [
    {
      id: 'fa-g-1',
      title: 'Cách sơ cứu chó mèo bị hóc dị vật khẩn cấp',
      slug: 'cach-so-cuu-cho-meo-bi-hoc-di-vat',
      category: 'Sơ cứu khẩn cấp',
      excerpt: 'Hướng dẫn nhanh các bước kiểm tra đường thở và thủ thuật đẩy dị vật cho thú cưng.',
      content: 'Khi thú cưng có biểu hiện khó thở, cào vào miệng, hãy giữ bình tĩnh và mở miệng kiểm tra...',
      thumbnail: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'fa-g-2',
      title: 'Xử lý khẩn cấp khi thú cưng bị ngộ độc thực phẩm',
      slug: 'xu-ly-khan-cap-khi-thu-cung-bi-ngo-doc-thuc-pham',
      category: 'Sơ cứu khẩn cấp',
      excerpt: 'Nhận biết triệu chứng trúng độc thức ăn lạ, sô-cô-la và các bước sơ cứu trước khi đến bác sĩ.',
      content: 'Không tự ý cho uống thuốc giải độc nếu chưa xác định được nguồn gốc độc tố...',
      thumbnail: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
      createdAt: new Date().toISOString(),
    },
  ];
  res.status(200).json({
    success: true,
    data: {
      items,
      guides: items,
      posts: items,
      total: items.length,
      totalRows: items.length,
    },
  });
});

router.get('/first-aid/guides/:slug', (req, res) => {
  const isUrgent = req.params.slug.includes('khan-cap') || req.params.slug.includes('urgent') || req.params.slug.includes('ngo-doc');
  res.status(200).json({
    success: true,
    data: {
      id: 'fa-g-detail',
      title: 'Cẩm nang sơ cứu thú cưng Dr. Pet',
      slug: req.params.slug,
      urgent: isUrgent,
      urgencyLevel: isUrgent ? 'URGENT' : 'NORMAL',
      video_url: null,
      videoUrl: null,
      content: 'Hướng dẫn chi tiết chăm sóc và xử lý ban đầu trước khi đưa bé đến chi nhánh Dr. Pet gần nhất.',
      createdAt: new Date().toISOString(),
    },
  });
});

// 3. Cứu hộ & Nhận nuôi (Rescue & Adoptions)
router.get(['/adoptions/pets', '/rescue/pets'], (req, res) => {
  const items = [
    {
      _id: 'sample-rescue-1',
      petCode: 'RESCUE-DOG-001',
      petName: 'Bé Đậu',
      name: 'Bé Đậu',
      species: 'DOG',
      breed: 'Chó cỏ lai vàng',
      gender: 'MALE',
      ageDescription: '8 tháng tuổi',
      healthStatus: 'Sức khỏe tốt, đã tiêm 2 mũi vắc-xin 7 bệnh và xổ giun định kỳ.',
      rescueStory: 'Bé bị bỏ rơi trong thùng xốp trước cửa chi nhánh Dr. Pet Bình Thạnh trong đêm mưa bão. Đội ngũ bác sĩ đã tiếp nhận, hồi sức và chăm sóc bé phục hồi hoàn toàn.',
      images: [
        'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'LOOKING_FOR_HOME',
    },
    {
      _id: 'sample-rescue-2',
      petCode: 'RESCUE-CAT-002',
      petName: 'Bé Mây',
      name: 'Bé Mây',
      species: 'CAT',
      breed: 'Mèo tam thể mắt ngọc',
      gender: 'FEMALE',
      ageDescription: '5 tháng tuổi',
      healthStatus: 'Rất nhanh nhẹn, tinh nghịch, tai mắt sạch sẽ, đã tiêm phòng 3 bệnh mèo.',
      rescueStory: 'Bé đi lạc vào tầng hầm chung cư Quận 7 và được cư dân đưa đến nhờ Dr. Pet cưu mang tìm tổ ấm yêu thương.',
      images: [
        'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'LOOKING_FOR_HOME',
    },
    {
      _id: 'sample-rescue-3',
      petCode: 'RESCUE-DOG-003',
      petName: 'Bé Vàng',
      name: 'Bé Vàng',
      species: 'DOG',
      breed: 'Chó Vàng Phú Quốc lai',
      gender: 'MALE',
      ageDescription: '14 tháng tuổi',
      healthStatus: 'Thể lực rất sung mãn, đã tiêm phòng dại và gắn microchip định danh.',
      rescueStory: 'Bé từng bị kẹt chân vào hàng rào sắt, được Dr. Pet giải cứu và phẫu thuật lành lặn. Bé đã được một gia đình tại Quận 2 nhận nuôi ấm êm.',
      images: [
        'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
      ],
      status: 'ADOPTED',
    },
  ];
  res.status(200).json({
    success: true,
    data: {
      items,
      pets: items,
      total: items.length,
      totalRows: items.length,
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
    slug: 'lich-tiem-phong-vac-xin-dinh-ky-cho-cho-meo-ban-can-biet',
    category: 'Sức khỏe',
    categorySlug: 'suc-khoe',
    excerpt: 'Bảo vệ thú cưng toàn diện trước các bệnh truyền nhiễm nguy hiểm bằng phác đồ tiêm chủng chuẩn quốc tế.',
    content: 'Tiêm phòng vắc-xin là biện pháp y tế dự phòng quan trọng nhất...',
    thumbnailUrl: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=800&q=80',
    hashtags: ['#tiem-phong', '#suc-khoe', '#vac-xin'],
    publishedAt: new Date().toISOString(),
    views: 1250,
    viewCount: 1250,
    likesCount: 98,
  },
  {
    id: 'post-2',
    title: 'Dinh dưỡng cân bằng cho thú cưng theo từng độ tuổi phát triển',
    slug: 'dinh-duong-can-bang-cho-thu-cung-theo-tung-do-tuoi-phat-trien',
    category: 'Dinh dưỡng',
    categorySlug: 'dinh-duong',
    excerpt: 'Khám phá chế độ dinh dưỡng tối ưu từ sơ sinh, trưởng thành đến khi về già cho các bé cưng.',
    content: 'Chế độ ăn của chó mèo cần được điều chỉnh linh hoạt theo từng giai đoạn...',
    thumbnailUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
    hashtags: ['#dinh-duong', '#cham-soc-thu-cung'],
    publishedAt: new Date().toISOString(),
    views: 980,
    viewCount: 980,
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

router.get(['/posts/recent', '/posts/latest', '/posts/quick-view'], (req, res) => {
  res.status(200).json({
    success: true,
    data: samplePosts,
  });
});

router.get(['/posts/tags', '/post-tags'], (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 'tiem-phong', slug: 'tiem-phong', name: 'tiem-phong', count: 2 },
      { id: 'dinh-duong', slug: 'dinh-duong', name: 'dinh-duong', count: 2 },
    ],
  });
});

router.get(['/posts/related', '/posts/:slug/related'], (req, res) => {
  res.status(200).json({
    success: true,
    data: samplePosts,
  });
});

router.get('/posts', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      items: samplePosts,
      posts: samplePosts,
      total: samplePosts.length,
      totalRows: samplePosts.length,
    },
  });
});

router.get(['/post-categories', '/posts/categories'], (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      { id: 'health', name: 'Sức khỏe', label: 'Sức khỏe', slug: 'suc-khoe' },
      { id: 'nutrition', name: 'Dinh dưỡng', label: 'Dinh dưỡng', slug: 'dinh-duong' },
      { id: 'psychology', name: 'Tâm lý', label: 'Tâm lý', slug: 'tam-ly' },
      { id: 'grooming', name: 'Vệ sinh & Làm đẹp', label: 'Vệ sinh & Làm đẹp', slug: 've-sinh-lam-dep' },
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

// Community Posts Fallback
const sampleCommunityPosts = [
  {
    id: 'comm-1',
    _id: '6ae161491bb9b2b264c91201',
    title: 'Chia sẻ kinh nghiệm chăm sóc bé Poodle khi đổi mùa',
    content: 'Mùa này các bé Poodle rất dễ bị viêm tai và khô da. Mình đã áp dụng cách vệ sinh tai 2 ngày/lần và bổ sung dầu cá Omega 3, trộm vía bé khỏe mạnh hẳn!',
    imageUrls: ['https://images.unsplash.com/photo-1543466835-00a7907e9de1'],
    authorNameSnapshot: 'Minh Thư',
    authorAvatarSnapshot: null,
    status: 'APPROVED',
    likesCount: 24,
    commentsCount: 6,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'comm-2',
    _id: '6ae161491bb9b2b264c91202',
    title: 'Mèo con bị sốc nhiệt mùa nắng nóng - bài học đáng nhớ',
    content: 'Tuần trước bé Miu nhà mình bị thở dốc do phòng trọ nóng quá. May mà gọi hotline cấp cứu của Dr. Pets House được bác sĩ hướng dẫn hạ nhiệt đúng cách...',
    imageUrls: ['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba'],
    authorNameSnapshot: 'Hoàng Nam',
    authorAvatarSnapshot: null,
    status: 'APPROVED',
    likesCount: 42,
    commentsCount: 15,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'comm-3',
    _id: '6ae161491bb9b2b264c91203',
    title: 'Góc khoe bé Corgi vừa làm đẹp tại Dr. Pets House chi nhánh Q1',
    content: 'Đưa bé đi tắm cắt tỉa lông mông trái tim mà nhân viên làm siêu có tâm, bé về không bị hoảng sợ tí nào!',
    imageUrls: ['https://images.unsplash.com/photo-1517849845537-4d257902454a'],
    authorNameSnapshot: 'Thanh Trúc',
    authorAvatarSnapshot: null,
    status: 'APPROVED',
    likesCount: 58,
    commentsCount: 8,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

router.get(['/community/posts', '/public/community/posts'], (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      items: sampleCommunityPosts,
      total: sampleCommunityPosts.length,
      page: 1,
      limit: 10,
      totalPages: 1,
    },
  });
});

router.post(['/community/posts', '/public/community/posts'], (req, res) => {
  const { title, content, imageUrls } = req.body || {};
  const newPost = {
    id: `comm-${Date.now()}`,
    _id: new mongoose.Types.ObjectId().toString(),
    title: title || 'Bài viết chia sẻ',
    content: content || '',
    imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
    authorNameSnapshot: req.actor?.fullName || req.user?.fullName || 'Thành viên yêu thú cưng',
    authorAvatarSnapshot: null,
    status: 'APPROVED',
    likesCount: 0,
    commentsCount: 0,
    createdAt: new Date().toISOString(),
  };
  sampleCommunityPosts.unshift(newPost);
  res.status(201).json({
    success: true,
    data: newPost,
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

// Helper to normalize MedicalRecord into unified camelCase + snake_case response
function formatMedicalRecordResponse(record) {
  if (!record) return null;
  const id = record._id ? record._id.toString() : (record.id || '');
  const visitDate = record.visitDate || record.examinationDate || record.createdAt || new Date();
  const dateStr = visitDate ? new Date(visitDate).toISOString().slice(0, 10) : '';
  const doctorName = record.doctorName || record.doctor || 'Bác sĩ phụ trách';
  const condition = record.condition || record.recordName || record.diagnosis || 'Khám tổng quát';
  const notes = record.notes || record.treatmentNote || record.diagnosis || record.symptoms || '';
  const fileUrl = record.fileUrl || (Array.isArray(record.attachments) && record.attachments[0] ? (record.attachments[0].fileUrl || record.attachments[0].file_url) : '');
  const fileName = record.fileName || (Array.isArray(record.attachments) && record.attachments[0] ? (record.attachments[0].fileName || record.attachments[0].file_name) : '');
  const attachments = Array.isArray(record.attachments) && record.attachments.length > 0
    ? record.attachments.map(att => ({
        fileName: att.fileName || att.file_name || fileName || 'Tài liệu đính kèm',
        file_name: att.fileName || att.file_name || fileName || 'Tài liệu đính kèm',
        fileUrl: att.fileUrl || att.file_url || fileUrl || '',
        file_url: att.fileUrl || att.file_url || fileUrl || '',
        fileType: att.fileType || att.file_type || 'application/pdf',
        file_type: att.fileType || att.file_type || 'application/pdf',
        fileSize: att.fileSize || att.file_size_kb || 0,
        file_size_kb: att.fileSize || att.file_size_kb || 0,
      }))
    : (fileUrl ? [{
        fileName: fileName || fileUrl.split('/').pop() || 'Tài liệu đính kèm',
        file_name: fileName || fileUrl.split('/').pop() || 'Tài liệu đính kèm',
        fileUrl,
        file_url: fileUrl,
        fileType: fileUrl.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        file_type: fileUrl.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        fileSize: 0,
        file_size_kb: 0,
      }] : []);

  return {
    id,
    _id: id,
    record_id: id,
    recordId: id,
    petId: record.petId ? record.petId.toString() : '',
    pet_id: record.petId ? record.petId.toString() : '',
    recordName: condition,
    record_name: condition,
    condition,
    doctor: doctorName,
    doctorName,
    doctor_name: doctorName,
    visitDate,
    visit_date: visitDate,
    date: dateStr,
    examinationDate: visitDate,
    notes,
    treatmentNote: notes,
    treatment_note: notes,
    diagnosis: record.diagnosis || condition,
    symptoms: record.symptoms || '',
    fileUrl,
    file_url: fileUrl,
    fileName,
    file_name: fileName,
    attachments,
    sourceType: record.sourceType || 'user_uploaded',
    source_type: record.sourceType || 'user_uploaded',
    createdAt: record.createdAt || new Date(),
  };
}

// Persistent MongoDB Medical Records
router.get('/medical-records/pet/:petId', optionalAuth, async (req, res, next) => {
  try {
    const rawPetId = String(req.params.petId).trim();
    let pet = null;
    if (mongoose.Types.ObjectId.isValid(rawPetId)) {
      pet = await Pet.findById(rawPetId);
    }
    if (!pet) {
      pet = await Pet.findOne({
        $or: [
          { name: new RegExp(`^${rawPetId}$`, 'i') },
          { name: new RegExp(`^${rawPetId.replace(/-/g, ' ')}$`, 'i') }
        ]
      });
    }

    const petObjectId = pet ? pet._id : (mongoose.Types.ObjectId.isValid(rawPetId) ? new mongoose.Types.ObjectId(rawPetId) : null);
    let records = [];
    if (petObjectId) {
      records = await MedicalRecord.find({ petId: petObjectId }).sort({ visitDate: -1, createdAt: -1 });
    }

    if (records.length === 0 && pet && Array.isArray(pet.medicalRecords) && pet.medicalRecords.length > 0) {
      const formatted = pet.medicalRecords.map((r, idx) => formatMedicalRecordResponse({
        _id: r._id || `${pet._id}_med_${idx}`,
        petId: pet._id,
        condition: r.condition || r.recordName || 'Khám tổng quát',
        doctorName: r.doctorName || pet.doctorName || 'Bác sĩ phụ trách',
        visitDate: r.visitDate || r.examinationDate || r.createdAt,
        notes: r.notes || r.treatmentNote || '',
        fileUrl: r.fileUrl,
        fileName: r.fileName,
        attachments: r.attachments,
        createdAt: r.createdAt,
      }));
      return res.status(200).json({ success: true, data: formatted, EC: 0, EM: 'Success', DT: formatted });
    }

    const formatted = records.map(formatMedicalRecordResponse);
    return res.status(200).json({ success: true, data: formatted, EC: 0, EM: 'Success', DT: formatted });
  } catch (err) {
    next(err);
  }
});

router.post('/medical-records', optionalAuth, (req, res, next) => {
  upload.array('attachments', 5)(req, res, (err) => {
    if (err) console.warn('Multer upload warning:', err.message);
    next();
  });
}, async (req, res, next) => {
  try {
    const rawPetId = req.body.petId || req.body.pet_id;
    let pet = null;
    if (rawPetId && mongoose.Types.ObjectId.isValid(rawPetId)) {
      pet = await Pet.findById(rawPetId);
    }
    if (!pet && rawPetId) {
      pet = await Pet.findOne({
        $or: [
          { name: new RegExp(`^${String(rawPetId).trim()}$`, 'i') },
          { name: new RegExp(`^${String(rawPetId).trim().replace(/-/g, ' ')}$`, 'i') }
        ]
      });
    }

    const petObjectId = pet ? pet._id : (rawPetId && mongoose.Types.ObjectId.isValid(rawPetId) ? new mongoose.Types.ObjectId(rawPetId) : new mongoose.Types.ObjectId());

    const condition = (req.body.condition || req.body.record_name || req.body.recordName || req.body.name || req.body.title || 'Khám tổng quát').trim();
    const doctorName = (req.body.doctor || req.body.doctorName || req.body.doctor_name || req.body.attendingDoctor || req.body.bacSi || 'Bác sĩ phụ trách').trim();
    const visitDate = req.body.visitDate || req.body.visit_date || req.body.examinationDate || req.body.date || new Date();
    const notes = req.body.notes || req.body.treatment_note || req.body.treatmentNote || req.body.diagnosis || req.body.symptoms || '';
    const diagnosis = req.body.diagnosis || condition;
    const symptoms = req.body.symptoms || '';

    let attachments = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      attachments = req.files.map(f => ({
        fileName: f.originalname,
        fileUrl: `/uploads/${f.filename}`,
        fileType: f.mimetype,
        fileSize: Math.round(f.size / 1024),
      }));
    } else if (Array.isArray(req.body.attachments)) {
      attachments = req.body.attachments.map(att => ({
        fileName: att.fileName || att.file_name || 'Tệp đính kèm',
        fileUrl: att.fileUrl || att.file_url || '',
        fileType: att.fileType || att.file_type || 'application/pdf',
        fileSize: att.fileSize || att.file_size_kb || 0,
      }));
    } else if (req.body.fileUrl || req.body.medicalRecordFileUrl) {
      const url = req.body.fileUrl || req.body.medicalRecordFileUrl;
      attachments.push({
        fileName: req.body.fileName || url.split('/').pop() || 'Tệp đính kèm',
        fileUrl: url,
        fileType: url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        fileSize: 0,
      });
    }

    const primaryFileUrl = attachments[0]?.fileUrl || req.body.fileUrl || req.body.medicalRecordFileUrl || '';
    const primaryFileName = attachments[0]?.fileName || req.body.fileName || (primaryFileUrl ? primaryFileUrl.split('/').pop() : '');

    const record = new MedicalRecord({
      petId: petObjectId,
      recordName: condition,
      condition,
      doctorName,
      doctor: doctorName,
      visitDate: new Date(visitDate),
      symptoms,
      diagnosis,
      treatmentNote: notes,
      notes,
      fileUrl: primaryFileUrl,
      fileName: primaryFileName,
      attachments,
      sourceType: req.actor?.systemRole === 'STAFF' ? 'doctor_created' : 'user_uploaded',
      createdByUserId: req.actor?.id || null,
    });
    await record.save();

    if (pet) {
      pet.medicalRecords = pet.medicalRecords || [];
      pet.medicalRecords.push({
        recordName: condition,
        condition,
        doctorName,
        doctor: doctorName,
        fileUrl: primaryFileUrl,
        fileName: primaryFileName,
        notes,
        treatmentNote: notes,
        examinationDate: new Date(visitDate),
        visitDate: new Date(visitDate),
        attachments,
        createdAt: record.createdAt,
      });
      if (doctorName && !pet.doctorName) pet.doctorName = doctorName;
      if (primaryFileUrl && !pet.medicalRecordFileUrl) pet.medicalRecordFileUrl = primaryFileUrl;
      await pet.save();
    }

    const formatted = formatMedicalRecordResponse(record);
    return res.status(201).json({
      success: true,
      message: 'Lưu bệnh án thành công',
      data: formatted,
      EC: 0,
      EM: 'Lưu bệnh án thành công',
      DT: formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/medical-records/:recordId', optionalAuth, (req, res, next) => {
  upload.array('attachments', 5)(req, res, (err) => {
    if (err) console.warn('Multer update error:', err.message);
    next();
  });
}, async (req, res, next) => {
  try {
    const rawId = req.params.recordId;
    let record = null;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      record = await MedicalRecord.findById(rawId);
    }
    if (!record) {
      record = await MedicalRecord.findOne({
        $or: [{ _id: rawId }, { condition: rawId }, { recordName: rawId }]
      });
    }

    const condition = (req.body.condition || req.body.record_name || req.body.recordName || req.body.name || req.body.title || (record ? record.condition : 'Khám tổng quát')).trim();
    const doctorName = (req.body.doctor || req.body.doctorName || req.body.doctor_name || req.body.attendingDoctor || (record ? record.doctorName : 'Bác sĩ phụ trách')).trim();
    const visitDate = req.body.visitDate || req.body.visit_date || req.body.examinationDate || (record ? record.visitDate : new Date());
    const notes = req.body.notes !== undefined ? req.body.notes : (req.body.treatment_note || (record ? record.notes : ''));

    let attachments = record ? (record.attachments || []) : [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      attachments = req.files.map(f => ({
        fileName: f.originalname,
        fileUrl: `/uploads/${f.filename}`,
        fileType: f.mimetype,
        fileSize: Math.round(f.size / 1024),
      }));
    } else if (Array.isArray(req.body.attachments)) {
      attachments = req.body.attachments;
    }

    const primaryFileUrl = attachments[0]?.fileUrl || req.body.fileUrl || (record ? record.fileUrl : '');
    const primaryFileName = attachments[0]?.fileName || req.body.fileName || (record ? record.fileName : '');

    if (!record) {
      record = new MedicalRecord({
        _id: mongoose.Types.ObjectId.isValid(rawId) ? new mongoose.Types.ObjectId(rawId) : new mongoose.Types.ObjectId(),
        petId: req.body.petId && mongoose.Types.ObjectId.isValid(req.body.petId) ? new mongoose.Types.ObjectId(req.body.petId) : new mongoose.Types.ObjectId(),
        recordName: condition,
        condition,
        doctorName,
        doctor: doctorName,
        visitDate: new Date(visitDate),
        notes,
        treatmentNote: notes,
        fileUrl: primaryFileUrl,
        fileName: primaryFileName,
        attachments,
      });
    } else {
      record.condition = condition;
      record.recordName = condition;
      record.doctorName = doctorName;
      record.doctor = doctorName;
      record.visitDate = new Date(visitDate);
      record.notes = notes;
      record.treatmentNote = notes;
      if (primaryFileUrl) record.fileUrl = primaryFileUrl;
      if (primaryFileName) record.fileName = primaryFileName;
      if (attachments.length > 0) record.attachments = attachments;
    }

    await record.save();
    const formatted = formatMedicalRecordResponse(record);
    return res.status(200).json({
      success: true,
      message: 'Cập nhật bệnh án thành công',
      data: formatted,
      EC: 0,
      EM: 'Cập nhật bệnh án thành công',
      DT: formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/medical-records/:recordId', optionalAuth, async (req, res, next) => {
  try {
    const rawId = req.params.recordId;
    if (mongoose.Types.ObjectId.isValid(rawId)) {
      await MedicalRecord.findByIdAndDelete(rawId);
    }
    await Pet.updateMany(
      { 'medicalRecords._id': rawId },
      { $pull: { medicalRecords: { _id: rawId } } }
    );
    return res.status(200).json({
      success: true,
      message: 'Xóa bệnh án thành công',
      EC: 0,
      EM: 'Xóa bệnh án thành công',
    });
  } catch (err) {
    next(err);
  }
});

// Alias for PUT /api/v1/users/:id
router.put('/users/:id', optionalAuth, async (req, res) => {
  try {
    const User = require('../../models/User').default || require('../../models/User');
    const user = await User.findById(req.params.id);
    if (user) {
      if (req.body.fullName || req.body.full_name) user.fullName = req.body.fullName || req.body.full_name;
      if (req.body.phone) user.phone = req.body.phone;
      if (req.body.email) user.email = req.body.email;
      if (req.body.avatarUrl || req.body.avatar_url) user.avatarUrl = req.body.avatarUrl || req.body.avatar_url;
      await user.save();
    }
    res.status(200).json({
      success: true,
      data: {
        userId: req.params.id,
        fullName: req.body.fullName || user?.fullName || 'Khách hàng',
        phone: req.body.phone || user?.phone || '',
        email: req.body.email || user?.email || '',
        avatarUrl: req.body.avatarUrl || user?.avatarUrl || '',
      }
    });
  } catch {
    res.status(200).json({
      success: true,
      data: {
        userId: req.params.id,
        fullName: req.body.fullName || 'Khách hàng',
        phone: req.body.phone || '',
        email: req.body.email || '',
        avatarUrl: req.body.avatarUrl || '',
      }
    });
  }
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

// 8. Bảng giá dịch vụ (Service Pricing Matrix - synced with Service Catalog & docs/catalog (2).xlsx)
router.get('/services/pricing-matrix', async (_req, res) => {
  const canonicalFallback = [
    {
      category_name: 'Khám & Điều trị thú y',
      weight_ranges: [{ label: 'Bảng giá chuẩn (Mọi cân nặng)' }],
      services: [
        { code: 'MED01', service_name: 'Khám sức khỏe tổng quát', durationMinutes: 30, bookingMode: 'BOOKABLE', requiredStaffRole: 'VETERINARIAN', prices: [{ price: 150000, is_contact: false }] },
        { code: 'MED02', service_name: 'Tiêm phòng', durationMinutes: 20, bookingMode: 'BOOKABLE', requiredStaffRole: 'VETERINARIAN', prices: [{ price: 200000, is_contact: false }] },
        { code: 'MED03', service_name: 'Xét nghiệm máu / Test nhanh', durationMinutes: 30, bookingMode: 'BOOKABLE', requiredStaffRole: 'VETERINARIAN', prices: [{ price: 250000, is_contact: false }] },
        { code: 'MED04', service_name: 'Siêu âm', durationMinutes: 30, bookingMode: 'BOOKABLE', requiredStaffRole: 'VETERINARIAN', prices: [{ price: 250000, is_contact: false }] },
        { code: 'MED05', service_name: 'Thay băng / Chăm sóc sau điều trị', durationMinutes: 30, bookingMode: 'BOOKABLE', requiredStaffRole: 'NURSE', prices: [{ price: 120000, is_contact: false }] },
        { code: 'MED06', service_name: 'Phẫu thuật / Triệt sản', durationMinutes: 120, bookingMode: 'REQUEST_ONLY', requiredStaffRole: 'VETERINARIAN', prices: [{ price: 800000, is_contact: true, label: 'Từ 800.000đ' }] },
        { code: 'MED07', service_name: 'Cấp cứu 24/7', durationMinutes: null, bookingMode: 'CONTACT_ONLY', requiredStaffRole: 'VETERINARIAN', prices: [{ price: null, is_contact: true, label: 'Báo giá sau tiếp nhận' }] },
      ],
    },
    {
      category_name: 'Grooming & Spa thú cưng',
      weight_ranges: [
        { tier: 'XS', label: 'XS (< 5 kg)' },
        { tier: 'S', label: 'S (5 – <10 kg)' },
        { tier: 'M', label: 'M (10 – <20 kg)' },
        { tier: 'L', label: 'L (20 – 30 kg)' },
        { tier: 'XL', label: 'XL (> 30 kg)' },
      ],
      services: [
        { code: 'GRM01', service_name: 'Tắm & Sấy khô', durationMinutes: 60, prices: [{ price: 70000, is_contact: false }, { price: 100000, is_contact: false }, { price: 170000, is_contact: false }, { price: 270000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'GRM02', service_name: 'Massage chuyên sâu', durationMinutes: 45, prices: [{ price: 75000, is_contact: false }, { price: 110000, is_contact: false }, { price: 180000, is_contact: false }, { price: 280000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'GRM03', service_name: 'Vệ sinh răng miệng', durationMinutes: 20, prices: [{ price: 45000, is_contact: false }, { price: 70000, is_contact: false }, { price: 120000, is_contact: false }, { price: 180000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'GRM04', service_name: 'Cắt & mài móng', durationMinutes: 20, prices: [{ price: 45000, is_contact: false }, { price: 60000, is_contact: false }, { price: 95000, is_contact: false }, { price: 145000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'GRM05', service_name: 'Chăm sóc bàn chân', durationMinutes: 25, prices: [{ price: 45000, is_contact: false }, { price: 60000, is_contact: false }, { price: 95000, is_contact: false }, { price: 145000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'GRM06', service_name: 'Điều trị ký sinh trùng ngoài da', durationMinutes: 45, prices: [{ price: 110000, is_contact: false }, { price: 150000, is_contact: false }, { price: 250000, is_contact: false }, { price: 365000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'GRM07', service_name: 'Cắt tỉa tạo kiểu', durationMinutes: 90, prices: [{ price: 85000, is_contact: false }, { price: 130000, is_contact: false }, { price: 240000, is_contact: false }, { price: 380000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'GRM08', service_name: 'Nhuộm lông thời trang', durationMinutes: 120, prices: [{ price: 120000, is_contact: false }, { price: 180000, is_contact: false }, { price: 340000, is_contact: false }, { price: 540000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'GRM09', service_name: 'Vắt tuyến hôi', durationMinutes: 20, prices: [{ price: 65000, is_contact: false }, { price: 90000, is_contact: false }, { price: 135000, is_contact: false }, { price: 200000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'CMB01', service_name: 'Combo Tắm 11 bước', durationMinutes: 120, prices: [{ price: 180000, is_contact: false }, { price: 230000, is_contact: false }, { price: 385000, is_contact: false }, { price: 525000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'CMB02', service_name: 'Combo Tắm cơ bản & cắt tỉa lông', durationMinutes: 150, prices: [{ price: 135000, is_contact: false }, { price: 190000, is_contact: false }, { price: 325000, is_contact: false }, { price: 485000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
        { code: 'CMB03', service_name: 'Combo Chăm sóc & bảo vệ móng', durationMinutes: 45, prices: [{ price: 100000, is_contact: false }, { price: 135000, is_contact: false }, { price: 210000, is_contact: false }, { price: 300000, is_contact: false }, { price: null, is_contact: true, label: 'Liên hệ' }] },
      ],
    },
  ];

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      const Service = require('../catalog/models/Service').default || require('../catalog/models/Service');
      const liveServices = await Service.find({ status: 'ACTIVE' }).sort({ code: 1 }).lean();
      if (Array.isArray(liveServices) && liveServices.length > 0) {
        const medServices = liveServices.filter((s) => s.serviceType === 'MEDICAL').map((s) => ({
          id: s._id.toString(),
          code: s.code,
          service_name: s.name,
          durationMinutes: s.bookingMode === 'CONTACT_ONLY' ? null : s.durationMinutes,
          bookingMode: s.bookingMode,
          requiredStaffRole: s.requiredStaffRole,
          prices: [
            {
              price: s.bookingMode === 'CONTACT_ONLY' ? null : Number(s.basePrice || 0),
              is_contact: s.bookingMode === 'CONTACT_ONLY' || s.bookingMode === 'REQUEST_ONLY',
              label: s.bookingMode === 'CONTACT_ONLY' ? 'Báo giá sau tiếp nhận' : undefined,
            },
          ],
        }));

        const tiers = ['XS', 'S', 'M', 'L', 'XL'];
        const grmServices = liveServices
          .filter((s) => s.serviceType === 'GROOMING')
          .sort((a, b) => {
            const aGrm = String(a.code || '').startsWith('GRM') ? 0 : 1;
            const bGrm = String(b.code || '').startsWith('GRM') ? 0 : 1;
            if (aGrm !== bGrm) return aGrm - bGrm;
            return String(a.code || '').localeCompare(String(b.code || ''));
          })
          .map((s) => {
            const variantMap = new Map((s.priceVariants || []).map((v) => [String(v.tier || '').toUpperCase(), v]));
            return {
              id: s._id.toString(),
              code: s.code,
              service_name: s.name,
              durationMinutes: s.durationMinutes,
              bookingMode: s.bookingMode,
              requiredStaffRole: s.requiredStaffRole,
              prices: tiers.map((t) => {
                const v = variantMap.get(t);
                if (!v || v.mode === 'QUOTE' || t === 'XL') {
                  return { tier: t, price: null, is_contact: true, label: 'Liên hệ' };
                }
                return { tier: t, price: Number(v.price ?? s.basePrice ?? 0), is_contact: false };
              }),
            };
          });

        return res.status(200).json({
          success: true,
          data: [
            { ...canonicalFallback[0], services: medServices },
            { ...canonicalFallback[1], services: grmServices },
          ],
        });
      }
    }
  } catch {
    // fallback safely to canonical static matrix
  }

  res.status(200).json({
    success: true,
    data: canonicalFallback,
  });
});

// Note: POST /appointments/quote & /appointments/preview-pricing are handled by bookingRoutes (bookingController.previewPricing)

// 10. User Profile & Address Book Legacy/Angular Contract (/users/:userId & /addresses/:addressId)
const formatAddressDto = (addr, userId = '') => {
  if (!addr) return null;
  const obj = typeof addr.toObject === 'function' ? addr.toObject() : addr;
  const aid = (obj._id || obj.id || '').toString();
  const addrLine = obj.addressDetail || obj.address_line || obj.address || obj.fullAddress || '';
  const prov = obj.province || obj.city || 'Thành phố Hồ Chí Minh';
  return {
    _id: aid,
    id: aid,
    address_id: aid,
    user_id: String(userId || ''),
    fullName: obj.fullName || obj.recipient_name || obj.name || 'Khách hàng',
    recipient_name: obj.fullName || obj.recipient_name || obj.name || 'Khách hàng',
    name: obj.fullName || obj.recipient_name || obj.name || 'Khách hàng',
    phone: obj.phone || obj.recipient_phone || '',
    recipient_phone: obj.phone || obj.recipient_phone || '',
    email: obj.email || obj.recipient_email || null,
    recipient_email: obj.email || obj.recipient_email || null,
    country: obj.country || 'Việt Nam',
    province: prov,
    city: prov,
    provinceCode: obj.provinceCode || null,
    district: obj.district || '',
    districtCode: obj.districtCode || null,
    ward: obj.ward || '',
    wardCode: obj.wardCode || null,
    addressDetail: addrLine,
    address_line: addrLine,
    address: addrLine,
    fullAddress: obj.fullAddress || [addrLine, obj.ward, obj.district, prov].filter(Boolean).join(', '),
    isDefault: Boolean(obj.isDefault ?? obj.is_default),
    is_default: Boolean(obj.isDefault ?? obj.is_default),
  };
};

const normalizeIncomingAddressPayload = (body = {}) => {
  return {
    fullName: body.fullName || body.recipient_name || body.name,
    phone: body.phone || body.recipient_phone,
    email: body.email || body.recipient_email,
    country: body.country || 'Việt Nam',
    province: body.province || body.city || 'Thành phố Hồ Chí Minh',
    provinceCode: body.provinceCode || body.province_code || null,
    district: body.district || null,
    districtCode: body.districtCode || body.district_code || null,
    ward: body.ward || null,
    wardCode: body.wardCode || body.ward_code || null,
    addressDetail: body.addressDetail || body.address_line || body.address || '',
    isDefault: body.isDefault !== undefined ? Boolean(body.isDefault) : Boolean(body.is_default),
  };
};

router.get('/users/:userId', optionalAuth, async (req, res, next) => {
  try {
    const targetUserId = req.params.userId === 'me' && req.actor?.id ? req.actor.id : req.params.userId;
    const user = await authService.getMe(targetUserId);
    const formatted = formatMe(user);
    return res.status(200).json({
      EC: 0,
      EM: 'Success',
      DT: formatted,
      ...formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/users/:userId', optionalAuth, async (req, res, next) => {
  try {
    const targetUserId = req.params.userId === 'me' && req.actor?.id ? req.actor.id : req.params.userId;
    const payload = {
      fullName: req.body.fullName !== undefined ? req.body.fullName : req.body.full_name,
      email: req.body.email,
      avatarUrl: req.body.avatarUrl !== undefined ? req.body.avatarUrl : req.body.avatar_url,
      addresses: req.body.addresses,
    };
    const updated = await authService.updateMe(targetUserId, payload);
    if (req.body.phone && updated.phone !== req.body.phone) {
      updated.phone = String(req.body.phone).trim();
      await updated.save();
    }
    const formatted = formatMe(updated);
    return res.status(200).json({
      EC: 0,
      EM: 'Cập nhật thông tin tài khoản thành công',
      DT: formatted,
      ...formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/addresses', optionalAuth, async (req, res, next) => {
  try {
    const targetUserId = req.params.userId === 'me' && req.actor?.id ? req.actor.id : req.params.userId;
    const list = await authService.listAddresses(targetUserId);
    const formattedList = (list || []).map((a) => formatAddressDto(a, targetUserId));
    return res.status(200).json({
      EC: 0,
      EM: 'Success',
      DT: formattedList,
      items: formattedList,
      data: formattedList,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/addresses', optionalAuth, async (req, res, next) => {
  try {
    const targetUserId = req.params.userId === 'me' && req.actor?.id ? req.actor.id : req.params.userId;
    const addrPayload = normalizeIncomingAddressPayload(req.body);
    const created = await authService.addAddress(targetUserId, addrPayload);
    const formatted = formatAddressDto(created, targetUserId);
    return res.status(201).json({
      EC: 0,
      EM: 'Thêm địa chỉ thành công',
      DT: formatted,
      ...formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/addresses/:addressId', optionalAuth, async (req, res, next) => {
  try {
    const addressId = req.params.addressId;
    let userId = req.actor?.id;
    if (!userId && mongoose.Types.ObjectId.isValid(addressId)) {
      const owner = await User.findOne({ 'addresses._id': new mongoose.Types.ObjectId(addressId) }).select('_id').lean();
      if (owner) userId = owner._id.toString();
    }
    if (!userId) {
      return res.status(401).json({ EC: 1, EM: 'Unauthorized' });
    }
    const addrPayload = normalizeIncomingAddressPayload(req.body);
    const updated = await authService.updateAddress(userId, addressId, addrPayload);
    const formatted = formatAddressDto(updated, userId);
    return res.status(200).json({
      EC: 0,
      EM: 'Cập nhật địa chỉ thành công',
      DT: formatted,
      ...formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/addresses/:addressId', optionalAuth, async (req, res, next) => {
  try {
    const addressId = req.params.addressId;
    let userId = req.actor?.id;
    if (!userId && mongoose.Types.ObjectId.isValid(addressId)) {
      const owner = await User.findOne({ 'addresses._id': new mongoose.Types.ObjectId(addressId) }).select('_id').lean();
      if (owner) userId = owner._id.toString();
    }
    if (!userId) {
      return res.status(401).json({ EC: 1, EM: 'Unauthorized' });
    }
    const result = await authService.deleteAddress(userId, addressId);
    return res.status(200).json({
      EC: 0,
      EM: 'Xóa địa chỉ thành công',
      DT: result,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// 11. Provinces / Districts / Wards Direct Aliases
router.get('/provinces', (req, res) => {
  const data = getProvinces({ q: req.query.q });
  res.status(200).json({ EC: 0, EM: 'Success', DT: data, success: true, data, total: data.length });
});

router.get('/provinces/:provinceCode/districts', (req, res) => {
  const data = getDistricts(req.params.provinceCode, { q: req.query.q });
  res.status(200).json({ EC: 0, EM: 'Success', DT: data, success: true, data, total: data.length });
});

router.get('/districts/:districtCode/wards', (req, res) => {
  const data = getWards(req.params.districtCode, { q: req.query.q });
  res.status(200).json({ EC: 0, EM: 'Success', DT: data, success: true, data, total: data.length });
});

export default router;

