import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, min: 0, max: 100, default: 0 },
  finalPrice: { type: Number, min: 0, default: 0 },
  image: { type: String, default: null },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  deactivatedAt: { type: Date, default: null },
}, { _id: true });

const imageItemSchema = new mongoose.Schema({
  id: { type: String },
  url: { type: String, required: true },
  isPrimary: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { _id: false });

const schema = new mongoose.Schema({
  productCode: { type: String, unique: true, sparse: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  productType: { type: String, enum: ['SIMPLE', 'VARIANT'], default: 'SIMPLE' },
  usageType: { type: String, enum: ['SALE', 'SHARED', 'SERVICE_SUPPLY'], default: 'SALE', index: true },
  origin: { type: String, default: null },
  expiryInfo: { type: String, default: null },
  images: {
    type: [imageItemSchema],
    default: [],
    set: (imgs) => {
      if (!Array.isArray(imgs)) return [];
      const explicitPrimaryIdx = imgs.findIndex(
        (img) => typeof img === 'object' && img !== null && Boolean(img.isPrimary)
      );
      const chosenPrimaryIdx = explicitPrimaryIdx !== -1 ? explicitPrimaryIdx : 0;

      return imgs.map((img, idx) => {
        const isPrimary = idx === chosenPrimaryIdx;
        if (typeof img === 'string') {
          return { id: `img-${idx + 1}`, url: img, isPrimary, sortOrder: idx };
        }
        return {
          id: img.id || `img-${idx + 1}`,
          url: img.url,
          isPrimary,
          sortOrder: typeof img.sortOrder === 'number' ? img.sortOrder : idx,
        };
      });
    },
  },
  variants: {
    type: [variantSchema],
    validate: [v => Array.isArray(v) && v.length > 0, 'Product must have at least one variant'],
  },
  nextSkuSeq: { type: Number, default: 1 },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true },
  archivedAt: { type: Date, default: null },
}, { timestamps: true });

// Full text search on name, description, and productCode
schema.index({ name: 'text', description: 'text', productCode: 'text' });
// Compound index for catalog browsing and sorting
schema.index({ status: 1, categoryId: 1, createdAt: -1 });
schema.index({ status: 1, usageType: 1 });
schema.index({ 'variants.sku': 1 });

export default mongoose.models.Product || mongoose.model('Product', schema);