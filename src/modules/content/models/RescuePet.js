import mongoose from 'mongoose';

const rescuePetSchema = new mongoose.Schema({
  petCode: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
  petName: { type: String, required: true, trim: true },
  species: { type: String, enum: ['DOG', 'CAT', 'OTHER'], required: true, index: true },
  breed: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['MALE', 'FEMALE', 'UNKNOWN'], default: 'UNKNOWN' },
  ageDescription: { type: String, required: true, trim: true }, // ví dụ: "4 tháng tuổi", "1.5 tuổi"
  healthStatus: { type: String, required: true, trim: true }, // ví dụ: "Đã triệt sản, tiêm phòng 2 mũi"
  rescueStory: { type: String, required: true },
  images: [{ type: String, required: true }],
  status: {
    type: String,
    enum: ['LOOKING_FOR_HOME', 'ADOPTED'],
    default: 'LOOKING_FOR_HOME',
    index: true,
  },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  adoptedByCustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  adoptedAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'rescue_pets',
});

rescuePetSchema.index({ status: 1, species: 1, createdAt: -1 });

const RescuePet = mongoose.models.RescuePet || mongoose.model('RescuePet', rescuePetSchema);
export default RescuePet;
