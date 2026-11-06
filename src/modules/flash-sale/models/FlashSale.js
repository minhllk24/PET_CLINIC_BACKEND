import mongoose from 'mongoose';

const flashSaleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    productName: {
      type: String,
      trim: true,
    },
    variantLabel: {
      type: String,
      trim: true,
      default: null,
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    salePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true }
);

const flashSaleSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
      index: true,
    },
    activationMode: {
      type: String,
      enum: ['AUTO', 'MANUAL'],
      default: 'AUTO',
    },
    isPaused: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED'],
      default: 'DRAFT',
      index: true,
    },
    items: [flashSaleItemSchema],
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    versionKey: 'version',
  }
);

flashSaleSchema.index({ status: 1, isPaused: 1, startAt: 1, endAt: 1 });

export default mongoose.models.FlashSale || mongoose.model('FlashSale', flashSaleSchema);

