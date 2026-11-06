import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorName: { type: String, required: true, trim: true },
  authorRole: { type: String, default: 'STAFF' },
  content: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const communityCommentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
  authorCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  authorNameSnapshot: { type: String, required: true, trim: true },
  authorAvatarSnapshot: { type: String, default: null },
  content: { type: String, required: true, trim: true },
  replies: [replySchema],
  likesCount: { type: Number, default: 0, min: 0 },
}, {
  timestamps: true,
  collection: 'community_comments',
});

communityCommentSchema.index({ postId: 1, createdAt: -1 });

const CommunityComment = mongoose.models.CommunityComment || mongoose.model('CommunityComment', communityCommentSchema);
export default CommunityComment;

