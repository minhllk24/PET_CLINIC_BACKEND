const fs = require('fs');
const path = require('path');

const modules = {
  identity: ['User', 'OtpChallenge', 'RefreshSession'],
  customer: ['Customer', 'GuestContact', 'Pet'],
  branch: ['Branch', 'BranchServiceConfig'],
  staff: ['StaffProfile', 'Shift'],
  catalog: ['Category', 'Product', 'Service'],
  order: ['Cart', 'Order', 'OrderReturn', 'OrderRefund', 'Voucher', 'VoucherUsage'],
  booking: ['Appointment', 'SlotReservation', 'AppointmentRequest'],
  execution: ['ServiceRecord', 'ServiceRecordRevision'],
  inventory: ['InventoryItem', 'InventoryStock', 'InventoryTransaction'],
  payment: ['Payment', 'BookingRefund'],
  settings: ['SystemSetting'],
  notification: ['Notification', 'Outbox'],
  audit: ['AuditLog', 'IdempotencyKey'],
  review: ['Review']
};

const schemas = {
  User: `
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  systemRole: { type: String, required: true, enum: ['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'] },
  fullName: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  passwordHash: { type: String },
  accountStatus: { type: String, enum: ['ACTIVE', 'BLOCKED'], default: 'ACTIVE' },
  blockedReason: String,
  blockedAt: Date,
  blockedBy: mongoose.Schema.Types.ObjectId,
  failedLoginCount: { type: Number, default: 0 },
  lockedUntil: Date,
  lastLogin: Date,
  assignedBranchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('User', schema);
`,
  Customer: `
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  activationStatus: { type: String, enum: ['NO_ACCOUNT', 'PENDING_ACTIVATION', 'ACTIVATED'], default: 'NO_ACCOUNT' },
  contactPhone: String,
  contactEmail: String,
  phoneVerifiedAt: Date,
  emailVerifiedAt: Date,
  activityBranchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }]
}, { timestamps: true });

export default mongoose.model('Customer', schema);
`,
  Category: `
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });

export default mongoose.model('Category', schema);
`,
  Product: `
import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }
});

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  origin: String,
  expiryInfo: String,
  images: [String],
  variants: [variantSchema],
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' }
}, { timestamps: true });

export default mongoose.model('Product', schema);
`,
  Cart: `
import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1 }
});

const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', unique: true, sparse: true },
  tokenHash: { type: String, unique: true, sparse: true },
  items: [itemSchema],
  expiresAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('Cart', schema);
`,
  Order: `
import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  orderItemId: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  variantId: mongoose.Schema.Types.ObjectId,
  nameSnapshot: String,
  unitPrice: Number,
  quantity: Number,
  lineSubtotal: Number,
  allocatedDiscount: Number,
  lineNet: Number,
  returnReservedQty: { type: Number, default: 0 },
  returnedQty: { type: Number, default: 0 },
  refundedNet: { type: Number, default: 0 }
});

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  guestContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestContact' },
  contactSnapshot: Object,
  shippingAddress: Object,
  fulfillmentBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  status: { type: String, enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'] },
  paymentMethod: { type: String, enum: ['ONLINE_MOCK', 'COD'] },
  payment: {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    status: String
  },
  items: [orderItemSchema],
  pricing: {
    merchandiseSubtotal: Number,
    voucherDiscount: Number,
    shippingFee: Number,
    totalAmount: Number
  },
  voucher: {
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher' },
    code: String
  },
  deliveredAt: Date,
  statusHistory: [{
    status: String,
    at: Date,
    actorId: mongoose.Schema.Types.ObjectId,
    note: String
  }],
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('Order', schema);
`,
  Service: `
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
`,
  Appointment: `
import mongoose from 'mongoose';

const serviceSegmentSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  serviceName: String,
  serviceType: String,
  variantLabel: String,
  unitPrice: Number,
  durationMinutes: Number,
  requiredStaffRole: String,
  bookingMode: String,
  depositConfig: Object,
  sequence: Number,
  scheduledStart: Date,
  scheduledEnd: Date,
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: 'StaffProfile' },
  executionStatus: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'], required: true, default: 'NOT_STARTED' },
  executionStartedAt: Date,
  executionCompletedAt: Date
});

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  guestContactId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestContact' },
  petId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet' },
  petSnapshot: Object,
  customerSnapshot: Object,
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  serviceType: { type: String, enum: ['GROOMING', 'MEDICAL', 'MIXED_SERVICE_TYPES'] },
  paymentMethod: { type: String, enum: ['ONLINE_MOCK', 'PAY_AT_STORE'] },
  services: [serviceSegmentSchema],
  scheduledStart: Date,
  scheduledEnd: Date,
  scheduledDurationMinutes: Number,
  pricing: {
    subtotal: Number,
    voucherId: mongoose.Schema.Types.ObjectId,
    voucherDiscount: Number,
    finalAmount: Number,
    depositAmount: Number,
    balanceAmount: Number,
    paidAmount: { type: Number, default: 0 }
  },
  deposit: {
    status: String,
    paymentId: mongoose.Schema.Types.ObjectId
  },
  status: { type: String, enum: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'COMPLETED'] },
  rescheduleCount: { type: Number, default: 0 },
  cancel: {
    by: String,
    at: Date,
    actorId: mongoose.Schema.Types.ObjectId,
    reason: String,
    hoursBeforeStart: Number,
    prepaidOutcome: String
  },
  holdExpiresAt: Date,
  source: String,
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('Appointment', schema);
`,
  Payment: `
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  code: { type: String, unique: true },
  target: {
    type: { type: String, enum: ['APPOINTMENT', 'ORDER'] },
    id: mongoose.Schema.Types.ObjectId
  },
  kind: { type: String, enum: ['DEPOSIT', 'BALANCE', 'FULL', 'ORDER'] },
  method: { type: String, enum: ['ONLINE_MOCK', 'PAY_AT_STORE', 'COD'] },
  expiresAt: Date,
  amount: Number,
  refundedAmount: { type: Number, default: 0 },
  provider: { type: String, default: 'MOCK' },
  providerRef: String,
  status: { type: String, enum: ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED'] },
  paidAt: Date,
  idempotencyKey: String,
  version: { type: Number, default: 1 }
}, { timestamps: true, optimisticConcurrency: true, versionKey: 'version' });

export default mongoose.model('Payment', schema);
`,
  InventoryTransaction: `
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
  transactionType: { type: String, enum: ['RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER'] },
  beforeQty: Number,
  changeQty: Number,
  afterQty: Number,
  actorId: mongoose.Schema.Types.ObjectId,
  reason: String,
  sourceType: { type: String, enum: ['MANUAL', 'SERVICE_RECORD_REVISION', 'ORDER', 'TRANSFER'] },
  sourceId: mongoose.Schema.Types.ObjectId,
  recordVersion: Number,
  transferId: mongoose.Schema.Types.ObjectId,
  transferLeg: String,
  idempotencyKey: String
}, { timestamps: true });

export default mongoose.model('InventoryTransaction', schema);
`
};

const defaultSchema = (name) => `
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  // TODO: Implement fields for ${name} as per 05-mongodb-schema-v6.md
}, { timestamps: true });

export default mongoose.model('${name}', schema);
`;

const rootSrc = path.join(__dirname, 'src', 'modules');

if (!fs.existsSync(rootSrc)) {
  fs.mkdirSync(rootSrc, { recursive: true });
}

Object.keys(modules).forEach(mod => {
  const modPath = path.join(rootSrc, mod, 'models');
  if (!fs.existsSync(modPath)) {
    fs.mkdirSync(modPath, { recursive: true });
  }

  modules[mod].forEach(modelName => {
    const filePath = path.join(modPath, modelName + '.js');
    const content = schemas[modelName] || defaultSchema(modelName);
    fs.writeFileSync(filePath, content.trim() + '\\n');
    console.log('Created ' + filePath);
  });
});

console.log('All schemas generated successfully!');
