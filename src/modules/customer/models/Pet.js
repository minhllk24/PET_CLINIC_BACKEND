import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  name: { type: String, required: true, trim: true },
  species: { type: String, enum: ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'], default: 'DOG' },
  breed: { type: String, trim: true, default: '' },
  gender: { type: String, enum: ['MALE', 'FEMALE', 'UNKNOWN'], default: 'UNKNOWN' },
  ageYears: { type: Number, default: 0 },
  weightKg: { type: Number, default: 0 },
  healthStatus: { type: String, default: 'NORMAL' },
  medicalNotes: { type: String, default: '' },
  photoUrl: { type: String, default: null },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.models.Pet || mongoose.model('Pet', schema);