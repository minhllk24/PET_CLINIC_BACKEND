import mongoose from 'mongoose';

const applicantInfoSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  address: { type: String, required: true, trim: true },
  housingType: { type: String, required: true, trim: true }, // "Nhà riêng", "Chung cư có cho phép thú cưng"
  hasPetExperience: { type: Boolean, default: false },
  message: { type: String, trim: true, default: '' },
}, { _id: false });

const adoptionRequestSchema = new mongoose.Schema({
  requestCode: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
  rescuePetId: { type: mongoose.Schema.Types.ObjectId, ref: 'RescuePet', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  applicantInfo: { type: applicantInfoSchema, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  reviewNote: { type: String, default: null, trim: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'adoption_requests',
});

adoptionRequestSchema.index({ status: 1, createdAt: -1 });

const AdoptionRequest = mongoose.models.AdoptionRequest || mongoose.model('AdoptionRequest', adoptionRequestSchema);
export default AdoptionRequest;
