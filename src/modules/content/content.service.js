import mongoose from 'mongoose';
import Post from './models/Post.js';
import CommunityPost from './models/CommunityPost.js';
import CommunityComment from './models/CommunityComment.js';
import CommunityReport from './models/CommunityReport.js';
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

/**
 * Server-side HTML Sanitizer (Strips <script>, inline event handlers, javascript: pseudo-protocol)
 */
const sanitizeHtml = (html) => {
  if (!html || typeof html !== 'string') return html;
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript:[^"']*/gi, '');
};

const normalizeStep = (s, idx) => {
  if (!s || typeof s !== 'object') return s;
  return {
    stepNumber: s.stepNumber || idx + 1,
    title: s.title || s.step_title || `Bước ${idx + 1}`,
    instruction: s.instruction || s.content || s.description || '',
    description: s.description || s.content || s.instruction || '',
    mediaUrl: s.mediaUrl || s.image_url || s.imageUrl || null,
    imageUrl: s.imageUrl || s.image_url || s.mediaUrl || null,
  };
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

    let slug;
    if (data.slug) {
      slug = slugify(data.slug);
      const existing = await Post.findOne({ slug });
      if (existing) {
        throw new AppError(409, 'Conflict', 'SLUG_ALREADY_EXISTS', 'Đường dẫn bài viết (slug) đã tồn tại');
      }
    } else {
      slug = slugify(title);
      const existing = await Post.findOne({ slug });
      if (existing) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
      }
    }

    const sanitizedContent = sanitizeHtml(content);
    const sanitizedBlocks = Array.isArray(data.contentBlocks)
      ? data.contentBlocks.map(b => ({
          ...b,
          text: b.text ? String(b.text) : null,
          html: b.html ? sanitizeHtml(b.html) : null,
        }))
      : [];
    const normalizedSteps = Array.isArray(steps)
      ? steps.map((s, idx) => normalizeStep(s, idx))
      : [];

    const post = await Post.create({
      title,
      slug,
      postType: postType || 'OFFICIAL_BLOG',
      category,
      content: sanitizedContent,
      contentBlocks: sanitizedBlocks,
      layoutType: data.layoutType || 'STANDARD',
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
      excerpt: excerpt || title,
      thumbnailUrl: thumbnailUrl || null,
      isFeatured: !!isFeatured,
      status: status || 'DRAFT',
      authorId,
      urgencyLevel: data.urgencyLevel || 'NORMAL',
      heroTitle: data.heroTitle || null,
      stepBadges: Array.isArray(data.stepBadges) ? data.stepBadges : [],
      videoUrl: data.videoUrl || null,
      videoTitle: data.videoTitle || null,
      videoDescriptionHtml: data.videoDescriptionHtml ? sanitizeHtml(data.videoDescriptionHtml) : null,
      emergencyPhone: emergencyPhone || '0901234567',
      steps: normalizedSteps,
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
      posts: items,
      guides: items,
      total,
      totalRows: total,
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
    const updatable = [
      'title', 'category', 'content', 'excerpt', 'thumbnailUrl', 'isFeatured',
      'emergencyPhone', 'steps', 'contentBlocks', 'layoutType', 'hashtags',
      'urgencyLevel', 'heroTitle', 'stepBadges', 'videoUrl', 'videoTitle', 'videoDescriptionHtml'
    ];
    
    updatable.forEach((field) => {
      if (data[field] !== undefined) {
        if (field === 'content') {
          post[field] = sanitizeHtml(data[field]);
        } else if (field === 'videoDescriptionHtml') {
          post[field] = sanitizeHtml(data[field]);
        } else if (field === 'contentBlocks' && Array.isArray(data[field])) {
          post[field] = data[field].map(b => ({
            ...b,
            text: b.text ? String(b.text) : null,
            html: b.html ? sanitizeHtml(b.html) : null,
          }));
        } else if (field === 'steps' && Array.isArray(data[field])) {
          post[field] = data[field].map((s, idx) => normalizeStep(s, idx));
        } else {
          post[field] = data[field];
        }
      }
    });

    if (data.slug && data.slug !== post.slug) {
      const cleanSlug = slugify(data.slug);
      const conflict = await Post.findOne({ slug: cleanSlug, _id: { $ne: id } });
      if (conflict) {
        throw new AppError(409, 'Conflict', 'SLUG_ALREADY_EXISTS', 'Đường dẫn bài viết (slug) đã tồn tại');
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
    const query = {
      $or: [
        { slug },
        ...(mongoose.Types.ObjectId.isValid(slug) ? [{ _id: slug }] : []),
      ],
      status: 'PUBLISHED',
    };
    const post = await Post.findOne(query).populate('authorId', 'fullName');
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
    const { title, content, imageUrls, type } = data;
    if (!title || !content) {
      throw new AppError(400, 'Tiêu đề và nội dung bài viết cộng đồng là bắt buộc', 'VALIDATION_ERROR');
    }

    const customer = await Customer.findOne({ userId: actor.id });
    if (!customer) {
      throw new AppError(403, 'Chỉ có tài khoản khách hàng thành viên mới được đăng bài chia sẻ', 'AUTHORIZATION_ERROR');
    }

    const typeLabels = {
      KHOANH_KHAC: 'Khoảnh khắc',
      HOI_DAP: 'Hỏi đáp',
      MEO_VAT: 'Mẹo vặt',
      KINH_NGHIEM: 'Kinh nghiệm',
    };
    const postType = type && typeLabels[type] ? type : 'KHOANH_KHAC';

    const post = await CommunityPost.create({
      title,
      content,
      type: postType,
      typeLabel: typeLabels[postType],
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      authorCustomerId: customer._id,
      authorNameSnapshot: customer.fullName || actor.fullName || 'Thành viên yêu thú cưng',
      authorAvatarSnapshot: customer.avatarUrl || null,
      status: 'PENDING', // Bắt buộc vào hàng đợi duyệt
      reportCount: 0,
      hasOpenReport: false,
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

    const validTransitions = {
      PENDING: ['APPROVED', 'REJECTED'],
      APPROVED: ['HIDDEN', 'REJECTED'],
      HIDDEN: ['APPROVED'],
      REJECTED: ['APPROVED'],
    };
    if (validTransitions[post.status] && !validTransitions[post.status].includes(status)) {
      throw new AppError(409, 'Conflict', 'INVALID_STATE_TRANSITION', `Không thể chuyển trạng thái từ ${post.status} sang ${status}`);
    }

    post.status = status;
    post.rejectionReason = status === 'REJECTED' ? rejectionReason : null;
    post.moderatedBy = moderatorId;
    post.moderatedAt = new Date();
    post.moderationHistory = post.moderationHistory || [];
    post.moderationHistory.push({
      status,
      reason: rejectionReason || null,
      actorId: moderatorId,
      at: new Date(),
    });

    await post.save();
    return post;
  },

  async deleteCommunityPost(id) {
    const post = await CommunityPost.findById(id);
    if (!post) {
      throw new AppError(404, 'Không tìm thấy bài viết cộng đồng', 'NOT_FOUND');
    }
    if (post.status === 'PENDING') {
      throw new AppError(409, 'Conflict', 'MODERATION_ACTION_REQUIRED', 'Không thể xóa bài viết đang ở trạng thái chờ duyệt (PENDING). Vui lòng duyệt hoặc từ chối.');
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
  // COMMUNITY COMMENTS, REPLIES & REACTIONS
  // =========================================================================

  async addCommunityComment(postId, data, actor) {
    const post = await CommunityPost.findById(postId);
    if (!post) {
      throw new AppError(404, 'Không tìm thấy bài viết cộng đồng', 'NOT_FOUND');
    }
    if (post.status !== 'APPROVED') {
      throw new AppError(400, 'Chỉ có thể bình luận trên bài viết đã được duyệt', 'BUSINESS_RULE_VIOLATION');
    }
    if (!data.content || !data.content.trim()) {
      throw new AppError(400, 'Nội dung bình luận không được để trống', 'VALIDATION_ERROR');
    }

    let customer = await Customer.findOne({ userId: actor.id });
    if (!customer) {
      customer = await Customer.findById(actor.id);
    }
    const customerId = customer ? customer._id : actor.id;
    const authorName = customer?.fullName || actor.fullName || 'Khách hàng';
    const authorAvatar = customer?.avatarUrl || null;

    const comment = await CommunityComment.create({
      postId: post._id,
      authorCustomerId: customerId,
      authorNameSnapshot: authorName,
      authorAvatarSnapshot: authorAvatar,
      content: data.content.trim(),
      replies: [],
    });

    await CommunityPost.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } });
    return comment;
  },

  async addCommentReply(commentId, data, actor) {
    if (!data.content || !data.content.trim()) {
      throw new AppError(400, 'Nội dung phản hồi không được để trống', 'VALIDATION_ERROR');
    }

    const comment = await CommunityComment.findById(commentId);
    if (!comment) {
      throw new AppError(404, 'Không tìm thấy bình luận', 'NOT_FOUND');
    }

    const reply = {
      authorId: actor.id,
      authorName: actor.fullName || 'Nhân viên hỗ trợ',
      authorRole: actor.systemRole || 'STAFF',
      content: data.content.trim(),
      createdAt: new Date(),
    };

    comment.replies.push(reply);
    await comment.save();

    await CommunityPost.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: 1 } });
    return comment;
  },

  async getCommunityComments(postId, { page = 1, limit = 20 } = {}) {
    const query = { postId };
    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      CommunityComment.countDocuments(query),
      CommunityComment.find(query)
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

  async likeCommunityPost(postId, actor) {
    const post = await CommunityPost.findById(postId);
    if (!post) {
      throw new AppError(404, 'Không tìm thấy bài viết cộng đồng', 'NOT_FOUND');
    }
    const updated = await CommunityPost.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: 1 } },
      { new: true }
    );
    return { likesCount: updated.likesCount };
  },

  async unlikeCommunityPost(postId, actor) {
    const post = await CommunityPost.findById(postId);
    if (!post) {
      throw new AppError(404, 'Không tìm thấy bài viết cộng đồng', 'NOT_FOUND');
    }
    const updated = await CommunityPost.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: -1 } },
      { new: true }
    );
    if (updated.likesCount < 0) {
      updated.likesCount = 0;
      await updated.save();
    }
    return { likesCount: updated.likesCount };
  },

  // =========================================================================
  // COMMUNITY VIOLATION REPORTS (MOD-09..12)
  // =========================================================================

  async reportCommunityPost(postId, data, actor) {
    const post = await CommunityPost.findById(postId);
    if (!post) {
      throw new AppError(404, 'Không tìm thấy bài viết cộng đồng', 'NOT_FOUND');
    }

    let customer = await Customer.findOne({ userId: actor.id });
    if (!customer) {
      customer = await Customer.findById(actor.id);
    }
    if (!customer) {
      throw new AppError(403, 'Chỉ có tài khoản khách hàng mới được báo cáo vi phạm', 'AUTHORIZATION_ERROR');
    }

    if (!data.reason || !['SPAM', 'INAPPROPRIATE', 'HARASSMENT', 'MISINFORMATION', 'OTHER'].includes(data.reason)) {
      throw new AppError(400, 'Lý do báo cáo không hợp lệ (SPAM, INAPPROPRIATE, HARASSMENT, MISINFORMATION, OTHER)', 'VALIDATION_ERROR');
    }

    // Check duplicate report
    const existing = await CommunityReport.findOne({ postId: post._id, reporterCustomerId: customer._id });
    if (existing) {
      throw new AppError(409, 'Conflict', 'REPORT_ALREADY_SUBMITTED', 'Bạn đã gửi báo cáo cho bài viết này rồi');
    }

    const count = await CommunityReport.countDocuments();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const reportCode = `REP-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    const report = await CommunityReport.create({
      reportCode,
      postId: post._id,
      reporterCustomerId: customer._id,
      reason: data.reason,
      description: data.description || '',
      postSnapshot: {
        title: post.title,
        content: post.content,
        imageUrls: post.imageUrls || [],
        authorName: post.authorNameSnapshot,
        createdAt: post.createdAt,
      },
      status: 'PENDING',
    });

    // Increment post report count and set open report flag
    await CommunityPost.findByIdAndUpdate(post._id, {
      $inc: { reportCount: 1 },
      hasOpenReport: true,
    });

    return report;
  },

  async getCommunityReportsAdmin({ status, reason, search, page = 1, limit = 20 }) {
    const query = {};
    if (status) query.status = status;
    if (reason) query.reason = reason;
    if (search) {
      query.$or = [
        { reportCode: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit));
    const [total, items] = await Promise.all([
      CommunityReport.countDocuments(query),
      CommunityReport.find(query)
        .populate('postId', 'title status authorNameSnapshot')
        .populate('reporterCustomerId', 'fullName phone email')
        .populate('moderatorId', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      reports: items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  async getCommunityReportById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, 'ID báo cáo không hợp lệ', 'VALIDATION_ERROR');
    }
    const report = await CommunityReport.findById(id)
      .populate('postId')
      .populate('reporterCustomerId', 'fullName phone email')
      .populate('moderatorId', 'fullName email');
    if (!report) {
      throw new AppError(404, 'Không tìm thấy báo cáo vi phạm', 'NOT_FOUND');
    }
    return report;
  },

  async resolveCommunityReport(id, { decision, moderationNote }, moderator) {
    if (!['HIDE_POST', 'NO_VIOLATION'].includes(decision)) {
      throw new AppError(400, 'Quyết định xử lý phải là HIDE_POST hoặc NO_VIOLATION', 'VALIDATION_ERROR');
    }

    const report = await CommunityReport.findById(id);
    if (!report) {
      throw new AppError(404, 'Không tìm thấy báo cáo vi phạm', 'NOT_FOUND');
    }
    if (report.status === 'RESOLVED' || report.status === 'NO_VIOLATION') {
      throw new AppError(409, 'Conflict', 'REPORT_ALREADY_RESOLVED', 'Báo cáo vi phạm này đã được xử lý');
    }

    const newStatus = decision === 'HIDE_POST' ? 'RESOLVED' : 'NO_VIOLATION';
    report.status = newStatus;
    report.decision = decision;
    report.moderationNote = moderationNote || null;
    report.moderatorId = moderator.id;
    report.reviewedAt = new Date();
    report.version = (report.version || 0) + 1;
    await report.save();

    // If HIDE_POST, atomically hide the post
    if (decision === 'HIDE_POST') {
      await CommunityPost.findByIdAndUpdate(report.postId, {
        status: 'HIDDEN',
        moderatedBy: moderator.id,
        moderatedAt: new Date(),
        hasOpenReport: false,
        $push: {
          moderationHistory: {
            status: 'HIDDEN',
            reason: `Ẩn do báo cáo vi phạm: ${report.reportCode} - ${moderationNote || report.reason}`,
            actorId: moderator.id,
            at: new Date(),
          },
        },
      });
    }

    // Auto synchronize all other open reports for the same postId
    await CommunityReport.updateMany(
      {
        postId: report.postId,
        _id: { $ne: report._id },
        status: { $in: ['PENDING', 'UNDER_REVIEW'] },
      },
      {
        status: newStatus,
        decision,
        moderationNote: `Đồng bộ theo xử lý của báo cáo ${report.reportCode}`,
        moderatorId: moderator.id,
        reviewedAt: new Date(),
        resolvedByReportId: report._id,
      }
    );

    // If all reports resolved, clear hasOpenReport
    await CommunityPost.findByIdAndUpdate(report.postId, { hasOpenReport: false });

    return report;
  },

  // =========================================================================
  // 3. RESCUE PETS & ADOPTION
  // =========================================================================

  async createRescuePet(data) {
    const {
      petName,
      species,
      breed,
      gender,
      ageDescription,
      healthStatus,
      rescueStory,
      images,
      branchId,
      supportNeeds,
      supportPartnerId,
      supportPartnerName,
      ownershipType,
    } = data;

    if (!petName || !species || !healthStatus || !rescueStory) {
      throw new AppError(400, 'Thiếu thông tin bắt buộc của thú cưng cứu hộ (petName, species, healthStatus, rescueStory)', 'VALIDATION_ERROR');
    }

    // Auto generate petCode RES-XXXX
    const count = await RescuePet.countDocuments();
    const petCode = `RES-${String(count + 1).padStart(4, '0')}`;

    const rescuePet = await RescuePet.create({
      petCode,
      petName,
      species,
      breed: breed || 'Chưa xác định',
      gender: gender || 'UNKNOWN',
      ageDescription: ageDescription || null,
      healthStatus,
      rescueStory,
      supportNeeds: supportNeeds || null,
      supportPartnerId: supportPartnerId || null,
      supportPartnerName: supportPartnerName || null,
      ownershipType: ownershipType || 'PARTNER_MAINTAINED',
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
        .populate('branchId', 'name address hotline')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
    ]);

    return {
      items,
      pets: items,
      total,
      totalRows: total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  async getRescuePetById(id) {
    const query = {
      $or: [
        { petCode: id.toUpperCase() },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: id }] : []),
      ],
    };
    const pet = await RescuePet.findOne(query).populate('branchId', 'name address hotline');
    if (!pet) {
      throw new AppError(404, 'Không tìm thấy hồ sơ thú cưng cứu hộ', 'NOT_FOUND');
    }
    return pet;
  },

  async updateRescuePet(id, data) {
    const pet = await this.getRescuePetById(id);
    const updatable = [
      'petName', 'species', 'breed', 'gender', 'ageDescription', 'healthStatus',
      'rescueStory', 'images', 'branchId', 'supportNeeds', 'supportPartnerId',
      'supportPartnerName', 'ownershipType'
    ];
    updatable.forEach((field) => {
      if (data[field] !== undefined) {
        pet[field] = data[field];
      }
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

  async getRescuePetsPublic({ species, status, page = 1, limit = 50 }) {
    const query = {};
    if (status && status !== 'all') {
      const normalizedStatus = status.toUpperCase() === 'WAITING' ? 'LOOKING_FOR_HOME' : status.toUpperCase();
      query.status = normalizedStatus;
    }
    if (species && species !== 'all') {
      query.species = species.toUpperCase();
    }

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
      pets: items,
      total,
      totalRows: total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    };
  },

  // =========================================================================
  // 4. ADOPTION REQUESTS
  // =========================================================================

  async createAdoptionRequest(data, actor = null) {
    const rescuePetId = data.rescuePetId || data.adoption_pet_id || data.petId;
    const fullName = data.fullName || data.full_name;
    const phone = data.phone;
    const email = data.email || 'customer@example.com';
    const address = data.address;
    const housingType = data.housingType || data.housing_type || 'HOUSE';
    const hasPetExperience = data.hasPetExperience ?? data.has_pet_experience ?? true;
    const message = data.message || data.reason || '';

    if (!rescuePetId || !fullName || !phone || !email || !address) {
      throw new AppError(400, 'Vui lòng điền đầy đủ các thông tin cá nhân và bé muốn nhận nuôi', 'VALIDATION_ERROR');
    }

    const pet = mongoose.Types.ObjectId.isValid(rescuePetId)
      ? await RescuePet.findById(rescuePetId)
      : await RescuePet.findOne({ petCode: rescuePetId });
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

    // Nếu APPROVED, cập nhật bé sang ADOPTED
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
