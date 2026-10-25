import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import config from '../../src/shared/config';

// Fixed ObjectIds for consistent cross-test assertions
export const branch1Id = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001'); // BR-000001 (Q1)
export const branch2Id = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000002'); // BR-000002 (Q3)
export const branch3Id = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000003'); // BR-000003 (Bình Thạnh)

export const catFoodId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000011');
export const catHygieneId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000012');
export const catHousingId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000013');
export const catHealthId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000014');

export const prodDogId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000021');
export const varDogId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000022');
export const invDogId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000023');

export const prodCatId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000031');
export const varCatId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000032');
export const invCatId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000033');

export const prodSmallId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000041');
export const varSmallId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000042');
export const invSmallId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000043');

export const prodBirdId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000051');
export const varBirdId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000052');
export const invBirdId = new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000053');

export const adminId = '507f1f77bcf86cd799439001';
export const managerId = '507f1f77bcf86cd799439002';
export const customerId = '507f1f77bcf86cd799439003';
export const receptionistId = '507f1f77bcf86cd799439004';

export const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branch1Id], authorizedBranchIds: [branch1Id] },
  config.jwt.accessSecret
);

export const managerToken = jwt.sign(
  { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branch1Id], authorizedBranchIds: [branch1Id] },
  config.jwt.accessSecret
);

export const receptionistToken = jwt.sign(
  { id: receptionistId, systemRole: 'STAFF', staffSubRole: 'RECEPTIONIST', assignedBranchIds: [branch1Id], authorizedBranchIds: [branch1Id] },
  config.jwt.accessSecret
);

export const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

export const guestCartToken = 'guest-cart-token-e2e-2026';
export const guestLookupToken = 'guest-lookup-token-e2e-2026';

// 1. Categories Fixtures (4 Functional Categories)
export const categoriesFixture = [
  {
    _id: catFoodId,
    code: 'CAT-FOOD-001',
    name: 'Thức ăn & Dinh dưỡng',
    slug: 'thuc-an-va-dinh-duong',
    description: 'Thức ăn hạt, pate lon, cỏ nén và khoáng chất dinh dưỡng đa loài',
    status: 'ACTIVE'
  },
  {
    _id: catHygieneId,
    code: 'CAT-HYGIENE-001',
    name: 'Vệ sinh & Chăm sóc',
    slug: 've-sinh-va-cham-soc',
    description: 'Cát vệ sinh mèo, tã lót cún, lót chuồng gỗ nén và sữa tắm chuyên dụng',
    status: 'ACTIVE'
  },
  {
    _id: catHousingId,
    code: 'CAT-HOUSING-001',
    name: 'Phụ kiện & Chuồng trại',
    slug: 'phu-kien-va-chuong-trai',
    description: 'Chuồng lồng thú nhỏ/chim cảnh, bát ăn tự động, balo vận chuyển',
    status: 'ACTIVE'
  },
  {
    _id: catHealthId,
    code: 'CAT-HEALTH-001',
    name: 'Y tế & Thực phẩm chức năng',
    slug: 'y-te-va-thuc-pham-chuc-nang',
    description: 'Gel dinh dưỡng đa loài, vitamin, bổ sung lông và men vi sinh',
    status: 'ACTIVE'
  }
];

