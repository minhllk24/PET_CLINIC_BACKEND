import mongoose from 'mongoose';

const communityReportSchema = new mongoose.Schema({
  reportCode: { type: String, required: true, unique: true, index: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityPost', required: true, index: true },
  reporterCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  reason: {
    type: String,
    enum: ['SPAM', 'INAPPROPRIATE', 'HARASSMENT', 'MISINFORMATION', 'OTHER'],
    required: true,
  },
  description: { type: String, default: '', trim: true },
  postSnapshot: {
    title: { type: String, default: null },
    content: { type: String, default: null },
    imageUrls: [{ type: String }],
    authorName: { type: String, default: null },
    createdAt: { type: Date, default: null },
  },
  status: {
    type: String,
    enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'NO_VIOLATION'],
    default: 'PENDING',
    index: true,
  },
  decision: {
    type: String,
    enum: ['HIDE_POST', 'NO_VIOLATION', null],
    default: null,
  },
  moderationNote: { type: String, default: null, trim: true },
  moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  resolvedByReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityReport', default: null },
  version: { type: Number, default: 0 },
}, {
  timestamps: true,
  collection: 'community_reports',
});

communityReportSchema.index({ postId: 1, reporterCustomerId: 1 }, { unique: true });
communityReportSchema.index({ status: 1, createdAt: -1 });

const CommunityReport = mongoose.models.CommunityReport || mongoose.model('CommunityReport', communityReportSchema);
export default CommunityReport;

