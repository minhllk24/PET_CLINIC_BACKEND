import mongoose from 'mongoose';
import Post from './models/Post.js';
import CommunityPost from './models/CommunityPost.js';
import RescuePet from './models/RescuePet.js';
import AdoptionRequest from './models/AdoptionRequest.js';
import Customer from '../customer/models/Customer.js';
import AppError from '../../utils/AppError.js';

/**
 * Helper to slugify Vietnamese string to URL-safe slug
 */
const slugify = (text) => {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

export const contentService = {
  // =========================================================================
  // 1. OFFICIAL BLOG & FIRST AID GUIDES
  // =========================================================================

  async createPost(data, authorId) {
    const { title, postType, category, content, excerpt, thumbnailUrl, isFeatured, status, emergencyPhone, steps } = data;
    if (!title || !content || !category) {
      throw new AppError(400, 'Thiếu thông tin bắt buộc của bài viết (title, content, category)', 'VALIDATION_ERROR');
    }

    let slug = data.slug ? slugify(data.slug) : slugify(title);
    // Ensure slug uniqueness
    const existing = await Post.findOne({ slug });
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const post = await Post.create({
      title,
      slug,
      postType: postType || 'OFFICIAL_BLOG',
      category,
      content,
      excerpt: excerpt || title,
      thumbnailUrl: thumbnailUrl || null,
      isFeatured: !!isFeatured,
      status: status || 'DRAFT',
      authorId,
      emergencyPhone: emergencyPhone || '1900-PET-HELP',
      steps: Array.isArray(steps) ? steps : [],
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
    });

    return post;
  },

  async getPostsAdmin({ postType, status, category, search, page = 1, limit = 10 }) {
    const query = {};
    if (postType) query.postType = postType;
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      Post.countDocuments(query),
      Post.find(query)
        .populate('authorId', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  async getPostById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, 'ID bài viết không hợp lệ', 'VALIDATION_ERROR');
    }
    const post = await Post.findById(id).populate('authorId', 'fullName email');
    if (!post) {
      throw new AppError(404, 'Không tìm thấy bài viết', 'NOT_FOUND');
    }
    return post;
  },

  async updatePost(id, data) {
    const post = await this.getPostById(id);
    const updatable = ['title', 'category', 'content', 'excerpt', 'thumbnailUrl', 'isFeatured', 'emergencyPhone', 'steps'];
    
    updatable.forEach((field) => {
      if (data[field] !== undefined) {
        post[field] = data[field];
      }
    });

    if (data.slug && data.slug !== post.slug) {
      const cleanSlug = slugify(data.slug);
      const conflict = await Post.findOne({ slug: cleanSlug, _id: { $ne: id } });
      if (conflict) {
        throw new AppError(409, 'Đường dẫn bài viết (slug) đã tồn tại', 'CONFLICT');
      }
      post.slug = cleanSlug;
    }

    await post.save();
    return post;
  },

  async updatePostStatus(id, newStatus) {
    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(newStatus)) {
      throw new AppError(400, 'Trạng thái bài viết không hợp lệ (DRAFT, PUBLISHED, ARCHIVED)', 'VALIDATION_ERROR');
    }
    const post = await this.getPostById(id);
    post.status = newStatus;
    if (newStatus === 'PUBLISHED' && !post.publishedAt) {
      post.publishedAt = new Date();
    }
    await post.save();
    return post;
  },

  async deletePost(id) {
    const post = await this.getPostById(id);
    await Post.deleteOne({ _id: post._id });
    return { success: true, message: 'Đã xóa bài viết thành công' };
  },

  async getPostsPublic({ postType, category, search, page = 1, limit = 10, isFeatured }) {
    const query = { status: 'PUBLISHED' };
    if (postType) query.postType = postType;
    if (category) query.category = category;
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      Post.countDocuments(query),
      Post.find(query)
        .populate('authorId', 'fullName')
        .sort({ isFeatured: -1, publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  async getPostBySlugPublic(slug) {
    const post = await Post.findOne({ slug, status: 'PUBLISHED' }).populate('authorId', 'fullName');
    if (!post) {
      throw new AppError(404, 'Bài viết không tồn tại hoặc chưa được xuất bản', 'NOT_FOUND');
    }
    // Tăng lượt xem không chặn response
    Post.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }).catch(() => {});
    return post;
  },

  async getFeaturedPosts() {
    let posts = await Post.find({ status: 'PUBLISHED', isFeatured: true })
      .populate('authorId', 'fullName')
      .sort({ publishedAt: -1 })
      .limit(5);

    if (!posts || posts.length === 0) {
      posts = await Post.find({ status: 'PUBLISHED' })
        .populate('authorId', 'fullName')
        .sort({ createdAt: -1 })
        .limit(2);
    }
    return posts;
  },

  async getTrendingPosts() {
    return Post.find({ status: 'PUBLISHED' })
      .populate('authorId', 'fullName')
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(5);
  },

  async getPostCategories() {
    const categories = await Post.distinct('category', { status: 'PUBLISHED' });
    if (!categories || categories.length === 0) {
      return [
        { id: 'cat-1', name: 'Cẩm nang nuôi dưỡng', slug: 'cam-nang-nuoi-duong' },
        { id: 'cat-2', name: 'Dinh dưỡng thú cưng', slug: 'dinh-duong-thu-cung' },
        { id: 'cat-3', name: 'Y tế & Bệnh học', slug: 'y-te-benh-hoc' },
      ];
    }
    return categories.map((cat, idx) => ({
      id: `cat-${idx + 1}`,
      name: cat,
      slug: slugify(cat),
    }));
  },

  // =========================================================================
  // 2. COMMUNITY POSTS & MODERATION
  // =========================================================================

  async createCommunityPost(data, actor) {
    const { title, content, imageUrls } = data;
    if (!title || !content) {
      throw new AppError(400, 'Tiêu đề và nội dung bài viết cộng đồng là bắt buộc', 'VALIDATION_ERROR');
    }

    const customer = await Customer.findOne({ userId: actor.id });
    if (!customer) {
      throw new AppError(403, 'Chỉ có tài khoản khách hàng thành viên mới được đăng bài chia sẻ', 'AUTHORIZATION_ERROR');
    }

    const post = await CommunityPost.create({
      title,
      content,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      authorCustomerId: customer._id,
      authorNameSnapshot: customer.fullName || actor.fullName || 'Thành viên yêu thú cưng',
      authorAvatarSnapshot: customer.avatarUrl || null,
      status: 'PENDING', // Bắt buộc vào hàng đợi duyệt
    });

    return post;
  },

  async getCommunityPostsAdmin({ status, search, page = 1, limit = 10 }) {
    const query = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { authorNameSnapshot: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      CommunityPost.countDocuments(query),
      CommunityPost.find(query)
        .populate('authorCustomerId', 'fullName phone email')
        .populate('moderatedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  async moderateCommunityPost(id, { status, rejectionReason }, moderatorId) {
    if (!['APPROVED', 'REJECTED', 'HIDDEN'].includes(status)) {
      throw new AppError(400, 'Hành động kiểm duyệt không hợp lệ (APPROVED, REJECTED, HIDDEN)', 'VALIDATION_ERROR');
    }
    if (status === 'REJECTED' && !rejectionReason) {
      throw new AppError(400, 'Cần cung cấp lý do từ chối bài viết', 'VALIDATION_ERROR');
    }

    const post = await CommunityPost.findById(id);
    if (!post) {
      throw new AppError(404, 'Không tìm thấy bài viết cộng đồng', 'NOT_FOUND');
    }

    post.status = status;
    post.rejectionReason = status === 'REJECTED' ? rejectionReason : null;
    post.moderatedBy = moderatorId;
    post.moderatedAt = new Date();

    await post.save();
    return post;
  },

  async deleteCommunityPost(id) {
    const post = await CommunityPost.findById(id);
    if (!post) {
      throw new AppError(404, 'Không tìm thấy bài viết cộng đồng', 'NOT_FOUND');
    }
    await CommunityPost.deleteOne({ _id: post._id });
    return { success: true, message: 'Đã xóa bài viết cộng đồng thành công' };
  },

  async getCommunityPostsPublic({ page = 1, limit = 10 }) {
    const query = { status: 'APPROVED' };
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      CommunityPost.countDocuments(query),
      CommunityPost.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  // =========================================================================
  // 3. RESCUE PETS & ADOPTION
  // =========================================================================

  async createRescuePet(data) {
    const { petName, species, breed, gender, ageDescription, healthStatus, rescueStory, images, branchId } = data;
    if (!petName || !species || !breed || !ageDescription || !healthStatus || !rescueStory) {
      throw new AppError(400, 'Thiếu thông tin bắt buộc của thú cưng cứu hộ', 'VALIDATION_ERROR');
    }

    // Auto generate petCode RES-XXXX
    const count = await RescuePet.countDocuments();
    const petCode = `RES-${String(count + 1).padStart(4, '0')}`;

    const rescuePet = await RescuePet.create({
      petCode,
      petName,
      species,
      breed,
      gender: gender || 'UNKNOWN',
      ageDescription,
      healthStatus,
      rescueStory,
      images: Array.isArray(images) && images.length > 0 ? images : ['https://images.unsplash.com/photo-1543466835-00a7907e9de1'],
      status: 'LOOKING_FOR_HOME',
      branchId: branchId || null,
    });

    return rescuePet;
  },

  async getRescuePetsAdmin({ status, species, branchId, page = 1, limit = 10 }) {
    const query = {};
    if (status) query.status = status;
    if (species) query.species = species;
    if (branchId) query.branchId = branchId;

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      RescuePet.countDocuments(query),
      RescuePet.find(query)
        .populate('branchId', 'name code')
        .populate('adoptedByCustomerId', 'fullName phone email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  async getRescuePetById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, 'ID thú cưng không hợp lệ', 'VALIDATION_ERROR');
    }
    const pet = await RescuePet.findById(id)
      .populate('branchId', 'name code address hotline')
      .populate('adoptedByCustomerId', 'fullName phone email');
    if (!pet) {
      throw new AppError(404, 'Không tìm thấy hồ sơ thú cưng cứu hộ', 'NOT_FOUND');
    }
    return pet;
  },

  async updateRescuePet(id, data) {
    const pet = await this.getRescuePetById(id);
    const updatable = ['petName', 'species', 'breed', 'gender', 'ageDescription', 'healthStatus', 'rescueStory', 'images', 'branchId'];
    
    updatable.forEach((f) => {
      if (data[f] !== undefined) pet[f] = data[f];
    });

    if (data.status) {
      if (!['LOOKING_FOR_HOME', 'ADOPTED'].includes(data.status)) {
        throw new AppError(400, 'Trạng thái thú cưng phải là LOOKING_FOR_HOME hoặc ADOPTED', 'VALIDATION_ERROR');
      }
      pet.status = data.status;
      if (data.status === 'ADOPTED') {
        pet.adoptedAt = pet.adoptedAt || new Date();
        if (data.adoptedByCustomerId) pet.adoptedByCustomerId = data.adoptedByCustomerId;
      } else {
        pet.adoptedAt = null;
        pet.adoptedByCustomerId = null;
      }
    }

    await pet.save();
    return pet;
  },

  async deleteRescuePet(id) {
    const pet = await this.getRescuePetById(id);
    await RescuePet.deleteOne({ _id: pet._id });
    return { success: true, message: 'Đã xóa hồ sơ thú cưng cứu hộ' };
  },

  async getRescuePetsPublic({ species, page = 1, limit = 10 }) {
    const query = { status: 'LOOKING_FOR_HOME' };
    if (species) query.species = species;

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      RescuePet.countDocuments(query),
      RescuePet.find(query)
        .populate('branchId', 'name address hotline')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  // =========================================================================
  // 4. ADOPTION REQUESTS
  // =========================================================================

  async createAdoptionRequest(data, actor = null) {
    const { rescuePetId, fullName, phone, email, address, housingType, hasPetExperience, message } = data;
    if (!rescuePetId || !fullName || !phone || !email || !address) {
      throw new AppError(400, 'Vui lòng điền đầy đủ các thông tin cá nhân và bé muốn nhận nuôi', 'VALIDATION_ERROR');
    }

    const pet = await RescuePet.findById(rescuePetId);
    if (!pet) {
      throw new AppError(404, 'Không tìm thấy bé thú cưng cần nhận nuôi', 'NOT_FOUND');
    }
    if (pet.status === 'ADOPTED') {
      throw new AppError(400, 'Bé cưng này đã tìm được tổ ấm mới!', 'BUSINESS_RULE_VIOLATION');
    }

    let customerId = null;
    if (actor && actor.id) {
      const customer = await Customer.findOne({ userId: actor.id });
      if (customer) customerId = customer._id;
    }

    const count = await AdoptionRequest.countDocuments();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const requestCode = `ADO-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    const request = await AdoptionRequest.create({
      requestCode,
      rescuePetId: pet._id,
      customerId,
      applicantInfo: {
        fullName,
        phone,
        email,
        address,
        housingType: housingType || 'Nhà riêng',
        hasPetExperience: !!hasPetExperience,
        message: message || '',
      },
      status: 'PENDING',
    });

    return request;
  },

  async getAdoptionRequestsAdmin({ status, rescuePetId, page = 1, limit = 10 }) {
    const query = {};
    if (status) query.status = status;
    if (rescuePetId) query.rescuePetId = rescuePetId;

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      AdoptionRequest.countDocuments(query),
      AdoptionRequest.find(query)
        .populate('rescuePetId', 'petCode petName species breed images status')
        .populate('customerId', 'fullName phone email')
        .populate('reviewedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  async reviewAdoptionRequest(id, { status, reviewNote }, reviewerId) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new AppError(400, 'Trạng thái xét duyệt phải là APPROVED hoặc REJECTED', 'VALIDATION_ERROR');
    }

    const request = await AdoptionRequest.findById(id);
    if (!request) {
      throw new AppError(404, 'Không tìm thấy đơn đăng ký nhận nuôi', 'NOT_FOUND');
    }

    request.status = status;
    request.reviewNote = reviewNote || null;
    request.reviewedBy = reviewerId;
    request.reviewedAt = new Date();
    await request.save();

    // Nếu APPROVED, tự động cập nhật bé sang ADOPTED
    if (status === 'APPROVED') {
      await RescuePet.findByIdAndUpdate(request.rescuePetId, {
        status: 'ADOPTED',
        adoptedAt: new Date(),
        adoptedByCustomerId: request.customerId || null,
      });
    }

    return request;
  },

  async getMyAdoptionRequests(actor) {
    if (!actor || !actor.id) return [];
    const customer = await Customer.findOne({ userId: actor.id });
    if (!customer) return [];

    return AdoptionRequest.find({ customerId: customer._id })
      .populate('rescuePetId', 'petCode petName species breed images status')
      .sort({ createdAt: -1 });
  },
};

export default contentService;
