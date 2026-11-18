import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  name: { type: String, required: true, trim: true },
  species: { type: String, enum: ['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'], required: true },
  breed: { type: String, trim: true, default: '' },
  gender: { type: String, enum: ['MALE', 'FEMALE', 'UNKNOWN'], default: 'UNKNOWN' },
  ageYears: { type: Number, default: 0, min: [0, 'ageYears cannot be negative'] },
  weightKg: {
    type: Number,
    default: null,
    validate: {
      validator: (v) => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v) && v > 0),
      message: 'weightKg must be greater than 0',
    },
  },
  healthStatus: { type: String, default: 'NORMAL' },
  medicalNotes: { type: String, default: '' },
  photoUrl: { type: String, default: null },
  doctorName: { type: String, trim: true, default: '' },
  medicalRecordFileUrl: { type: String, trim: true, default: null },
  medicalRecords: [{
    recordName: { type: String, trim: true, default: '' },
    condition: { type: String, trim: true, default: '' },
    doctorName: { type: String, trim: true, default: '' },
    doctor: { type: String, trim: true, default: '' },
    fileUrl: { type: String, trim: true, default: '' },
    fileName: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    treatmentNote: { type: String, trim: true, default: '' },
    examinationDate: { type: Date, default: null },
    visitDate: { type: Date, default: null },
    attachments: [{
      fileName: { type: String, default: '' },
      fileUrl: { type: String, default: '' },
      fileType: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
    }],
    createdAt: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ['ACTIVE', 'HIDDEN'], default: 'ACTIVE', index: true },
  isArchived: { type: Boolean, default: false }
}, { timestamps: true });

schema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.pet_id = ret._id.toString();
    ret.isHidden = ret.status === 'HIDDEN' || ret.isArchived === true;
    ret.is_hidden = ret.isHidden;
    return ret;
  }
});

export default mongoose.models.Pet || mongoose.model('Pet', schema);