// 2. Products Fixtures (4 Diverse Species)
// Each Product variant demonstrates Two-Tier Pricing: price (original) -> discountPercent -> finalPrice
export const productsFixture = [
  // Species 1: Dog (10% Product discount)
  {
    _id: prodDogId,
    productCode: 'SP-000101',
    name: 'Hạt hữu cơ cún con cỡ hạt nhỏ Royal Canin Mini Puppy',
    categoryId: catFoodId,
    productType: 'SIMPLE',
    usageType: 'SALE',
    status: 'ACTIVE',
    variants: [
      {
        _id: varDogId,
        sku: 'SP-000101-001',
        label: 'Túi 1.5kg',
        price: 150000, // Price Tier 1 base
        discountPercent: 10, // 10% product discount
        finalPrice: 135000, // Price Tier 1 final (150,000 * 0.9)
        inventoryItemId: invDogId,
        status: 'ACTIVE'
      }
    ]
  },
  // Species 2: Cat (0% Product discount)
  {
    _id: prodCatId,
    productCode: 'SP-000102',
    name: 'Pate cá ngừ đại dương cao cấp cho mèo trưởng thành Ciao Cat Can',
    categoryId: catFoodId,
    productType: 'SIMPLE',
    usageType: 'SALE',
    status: 'ACTIVE',
    variants: [
      {
        _id: varCatId,
        sku: 'SP-000102-001',
        label: 'Lon 85g',
        price: 80000,
        discountPercent: 0,
        finalPrice: 80000,
        inventoryItemId: invCatId,
        status: 'ACTIVE'
      }
    ]
  },
  // Species 3: Small Animals - Hamster/Thỏ/Bọ (25% Product discount)
  {
    _id: prodSmallId,
    productCode: 'SP-000103',
    name: 'Cỏ nén hữu cơ Timothy và cỏ linh lăng cho thỏ và chuột Hamster Mini Pets',
    categoryId: catFoodId,
    productType: 'SIMPLE',
    usageType: 'SALE',
    status: 'ACTIVE',
    variants: [
      {
        _id: varSmallId,
        sku: 'SP-000103-001',
        label: 'Túi 1kg',
        price: 120000,
        discountPercent: 25, // 25% product discount
        finalPrice: 90000, // (120,000 * 0.75)
        inventoryItemId: invSmallId,
        status: 'ACTIVE'
      }
    ]
  },
  // Species 4: Birds (0% Product discount)
  {
    _id: prodBirdId,
    productCode: 'SP-000104',
    name: 'Hạt kê và khoáng chất tự nhiên bổ sung dinh dưỡng cho chim cảnh và vẹt hót Pet Bird Master',
    categoryId: catFoodId,
    productType: 'SIMPLE',
    usageType: 'SALE',
    status: 'ACTIVE',
    variants: [
      {
        _id: varBirdId,
        sku: 'SP-000104-001',
        label: 'Hộp 500g',
        price: 100000,
        discountPercent: 0,
        finalPrice: 100000,
        inventoryItemId: invBirdId,
        status: 'ACTIVE'
      }
    ]
  }
];

// 3. Branches Fixtures (3 Standardized Branches)
export const branchesFixture = [
  {
    _id: branch1Id,
    code: 'BR-000001',
    name: 'Chi nhánh Quận 1',
    address: '123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM',
    phone: '02839123456',
    status: 'ACTIVE'
  },
  {
    _id: branch2Id,
    code: 'BR-000002',
    name: 'Chi nhánh Quận 3',
    address: '456 Lê Văn Sỹ, Phường 14, Quận 3, TP.HCM',
    phone: '02839123457',
    status: 'ACTIVE'
  },
  {
    _id: branch3Id,
    code: 'BR-000003',
    name: 'Chi nhánh Bình Thạnh',
    address: '789 Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP.HCM',
    phone: '02839123458',
    status: 'ACTIVE'
  }
];

// 4. System Settings (Fulfillment Priority: Q1 -> Q3 -> Bình Thạnh)
export const commerceSettingFixture = {
  key: 'commerce',
  value: {
    fulfillmentBranchPriority: [branch1Id, branch2Id, branch3Id],
    freeShippingThreshold: 500000,
    standardShippingFee: 30000
  }
};

// 5. Vouchers Fixtures (Tier 2 Discount Options)
export const vouchersFixture = {
  // Voucher A: 10% capped at 50,000 VND
  pctCapped: {
    _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000061'),
    code: 'GIAM10_CAP50',
    type: 'DISCOUNT',
    discountType: 'PERCENT',
    discountValue: 10,
    maxDiscountAmount: 50000,
    minOrderAmount: 0,
    scope: 'ORDER',
    status: 'ACTIVE',
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() + 86400000 * 30),
    usageLimitPerCustomer: 5,
    totalUsageLimit: 100,
    currentUsageCount: 0
  },
  // Voucher B: Fixed 40,000 VND discount for orders >= 150,000 VND
  fixed: {
    _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000062'),
    code: 'GIAM40K_DON150K',
    type: 'DISCOUNT',
    discountType: 'FIXED',
    discountValue: 40000,
    minOrderAmount: 150000,
    scope: 'ORDER',
    status: 'ACTIVE',
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() + 86400000 * 30),
    usageLimitPerCustomer: 5,
    totalUsageLimit: 100,
    currentUsageCount: 0
  },
  // Voucher C: 20% discount scoped to Small Animals Product only
  scopedSmallAnimals: {
    _id: new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000063'),
    code: 'THUNHO20',
    type: 'DISCOUNT',
    discountType: 'PERCENT',
    discountValue: 20,
    maxDiscountAmount: 100000,
    minOrderAmount: 0,
    scope: 'PRODUCT',
    scopeRefs: [prodSmallId],
    status: 'ACTIVE',
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() + 86400000 * 30),
    usageLimitPerCustomer: 5,
    totalUsageLimit: 100,
    currentUsageCount: 0
  }
};
