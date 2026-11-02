import mongoose from 'mongoose';

const stepSchema = new mongoose.Schema({
  stepNumber: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  instruction: { type: String, required: true, trim: true },
  mediaUrl: { type: String, default: null },
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
  emergencyPhone: { type: String, default: '1900-PET-HELP' },
  steps: [stepSchema],
  publishedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'posts',
});

postSchema.index({ postType: 1, status: 1, createdAt: -1 });

const Post = mongoose.models.Post || mongoose.model('Post', postSchema);
export default Post;
