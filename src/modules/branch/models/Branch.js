import mongoose from 'mongoose';

const openingHourSchema = new mongoose.Schema({
  dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
  open: { type: String, required: true },
  close: { type: String, required: true }
}, { _id: false });

const holidaySchema = new mongoose.Schema({
  date: { type: String, required: true }, // Format YYYY-MM-DD
  note: { type: String }
}, { _id: false });

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  phone: { type: String, trim: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  openingHours: { type: [openingHourSchema], default: [] },
  holidays: { type: [holidaySchema], default: [] },
  version: { type: Number, default: 1 }
}, {
  timestamps: true,
  optimisticConcurrency: true,
  versionKey: 'version'
});

export default mongoose.models.Branch || mongoose.model('Branch', schema);