import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
  reminderType: { type: String, default: 'other' },
  title: { type: String, required: true },
  remindDate: { type: Date, required: true },
  remindBeforeDays: { type: Number, default: 0 },
  repeatType: { type: String, enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'], default: 'none' },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

schema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.reminder_id = ret._id.toString();
    ret.pet_id = ret.petId?.toString();
    ret.reminder_type = ret.reminderType;
    ret.remind_date = ret.remindDate;
    ret.remind_before_days = ret.remindBeforeDays;
    ret.repeat_type = ret.repeatType;
    return ret;
  }
});

export default mongoose.models.Reminder || mongoose.model('Reminder', schema);
