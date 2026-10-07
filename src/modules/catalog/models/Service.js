import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  code: { type: String, unique: true },
  name: { type: String, required: true },
  description: String,
  serviceType: { type: String, enum: ['GROOMING', 'MEDICAL'] },
  category: String,
  basePrice: Number,
  priceVariants: [Object],
  durationMinutes: Number,
  requiredStaffRole: { type: String, enum: ['CARE_STAFF_GROOMER', 'NURSE', 'VETERINARIAN'] },
  bookingMode: String,
  depositConfig: {
    depositRequired: Boolean,
    depositType: { type: String, enum: ['PERCENTAGE', 'NONE'] },
    depositValue: Number
  },
  defaultMaterials: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
  contactInfo: Object,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('Service', schema);