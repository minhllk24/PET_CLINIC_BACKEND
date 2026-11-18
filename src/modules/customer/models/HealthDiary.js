import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
  entryDate: { type: Date, default: Date.now },
  entryTime: { type: String, default: null },
  iconCode: { type: String, default: 'paw' },
  colorCode: { type: String, default: 'blue' },
  title: { type: String, default: 'Ghi chú' },
  content: { type: String, default: '' },
  attachments: [{
    fileName: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    fileType: { type: String, default: '' },
  }],
  createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.diary_id = ret._id.toString();
    ret.pet_id = ret.petId?.toString();
    ret.entry_date = ret.entryDate;
    ret.entry_time = ret.entryTime;
    ret.icon_code = ret.iconCode;
    ret.color_code = ret.colorCode;
    return ret;
  }
});

export default mongoose.models.HealthDiary || mongoose.model('HealthDiary', schema);
