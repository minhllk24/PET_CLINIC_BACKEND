import mongoose from 'mongoose';

const priceVariantSchema = new mongoose.Schema({
  tier: { type: String, trim: true, default: null },
  label: { type: String, required: true },
  mode: { type: String, enum: ['FIXED', 'QUOTE'], default: 'FIXED' },
  minWeightKg: { type: Number },
  maxWeightKg: { type: Number },
  price: {
    type: Number,
    required: function() { return this.mode === 'FIXED'; },
    min: 0,
    default: null
  }
}, { _id: false });

const defaultMaterialSchema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
  defaultQuantity: { type: Number, default: 1, min: 0 },
  unit: { type: String }
}, { _id: false });

const contactInfoSchema = new mongoose.Schema({
  hotline: { type: String, trim: true },
  instruction: { type: String, trim: true }
}, { _id: false });

const schema = new mongoose.Schema({
  code: { type: String, unique: true, sparse: true, index: true },
  name: { type: String, required: true, trim: true },
  serviceType: {
    type: String,
    enum: ['GROOMING', 'MEDICAL'],
    required: true,
    index: true
  },
  category: { type: String, trim: true, index: true },
  description: { type: String, trim: true },
  basePrice: { type: Number, required: true, min: 0 },
  priceVariants: { type: [priceVariantSchema], default: [] },
  durationMinutes: { type: Number, required: true, min: 1 },
  requiredStaffRole: {
    type: String,
    enum: ['CARE_STAFF_GROOMER', 'NURSE', 'VETERINARIAN'],
    required: true,
    index: true
  },
  bookingMode: {
    type: String,
    enum: ['BOOKABLE', 'REQUEST_ONLY', 'CONTACT_ONLY'],
    required: true,
    index: true
  },
  defaultMaterials: { type: [defaultMaterialSchema], default: [] },
  contactInfo: { type: contactInfoSchema, default: null },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
    index: true
  },
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

// Compound indexes per 06-mongodb-index-workload-v7.md (Q22)
schema.index({ status: 1, bookingMode: 1 });
schema.index({ status: 1, serviceType: 1 });
schema.index({ requiredStaffRole: 1, status: 1 });

// Guardrail check: Validate staff role against service type
schema.pre('validate', function(next) {
  if (this.serviceType === 'GROOMING' && this.requiredStaffRole !== 'CARE_STAFF_GROOMER') {
    this.invalidate('requiredStaffRole', 'GROOMING service requires CARE_STAFF_GROOMER');
  }
  if (this.serviceType === 'MEDICAL' && !['NURSE', 'VETERINARIAN'].includes(this.requiredStaffRole)) {
    this.invalidate('requiredStaffRole', 'MEDICAL service requires NURSE or VETERINARIAN');
  }
  next();
});

export default mongoose.models.Service || mongoose.model('Service', schema);