import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema({
  stepNumber: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  instruction: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
  mediaUrl: { type: String, default: null },
  imageUrl: { type: String, default: null },
}, { _id: false });

const contentBlockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['PARAGRAPH', 'HEADING', 'IMAGE', 'QUOTE', 'LIST'],
    default: 'PARAGRAPH',
  },
  text: { type: String, default: null },
  html: { type: String, default: null },
  imageUrl: { type: String, default: null },
  caption: { type: String, default: null },
  alt: { type: String, default: null },
}, { _id: false });

const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true, trim: true },
  postType: {
    type: String,
    enum: ['OFFICIAL_BLOG', 'FIRST_AID'],
    required: true,
    index: true,
    default: 'OFFICIAL_BLOG',
  },
  category: { type: String, required: true, trim: true, index: true },
  excerpt: { type: String, trim: true, default: '' },
  content: { type: String, required: true },
  contentBlocks: [contentBlockSchema],
  layoutType: { type: String, enum: ['STANDARD', 'FEATURED'], default: 'STANDARD' },
  hashtags: [{ type: String, trim: true }],
  thumbnailUrl: { type: String, default: null },
  isFeatured: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
    default: 'DRAFT',
    index: true,
  },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  viewCount: { type: Number, default: 0 },
  likesCount: { type: Number, default: 0 },
  
  // Các trường chuyên dụng cho Cẩm nang Sơ cứu (First Aid)
  urgencyLevel: { type: String, enum: ['NORMAL', 'URGENT'], default: 'NORMAL' },
  heroTitle: { type: String, trim: true, default: null },
  stepBadges: [{ type: String, trim: true }],
  videoUrl: { type: String, default: null },
  videoTitle: { type: String, default: null },
  videoDescriptionHtml: { type: String, default: null },
  emergencyPhone: { type: String, default: '0901234567' },
  steps: [stepSchema],
  publishedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'posts',
});

postSchema.index({ postType: 1, status: 1, createdAt: -1 });

const Post = mongoose.models.Post || mongoose.model('Post', postSchema);
export default Post;
