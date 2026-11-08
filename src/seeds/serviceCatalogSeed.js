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
    const branch = await Branch.findOneAndUpdate(
      { code: bData.code },
      { $set: bData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    branches.push(branch);
  }

  // 2. Seed 28 Canonical Materials (MAT001 - MAT028)
  const materialsData = [
    { sku: 'MAT001', name: 'Cồn y tế 70 độ (chai 500ml)', unit: 'chai', categoryName: 'Vật tư y tế' },
    { sku: 'MAT002', name: 'Bông gòn tiệt trùng y tế (gói 500g)', unit: 'gói', categoryName: 'Vật tư y tế' },
    { sku: 'MAT003', name: 'Găng tay y tế Nitrile không bột (hộp 100 cái)', unit: 'hộp', categoryName: 'Vật tư y tế' },
    { sku: 'MAT004', name: 'Khẩu trang y tế kháng khuẩn 4 lớp (hộp 50 cái)', unit: 'hộp', categoryName: 'Vật tư y tế' },
    { sku: 'MAT005', name: 'Bơm kim tiêm vô trùng 1ml (hộp 100 cái)', unit: 'cái', categoryName: 'Vật tư y tế' },
    { sku: 'MAT006', name: 'Bơm kim tiêm vô trùng 3ml (hộp 100 cái)', unit: 'cái', categoryName: 'Vật tư y tế' },
    { sku: 'MAT007', name: 'Bơm kim tiêm vô trùng 5ml (hộp 100 cái)', unit: 'cái', categoryName: 'Vật tư y tế' },
    { sku: 'MAT008', name: 'Dung dịch sát trùng Povidine 10% (chai 100ml)', unit: 'chai', categoryName: 'Vật tư y tế' },
    { sku: 'MAT009', name: 'Nước muối sinh lý NaCl 0.9% (chai 500ml)', unit: 'chai', categoryName: 'Vật tư y tế' },
    { sku: 'MAT010', name: 'Băng gạc vô trùng cuộn co giãn (cuộn)', unit: 'cuộn', categoryName: 'Vật tư y tế' },
    { sku: 'MAT011', name: 'Băng dính y tế Urgo micropore (cuộn)', unit: 'cuộn', categoryName: 'Vật tư y tế' },
    { sku: 'MAT012', name: 'Chỉ phẫu thuật tự tiêu Polydioxanone 3-0 (tép)', unit: 'tép', categoryName: 'Vật tư y tế' },
    { sku: 'MAT013', name: 'Gel bôi trơn siêu âm y tế (chai 250ml)', unit: 'chai', categoryName: 'Vật tư y tế' },
    { sku: 'MAT014', name: 'Ống nghiệm lấy máu EDTA chống đông (ống)', unit: 'ống', categoryName: 'Vật tư y tế' },
    { sku: 'MAT015', name: 'Test nhanh kháng nguyên Parvo/Care (bộ)', unit: 'bộ', categoryName: 'Vật tư y tế' },
    { sku: 'MAT016', name: 'Dầu tắm dưỡng lông thú cưng chuyên dụng (chai 500ml)', unit: 'chai', categoryName: 'Vật tư spa' },
    { sku: 'MAT017', name: 'Dầu xả phục hồi lông suôn mượt (chai 500ml)', unit: 'chai', categoryName: 'Vật tư spa' },
    { sku: 'MAT018', name: 'Dung dịch rửa tai chống ve rận Otoclean (lọ 100ml)', unit: 'lọ', categoryName: 'Vật tư spa' },
    { sku: 'MAT019', name: 'Bột cầm máu móng thú cưng Kwik Stop (lọ 14g)', unit: 'lọ', categoryName: 'Vật tư spa' },
    { sku: 'MAT020', name: 'Xịt khử mùi và dưỡng bóng lông cao cấp (chai 200ml)', unit: 'chai', categoryName: 'Vật tư spa' },
    { sku: 'MAT021', name: 'Khăn lau mắt & khóe mắt chuyên dụng (hộp 100 miếng)', unit: 'hộp', categoryName: 'Vật tư spa' },
    { sku: 'MAT022', name: 'Kem đánh răng thảo mộc cho chó mèo (tuýp 75g)', unit: 'tuýp', categoryName: 'Vật tư spa' },
    { sku: 'MAT023', name: 'Thuốc nhuộm lông sinh học an toàn (hộp 150ml)', unit: 'hộp', categoryName: 'Vật tư spa' },
    { sku: 'MAT024', name: 'Bột thảo dược đắp mặt nạ ủ lông (gói 200g)', unit: 'gói', categoryName: 'Vật tư spa' },
    { sku: 'MAT025', name: 'Xịt chống rối và dưỡng ẩm keratin (chai 250ml)', unit: 'chai', categoryName: 'Vật tư spa' },
    { sku: 'MAT026', name: 'Tấm lót vệ sinh thú cưng thấm hút cao (bịch 50 cái)', unit: 'bịch', categoryName: 'Vật tư tiêu hao' },
    { sku: 'MAT027', name: 'Khăn tắm siêu thấm nước dành riêng thú cưng (cái)', unit: 'cái', categoryName: 'Vật tư tiêu hao' },
    { sku: 'MAT028', name: 'Vòng cổ Elizabeth chống liếm chống cắn (cái)', unit: 'cái', categoryName: 'Vật tư tiêu hao' },
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
            quantity: 150,
            lowStockThreshold: 10,
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

  // Helper for 5-tier Grooming Weight Pricing
  const makeGroomingTiers = (basePrice) => [
    { tier: 'XS', label: 'XS (<5kg)', mode: 'FIXED', minWeightKg: 0, maxWeightKg: 4.99, price: basePrice },
    { tier: 'S', label: 'S (5-10kg)', mode: 'FIXED', minWeightKg: 5, maxWeightKg: 9.99, price: Math.round(basePrice * 1.3 / 1000) * 1000 },
    { tier: 'M', label: 'M (10-20kg)', mode: 'FIXED', minWeightKg: 10, maxWeightKg: 19.99, price: Math.round(basePrice * 1.6 / 1000) * 1000 },
    { tier: 'L', label: 'L (20-30kg)', mode: 'FIXED', minWeightKg: 20, maxWeightKg: 30, price: Math.round(basePrice * 2.0 / 1000) * 1000 },
    { tier: 'XL', label: 'XL (>30kg) - Báo giá trực tiếp', mode: 'QUOTE', minWeightKg: 30.01, maxWeightKg: 99, price: null },
  ];

  // 3. Seed 19 Canonical Services (7 Medical, 9 Grooming, 3 Combo)
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
      defaultMaterials: [matRef('MAT001', 1), matRef('MAT003', 1), matRef('MAT004', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED02',
      name: 'Tiêm vaccine phòng bệnh chó mèo',
      serviceType: 'MEDICAL',
      category: 'Phòng ngừa',
      description: 'Tiêm vaccine phòng các bệnh truyền nhiễm nguy hiểm (Care, Parvo, Dại, 4 bệnh mèo,...) kèm sổ tiêm phòng',
      basePrice: 220000,
      durationMinutes: 20,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [matRef('MAT005', 1), matRef('MAT001', 1), matRef('MAT008', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED03',
      name: 'Tẩy giun & Điều trị ký sinh trùng',
      serviceType: 'MEDICAL',
      category: 'Phòng ngừa',
      description: 'Uống thuốc tẩy giun nội ký sinh và nhỏ gáy phòng ve rận, bọ chét định kỳ theo cân nặng',
      basePrice: 120000,
      durationMinutes: 20,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [matRef('MAT003', 1), matRef('MAT007', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED04',
      name: 'Siêu âm ổ bụng & X-quang kỹ thuật số',
      serviceType: 'MEDICAL',
      category: 'Chẩn đoán hình ảnh',
      description: 'Chẩn đoán hình ảnh độ phân giải cao phát hiện sớm các bệnh lý tiêu hóa, niệu sinh dục và dị vật',
      basePrice: 350000,
      durationMinutes: 40,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [matRef('MAT013', 1), matRef('MAT003', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED05',
      name: 'Xét nghiệm máu tổng quát',
      serviceType: 'MEDICAL',
      category: 'Chẩn đoán',
      description: 'Xét nghiệm công thức máu 18 thông số và sinh hóa gan thận chuyên sâu',
      basePrice: 400000,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [matRef('MAT014', 1), matRef('MAT005', 1), matRef('MAT008', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED06',
      name: 'Phẫu thuật triệt sản chó mèo',
      serviceType: 'MEDICAL',
      category: 'Phẫu thuật',
      description: 'Phẫu thuật triệt sản an toàn với gây mê khí dung hiện đại, theo dõi hồi sức chu đáo',
      basePrice: 800000,
      durationMinutes: 90,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'REQUEST_ONLY',
      priceVariants: [],
      defaultMaterials: [matRef('MAT003', 2), matRef('MAT012', 1), matRef('MAT008', 1), matRef('MAT010', 1), matRef('MAT028', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'MED07',
      name: 'Cấp cứu & Hồi sức tích cực 24/7',
      serviceType: 'MEDICAL',
      category: 'Cấp cứu',
      description: 'Tiếp nhận cấp cứu khẩn cấp 24/7 đối với thú cưng ngộ độc, khó thở, chấn thương hoặc sốc nhiệt',
      basePrice: 500000,
      durationMinutes: 60,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'CONTACT_ONLY',
      contactInfo: {
        hotline: '1900-PET-EMERGENCY',
        instruction: 'Báo giá và phác đồ điều trị sau khi tiếp nhận cấp cứu tại phòng khám',
      },
      priceVariants: [],
      defaultMaterials: [matRef('MAT006', 1), matRef('MAT009', 1), matRef('MAT010', 1)].filter(Boolean),
      status: 'ACTIVE',
    },

    // --- 9 GROOMING SERVICES (5 Weight Tiers Each) ---
    {
      code: 'GRM01',
      name: 'Tắm spa & Sấy phồng tạo kiểu',
      serviceType: 'GROOMING',
      category: 'Vệ sinh cơ bản',
      description: 'Tắm sạch sâu bằng dầu tắm thảo mộc, sấy phồng tơi lông và khử mùi hôi',
      basePrice: 180000,
      durationMinutes: 60,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(180000),
      defaultMaterials: [matRef('MAT016', 1), matRef('MAT027', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM02',
      name: 'Cắt tỉa lông tạo kiểu nghệ thuật',
      serviceType: 'GROOMING',
      category: 'Cắt tỉa & Tạo kiểu',
      description: 'Tỉa lông định hình phom dáng Teddy bear, Puppy cut, hoặc theo yêu cầu chủ nuôi',
      basePrice: 250000,
      durationMinutes: 75,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(250000),
      defaultMaterials: [matRef('MAT016', 1), matRef('MAT020', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM03',
      name: 'Vệ sinh tai & Nhổ lông tai chuyên sâu',
      serviceType: 'GROOMING',
      category: 'Vệ sinh chuyên sâu',
      description: 'Làm sạch ráy tai, nhổ lông tai hạn chế viêm tai giữa và nấm tai',
      basePrice: 80000,
      durationMinutes: 20,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(80000),
      defaultMaterials: [matRef('MAT018', 1), matRef('MAT002', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM04',
      name: 'Cắt mài móng an toàn',
      serviceType: 'GROOMING',
      category: 'Vệ sinh cơ bản',
      description: 'Cắt tỉa và mài tròn góc móng tránh cào xước người và đồ đạc, có bột cầm máu an toàn',
      basePrice: 60000,
      durationMinutes: 15,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(60000),
      defaultMaterials: [matRef('MAT019', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM05',
      name: 'Vắt tuyến hôi & Khử mùi toàn thân',
      serviceType: 'GROOMING',
      category: 'Vệ sinh chuyên sâu',
      description: 'Vắt sạch túi dịch hôi hậu môn phòng ngừa viêm bao dịch và xịt thơm tự nhiên',
      basePrice: 90000,
      durationMinutes: 20,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(90000),
      defaultMaterials: [matRef('MAT020', 1), matRef('MAT003', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM06',
      name: 'Cạo lông điều trị da liễu / Theo yêu cầu',
      serviceType: 'GROOMING',
      category: 'Cạo lông',
      description: 'Cạo ngắn sạch lông điều trị ghẻ, nấm da hoặc làm mát mùa hè an toàn không tổn thương da',
      basePrice: 160000,
      durationMinutes: 45,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(160000),
      defaultMaterials: [matRef('MAT001', 1), matRef('MAT027', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM07',
      name: 'Nhuộm lông thời trang an toàn sinh học',
      serviceType: 'GROOMING',
      category: 'Spa cao cấp',
      description: 'Nhuộm tai, đuôi, chân bằng màu nhuộm organic không kích ứng da thú cưng',
      basePrice: 350000,
      durationMinutes: 90,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(350000),
      defaultMaterials: [matRef('MAT023', 1), matRef('MAT003', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM08',
      name: 'Đắp mặt nạ thảo dược & Phục hồi lông hư tổn',
      serviceType: 'GROOMING',
      category: 'Spa cao cấp',
      description: 'Ủ mặt nạ thảo mộc phục hồi chất sừng của sợi lông khô xơ, giữ ẩm cho da',
      basePrice: 220000,
      durationMinutes: 45,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(220000),
      defaultMaterials: [matRef('MAT024', 1), matRef('MAT017', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'GRM09',
      name: 'Gỡ rối lông chuyên sâu & Dưỡng bóng mượt',
      serviceType: 'GROOMING',
      category: 'Vệ sinh chuyên sâu',
      description: 'Gỡ các búi lông vón cục bằng xịt dưỡng keratin chuyên dụng không làm đau thú cưng',
      basePrice: 200000,
      durationMinutes: 60,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(200000),
      defaultMaterials: [matRef('MAT025', 1), matRef('MAT017', 1)].filter(Boolean),
      status: 'ACTIVE',
    },

    // --- 3 COMBOS ---
    {
      code: 'CMB01',
      name: 'Combo Spa Toàn Diện (Tắm + Tỉa + Vệ sinh tai + Cắt móng)',
      serviceType: 'GROOMING',
      category: 'Combo tiết kiệm',
      description: 'Gói chăm sóc làm đẹp trọn gói giúp thú cưng sạch sẽ, thơm tho và gọn gàng từ đầu đến chân',
      basePrice: 390000,
      durationMinutes: 90,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: makeGroomingTiers(390000),
      defaultMaterials: [matRef('MAT016', 1), matRef('MAT018', 1), matRef('MAT019', 1), matRef('MAT027', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'CMB02',
      name: 'Combo Chăm Sóc Sức Khỏe Cơ Bản (Khám + Vaccine + Tẩy giun)',
      serviceType: 'MEDICAL',
      category: 'Combo tiết kiệm',
      description: 'Gói phòng bệnh toàn diện bao gồm khám lâm sàng tổng quát, tiêm ngừa vaccine và uống thuốc tẩy giun',
      basePrice: 420000,
      durationMinutes: 60,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [matRef('MAT001', 1), matRef('MAT005', 1), matRef('MAT008', 1)].filter(Boolean),
      status: 'ACTIVE',
    },
    {
      code: 'CMB03',
      name: 'Combo Khám Toàn Diện & Tầm Soát (Khám + Siêu âm + Xét nghiệm máu)',
      serviceType: 'MEDICAL',
      category: 'Combo tiết kiệm',
      description: 'Tầm soát chuyên sâu toàn bộ cơ quan nội tạng, phát hiện sớm mầm bệnh cho thú cưng trưởng thành hoặc lớn tuổi',
      basePrice: 820000,
      durationMinutes: 90,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      priceVariants: [],
      defaultMaterials: [matRef('MAT013', 1), matRef('MAT014', 1), matRef('MAT005', 1), matRef('MAT008', 1)].filter(Boolean),
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
