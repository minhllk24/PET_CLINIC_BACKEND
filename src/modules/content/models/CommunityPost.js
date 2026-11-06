import mongoose from 'mongoose';

const communityPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true },
  type: {
    type: String,
    enum: ['KHOANH_KHAC', 'HOI_DAP', 'MEO_VAT', 'KINH_NGHIEM'],
    default: 'KHOANH_KHAC',
    index: true,
  },
  typeLabel: { type: String, default: 'Khoảnh khắc' },
  imageUrls: [{ type: String, trim: true }],
  authorCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  authorNameSnapshot: { type: String, required: true, trim: true },
  authorAvatarSnapshot: { type: String, default: null },
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN'],
    default: 'PENDING',
    index: true,
  },
  rejectionReason: { type: String, default: null, trim: true },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatedAt: { type: Date, default: null },
  moderationHistory: [{
    status: { type: String, required: true },
    reason: { type: String, default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    at: { type: Date, default: Date.now },
  }],
  reportCount: { type: Number, default: 0, min: 0 },
  hasOpenReport: { type: Boolean, default: false },
  likesCount: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'community_posts',
});

communityPostSchema.index({ status: 1, createdAt: -1 });

const CommunityPost = mongoose.models.CommunityPost || mongoose.model('CommunityPost', communityPostSchema);
export default CommunityPost;
