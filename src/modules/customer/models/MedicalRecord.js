import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
  recordName: { type: String, trim: true, default: 'Khám tổng quát' },
  condition: { type: String, trim: true, default: 'Khám tổng quát' },
  doctorName: { type: String, trim: true, default: 'Bác sĩ phụ trách' },
  doctor: { type: String, trim: true, default: 'Bác sĩ phụ trách' },
  visitDate: { type: Date, default: Date.now },
  symptoms: { type: String, trim: true, default: '' },
  diagnosis: { type: String, trim: true, default: '' },
  treatmentNote: { type: String, trim: true, default: '' },
  notes: { type: String, trim: true, default: '' },
  fileUrl: { type: String, trim: true, default: '' },
  fileName: { type: String, trim: true, default: '' },
  attachments: [{
    fileName: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
  }],
  sourceType: { type: String, enum: ['doctor_created', 'user_uploaded'], default: 'user_uploaded' },
  createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.record_id = ret._id.toString();
    ret.record_name = ret.recordName;
    ret.doctor_name = ret.doctorName;
    ret.visit_date = ret.visitDate;
    ret.file_url = ret.fileUrl;
    ret.file_name = ret.fileName;
    ret.treatment_note = ret.treatmentNote;
    return ret;
  }
});

export default mongoose.models.MedicalRecord || mongoose.model('MedicalRecord', schema);
