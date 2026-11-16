import mongoose from 'mongoose';
import Branch from '../modules/branch/models/Branch';
import Service from '../modules/catalog/models/Service';
import BranchServiceConfig from '../modules/branch/models/BranchServiceConfig';
import ShiftTemplate from '../modules/branch/models/ShiftTemplate';
import InventoryItem from '../modules/inventory/models/InventoryItem';
import InventoryStock from '../modules/inventory/models/InventoryStock';
import config from '../shared/config';

export const seedServiceCatalog = async () => {
  console.log('[Seed] Starting Canonical Service Catalog Seed (19 Services, 28 Materials, Shift Templates)...');

  // 1. Seed 3 Canonical Branches
  const defaultOpeningHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    open: '08:00',
    close: '18:00',
  }));

  const branchesData = [
    {
      _id: new mongoose.Types.ObjectId('6ad08e4417bf41f5954234c3'),
      code: 'BR-000001',
      name: 'Chi nhánh Quận 1',
      address: '123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM',
      phone: '02812345678',
      status: 'ACTIVE',
      openingHours: defaultOpeningHours,
      holidays: [],
    },
    {
      _id: new mongoose.Types.ObjectId('6ad08e4417bf41f5954234c4'),
      code: 'BR-000002',
      name: 'Chi nhánh Quận 3',
      address: '456 Lê Văn Sỹ, Phường 14, Quận 3, TP.HCM',
      phone: '02887654321',
      status: 'ACTIVE',
      openingHours: defaultOpeningHours,
      holidays: [],
    },
    {
      _id: new mongoose.Types.ObjectId('6ad08e4417bf41f5954234c5'),
      code: 'BR-000003',
      name: 'Chi nhánh Bình Thạnh',
      address: '789 Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP.HCM',
      phone: '02899998888',
      status: 'ACTIVE',
      openingHours: defaultOpeningHours,
      holidays: [],
    },
  ];

  const branches = [];
  for (const bData of branchesData) {
    const { _id, ...updateFields } = bData;
    const branch = await Branch.findOneAndUpdate(
      { code: bData.code },
      { $set: updateFields, $setOnInsert: { _id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    branches.push(branch);
  }

  // 2. Seed 28 Canonical Materials (MAT001 - MAT028) per docs/catalog (2).xlsx
  const materialsData = [
    { sku: 'MAT001', name: 'Găng tay dùng 1 lần', unit: 'đôi', categoryName: 'PPE', serviceType: 'SHARED' },
    { sku: 'MAT002', name: 'Bông tẩy trang / Cotton pad', unit: 'miếng', categoryName: 'HYGIENE', serviceType: 'GROOMING' },
    { sku: 'MAT003', name: 'Gạc vô trùng', unit: 'miếng', categoryName: 'DRESSING', serviceType: 'SHARED' },
    { sku: 'MAT004', name: 'Dung dịch sát khuẩn', unit: 'ml', categoryName: 'ANTISEPTIC', serviceType: 'SHARED' },
    { sku: 'MAT005', name: 'Nước muối sinh lý 0.9%', unit: 'ml', categoryName: 'FLUID', serviceType: 'MEDICAL' },
    { sku: 'MAT006', name: 'Bơm tiêm / Syringe', unit: 'cái', categoryName: 'INJECTION', serviceType: 'MEDICAL' },
    { sku: 'MAT007', name: 'Kim tiêm / Needle', unit: 'cái', categoryName: 'INJECTION', serviceType: 'MEDICAL' },
    { sku: 'MAT008', name: 'Gạc cồn / Alcohol swab', unit: 'miếng', categoryName: 'INJECTION', serviceType: 'MEDICAL' },
    { sku: 'MAT009', name: 'Băng cuộn', unit: 'cuộn', categoryName: 'DRESSING', serviceType: 'MEDICAL' },
    { sku: 'MAT010', name: 'Chỉ khâu / Suture pack', unit: 'gói', categoryName: 'SURGICAL', serviceType: 'MEDICAL' },
    { sku: 'MAT011', name: 'Ống lấy mẫu máu', unit: 'ống', categoryName: 'DIAGNOSTIC', serviceType: 'MEDICAL' },
    { sku: 'MAT012', name: 'Gel siêu âm', unit: 'ml', categoryName: 'DIAGNOSTIC', serviceType: 'MEDICAL' },
    { sku: 'MAT013', name: 'Vaccine – demo', unit: 'liều', categoryName: 'VACCINE', serviceType: 'MEDICAL' },
    { sku: 'MAT014', name: 'Dầu gội Grooming / Shampoo', unit: 'ml', categoryName: 'GROOMING_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT015', name: 'Dầu xả / Conditioner', unit: 'ml', categoryName: 'GROOMING_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT016', name: 'Dung dịch vệ sinh tai', unit: 'ml', categoryName: 'GROOMING_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT017', name: 'Dầu/Lotion massage', unit: 'ml', categoryName: 'GROOMING_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT018', name: 'Dung dịch vệ sinh răng miệng', unit: 'ml', categoryName: 'ORAL_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT019', name: 'Dental pad / Gạc vệ sinh răng', unit: 'miếng', categoryName: 'ORAL_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT020', name: 'Dung dịch vệ sinh bàn chân', unit: 'ml', categoryName: 'PAW_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT021', name: 'Paw balm', unit: 'ml', categoryName: 'PAW_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT022', name: 'Dầu gội hỗ trợ xử lý ký sinh trùng', unit: 'ml', categoryName: 'GROOMING_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT023', name: 'Thuốc nhuộm lông an toàn cho pet', unit: 'ml', categoryName: 'GROOMING_CARE', serviceType: 'GROOMING' },
    { sku: 'MAT024', name: 'Băng keo y tế', unit: 'cuộn', categoryName: 'DRESSING', serviceType: 'MEDICAL' },
    { sku: 'MAT025', name: 'Bộ test nhanh', unit: 'bộ', categoryName: 'DIAGNOSTIC', serviceType: 'MEDICAL' },
    { sku: 'MAT026', name: 'Catheter tĩnh mạch', unit: 'cái', categoryName: 'SURGICAL', serviceType: 'MEDICAL' },
    { sku: 'MAT027', name: 'Lưỡi dao phẫu thuật', unit: 'cái', categoryName: 'SURGICAL', serviceType: 'MEDICAL' },
    { sku: 'MAT028', name: 'Khăn phủ phẫu thuật dùng 1 lần', unit: 'cái', categoryName: 'SURGICAL', serviceType: 'MEDICAL' },
  ];

  const materialMap = new Map();
  for (const mData of materialsData) {
    const item = await InventoryItem.findOneAndUpdate(
      { sku: mData.sku },
      {
        $set: {
          sku: mData.sku,
          name: mData.name,
          kind: 'MATERIAL',
          unit: mData.unit,
          category: mData.categoryName,
          categoryName: mData.categoryName,
          serviceType: mData.serviceType,
          usageType: 'SERVICE_SUPPLY',
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    materialMap.set(mData.sku, item);

    // Seed positive inventory stock across all 3 branches
    for (const branch of branches) {
      await InventoryStock.findOneAndUpdate(
        { branchId: branch._id, inventoryItemId: item._id },
        {
          $set: {
            quantity: 500,
            lowStockThreshold: 20,
            thresholdConfigured: true,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
  }

  const matRef = (sku, qty = 1, unit = null) => {
    const it = materialMap.get(sku);
    if (!it) return null;
    return {
      materialId: it._id,
      defaultQuantity: qty,
      unit: unit || it.unit,
    };
  };

  // Helper for exact 5-tier Grooming Weight Pricing per docs/catalog (2).xlsx
  const makeGroomingTiers = (xsPrice, sPrice, mPrice, lPrice) => [
    { tier: 'XS', label: 'XS (< 5 kg)', mode: 'FIXED', minWeightKg: 0, maxWeightKg: 4.999, price: xsPrice },
    { tier: 'S', label: 'S (5 – <10 kg)', mode: 'FIXED', minWeightKg: 5, maxWeightKg: 9.999, price: sPrice },
    { tier: 'M', label: 'M (10 – <20 kg)', mode: 'FIXED', minWeightKg: 10, maxWeightKg: 19.999, price: mPrice },
    { tier: 'L', label: 'L (20 – 30 kg)', mode: 'FIXED', minWeightKg: 20, maxWeightKg: 30, price: lPrice },
    { tier: 'XL', label: 'XL (> 30 kg) - Liên hệ / Báo giá', mode: 'QUOTE', minWeightKg: 30.001, maxWeightKg: null, price: null },
  ];

  // 3. Seed 19 Canonical Services (7 Medical, 9 Grooming, 3 Grooming Combos) per docs/catalog (2).xlsx
  const servicesData = [
    // --- 7 MEDICAL SERVICES ---
    {
      code: 'MED01',
      name: 'Khám sức khỏe tổng quát',
      serviceType: 'MEDICAL',
      category: 'Khám bệnh',
      description: 'Khám lâm sàng toàn diện tình trạng sức khỏe của thú cưng, kiểm tra tim phổi, nhiệt độ và thể trạng',
      basePrice: 150000,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [matRef('MAT001', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED02',
      name: 'Tiêm phòng',
      serviceType: 'MEDICAL',
      category: 'Phòng ngừa',
      description: 'Tiêm vaccine phòng bệnh truyền nhiễm định kỳ kèm theo dõi phản ứng sau tiêm và cập nhật sổ tiêm',
      basePrice: 200000,
      durationMinutes: 20,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [
        matRef('MAT013', 1),
        matRef('MAT006', 1),
        matRef('MAT007', 1),
        matRef('MAT008', 2),
        matRef('MAT001', 1),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED03',
      name: 'Xét nghiệm máu / Test nhanh',
      serviceType: 'MEDICAL',
      category: 'Chẩn đoán',
      description: 'Lấy mẫu máu xét nghiệm sinh hóa, công thức máu và bộ test nhanh kháng nguyên bệnh truyền nhiễm',
      basePrice: 250000,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [
        matRef('MAT011', 1),
        matRef('MAT006', 1),
        matRef('MAT007', 1),
        matRef('MAT008', 2),
        matRef('MAT001', 1),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED04',
      name: 'Siêu âm',
      serviceType: 'MEDICAL',
      category: 'Chẩn đoán hình ảnh',
      description: 'Siêu âm chẩn đoán hình ảnh kiểm tra ổ bụng, thai kỳ, gan thận và các cơ quan nội tạng',
      basePrice: 250000,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [matRef('MAT012', 20), matRef('MAT001', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED05',
      name: 'Thay băng / Chăm sóc sau điều trị',
      serviceType: 'MEDICAL',
      category: 'Điều dưỡng',
      description: 'Vệ sinh vết thương vô trùng, sát khuẩn, thay băng và chăm sóc phục hồi sau phẫu thuật hoặc điều trị',
      basePrice: 120000,
      durationMinutes: 30,
      requiredStaffRole: 'NURSE',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [
        matRef('MAT003', 5),
        matRef('MAT005', 50),
        matRef('MAT004', 10),
        matRef('MAT009', 1),
        matRef('MAT001', 1),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED06',
      name: 'Phẫu thuật / Triệt sản',
      serviceType: 'MEDICAL',
      category: 'Phẫu thuật',
      description: 'Phẫu thuật ngoại khoa và triệt sản an toàn dưới gây mê kiểm soát; bác sĩ thăm khám và tư vấn trước mổ',
      basePrice: 800000,
      durationMinutes: 120,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'REQUEST_ONLY',
      contactInfo: {
        hotline: '1900-PET-CLINIC',
        instruction: 'Từ 800.000đ. Gửi yêu cầu đặt lịch phẫu thuật để bác sĩ đánh giá thể trạng trước khi xác nhận',
      },
      priceVariants: [],
      defaultMaterials: [
        matRef('MAT001', 2),
        matRef('MAT003', 10),
        matRef('MAT005', 250),
        matRef('MAT006', 2),
        matRef('MAT007', 2),
        matRef('MAT010', 1),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED07',
      name: 'Cấp cứu 24/7',
      serviceType: 'MEDICAL',
      category: 'Cấp cứu',
      description: 'Tiếp nhận xử trí cấp cứu khẩn cấp 24/7. Báo giá và thời lượng xử lý tùy theo tình trạng tiếp nhận thực tế',
      basePrice: 0,
      durationMinutes: 60,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'CONTACT_ONLY',
      contactInfo: {
        hotline: '1900-PET-EMERGENCY',
        instruction: 'Báo giá sau tiếp nhận; thời lượng linh hoạt theo tình trạng ca cấp cứu (không set template vật tư cứng)',
      },
      priceVariants: [],
      defaultMaterials: [],
      status: 'ACTIVE',
    },

    // --- 9 GROOMING & SPA SERVICES (Exact 5 Weight Tiers from docs/catalog (2).xlsx) ---
    {
      code: 'GRM01',
      name: 'Tắm & Sấy khô',
      serviceType: 'GROOMING',
      category: 'Vệ sinh cơ bản',
      description: 'Tắm làm sạch bằng dầu gội chuyên dụng, dầu xả mượt lông, vệ sinh tai cơ bản và sấy khô tơi lông',
      basePrice: 70000,
      durationMinutes: 60,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(70000, 100000, 170000, 270000),
      defaultMaterials: [
        matRef('MAT014', 20),
        matRef('MAT015', 15),
        matRef('MAT016', 5),
        matRef('MAT002', 4),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM02',
      name: 'Massage chuyên sâu',
      serviceType: 'GROOMING',
      category: 'Spa & Thư giãn',
      description: 'Massage thư giãn giảm căng thẳng với dầu/lotion dưỡng da lông chuyên sâu giúp tuần hoàn tốt và mềm mượt lông',
      basePrice: 75000,
      durationMinutes: 45,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(75000, 110000, 180000, 280000),
      defaultMaterials: [matRef('MAT017', 20)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM03',
      name: 'Vệ sinh răng miệng',
      serviceType: 'GROOMING',
      category: 'Vệ sinh chuyên sâu',
      description: 'Làm sạch khoang miệng, khử mùi hôi miệng và mảng bám nhẹ bằng dung dịch oral care chuyên dụng',
      basePrice: 45000,
      durationMinutes: 20,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(45000, 70000, 120000, 180000),
      defaultMaterials: [
        matRef('MAT018', 10),
        matRef('MAT019', 2),
        matRef('MAT003', 2),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM04',
      name: 'Cắt & mài móng',
      serviceType: 'GROOMING',
      category: 'Vệ sinh cơ bản',
      description: 'Cắt gọn và mài mịn đầu móng an toàn, kiểm tra kẽ móng và sát khuẩn nhẹ nếu cần',
      basePrice: 45000,
      durationMinutes: 20,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(45000, 60000, 95000, 145000),
      defaultMaterials: [matRef('MAT002', 2), matRef('MAT004', 5)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM05',
      name: 'Chăm sóc bàn chân',
      serviceType: 'GROOMING',
      category: 'Spa & Bảo vệ',
      description: 'Làm sạch kẽ chân, tỉa gọn lông đệm bàn chân và thoa paw balm dưỡng ẩm chống nứt nẻ',
      basePrice: 45000,
      durationMinutes: 25,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(45000, 60000, 95000, 145000),
      defaultMaterials: [matRef('MAT020', 10), matRef('MAT021', 5)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM06',
      name: 'Điều trị ký sinh trùng ngoài da',
      serviceType: 'GROOMING',
      category: 'Chăm sóc da lông',
      description: 'Tắm ủ bằng dầu gội hỗ trợ xử lý ve rận, bọ chét và ký sinh trùng ngoài da trong quy trình Grooming (ca bệnh nặng tách Medical)',
      basePrice: 110000,
      durationMinutes: 45,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(110000, 150000, 250000, 365000),
      defaultMaterials: [matRef('MAT022', 25), matRef('MAT001', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM07',
      name: 'Cắt tỉa tạo kiểu',
      serviceType: 'GROOMING',
      category: 'Cắt tỉa & Tạo kiểu',
      description: 'Tắm sạch, vệ sinh tai, dưỡng xả và cắt tỉa tạo kiểu dáng thẩm mỹ phù hợp giống chó mèo',
      basePrice: 85000,
      durationMinutes: 90,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(85000, 130000, 240000, 380000),
      defaultMaterials: [
        matRef('MAT014', 20),
        matRef('MAT015', 15),
        matRef('MAT016', 5),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM08',
      name: 'Nhuộm lông thời trang',
      serviceType: 'GROOMING',
      category: 'Spa cao cấp',
      description: 'Tạo điểm nhấn nhuộm tai, đuôi hoặc bàn chân bằng thuốc nhuộm sinh học an toàn cho thú cưng',
      basePrice: 120000,
      durationMinutes: 120,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(120000, 180000, 340000, 540000),
      defaultMaterials: [
        matRef('MAT023', 30),
        matRef('MAT001', 1),
        matRef('MAT014', 15),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM09',
      name: 'Vắt tuyến hôi',
      serviceType: 'GROOMING',
      category: 'Vệ sinh chuyên sâu',
      description: 'Làm sạch tuyến dịch hôi vùng hậu môn giúp thú cưng thoải mái và hạn chế mùi cơ thể',
      basePrice: 65000,
      durationMinutes: 20,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(65000, 90000, 135000, 200000),
      defaultMaterials: [matRef('MAT001', 1), matRef('MAT003', 3)].filter(Boolean),
      status: 'ACTIVE',
    },

    // --- 3 GROOMING COMBO SERVICES (CMB01 - CMB03 per docs/catalog (2).xlsx) ---
    {
      code: 'CMB01',
      name: 'Combo Tắm 11 bước',
      serviceType: 'GROOMING',
      category: 'Combo tiết kiệm',
      description: 'Quy trình spa chăm sóc toàn diện 11 bước: tắm gội xả, massage thư giãn, vệ sinh tai, răng miệng, bàn chân và sấy chải tạo phồng',
      basePrice: 180000,
      durationMinutes: 120,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(180000, 230000, 385000, 525000),
      defaultMaterials: [
        matRef('MAT014', 25),
        matRef('MAT015', 20),
        matRef('MAT016', 5),
        matRef('MAT017', 15),
        matRef('MAT018', 10),
        matRef('MAT019', 2),
        matRef('MAT020', 10),
        matRef('MAT002', 4),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'CMB02',
      name: 'Combo Tắm cơ bản & cắt tỉa lông',
      serviceType: 'GROOMING',
      category: 'Combo tiết kiệm',
      description: 'Gói kết hợp tắm gội sạch sâu, vệ sinh tai và cắt tỉa lông tạo kiểu gọn gàng thẩm mỹ',
      basePrice: 135000,
      durationMinutes: 150,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(135000, 190000, 325000, 485000),
      defaultMaterials: [
        matRef('MAT014', 25),
        matRef('MAT015', 20),
        matRef('MAT016', 5),
        matRef('MAT002', 4),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'CMB03',
      name: 'Combo Chăm sóc & bảo vệ móng',
      serviceType: 'GROOMING',
      category: 'Combo tiết kiệm',
      description: 'Chăm sóc bàn chân toàn diện kết hợp làm sạch đệm chân, thoa paw balm dưỡng ẩm và cắt mài móng an toàn',
      basePrice: 100000,
      durationMinutes: 45,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(100000, 135000, 210000, 300000),
      defaultMaterials: [
        matRef('MAT020', 10),
        matRef('MAT021', 5),
        matRef('MAT002', 3),
      ].filter(Boolean),
      status: 'ACTIVE',
    },
  ];

  // Clean up old services that are not in the 19 canonical services
  const validCodes = servicesData.map((s) => s.code);
  const junkServices = await Service.find({ code: { $nin: validCodes } });
  if (junkServices.length > 0) {
    const junkIds = junkServices.map((s) => s._id);
    await BranchServiceConfig.deleteMany({ serviceId: { $in: junkIds } });
    await Service.deleteMany({ _id: { $in: junkIds } });
    console.log(`[Seed] Cleaned up ${junkIds.length} obsolete services.`);
  }

  const seededServices = [];
  for (const sData of servicesData) {
    const service = await Service.findOneAndUpdate(
      { code: sData.code },
      { $set: sData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    seededServices.push(service);

    // Enable 3/3 branches for all 19 services
    for (const branch of branches) {
      await BranchServiceConfig.findOneAndUpdate(
        { branchId: branch._id, serviceId: service._id },
        {
          $set: {
            branchId: branch._id,
            serviceId: service._id,
            enabled: true,
            capacity: 3,
            availability: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  // 4. Seed ShiftTemplates (Ca sáng & Ca chiều) for all 3 Branches
  const shiftTemplatesConfig = [
    {
      code: 'SHIFT-MORNING',
      name: 'Ca sáng (08:00 - 13:00)',
      startTime: '08:00',
      endTime: '13:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      status: 'ACTIVE',
    },
    {
      code: 'SHIFT-AFTERNOON',
      name: 'Ca chiều (13:00 - 18:00)',
      startTime: '13:00',
      endTime: '18:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      status: 'ACTIVE',
    },
  ];

  for (const branch of branches) {
    for (const st of shiftTemplatesConfig) {
      await ShiftTemplate.findOneAndUpdate(
        { branchId: branch._id, code: st.code },
        {
          $set: {
            branchId: branch._id,
            code: st.code,
            name: st.name,
            startTime: st.startTime,
            endTime: st.endTime,
            daysOfWeek: st.daysOfWeek,
            status: st.status,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  console.log(`[Seed] Successfully seeded:
  - ${branches.length} branches
  - ${materialsData.length} materials with stock across all branches
  - ${seededServices.length} canonical services (enabled 3/3 branches, Grooming 5 tiers)
  - 2 shift templates per branch`);
};

const isDirectCli = process.argv[1] && (process.argv[1].endsWith('serviceCatalogSeed.js') || process.argv[1].endsWith('serviceCatalogSeed'));
if (isDirectCli) {
  mongoose
    .connect(config.mongoUri)
    .then(async () => {
      await seedServiceCatalog();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
