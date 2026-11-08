import mongoose from 'mongoose';

const carePlanTaskStateSchema = new mongoose.Schema(
  {
    petId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      index: true,
    },
    taskKey: {
      type: String,
      required: true,
      trim: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    snoozedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

carePlanTaskStateSchema.index({ petId: 1, taskKey: 1 }, { unique: true });

export default mongoose.models.CarePlanTaskState ||
  mongoose.model('CarePlanTaskState', carePlanTaskStateSchema);

