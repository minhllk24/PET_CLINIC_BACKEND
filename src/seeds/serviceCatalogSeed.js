import mongoose from 'mongoose';
import Branch from '../modules/branch/models/Branch';
import Service from '../modules/catalog/models/Service';
import BranchServiceConfig from '../modules/branch/models/BranchServiceConfig';
import config from '../shared/config';

export const seedServiceCatalog = async () => {
  // 1. Seed 3 Branches
  const defaultOpeningHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    open: '08:00',
    close: '18:00',
  }));

  const branchesData = [
    {
      code: 'BR-000001',
      name: 'Chi nhánh Quận 1',
      address: '123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM',
      phone: '02812345678',
      status: 'ACTIVE',
      openingHours: defaultOpeningHours,
      holidays: [],
    },
    {
      code: 'BR-000002',
      name: 'Chi nhánh Quận 3',
      address: '456 Lê Văn Sỹ, Phường 14, Quận 3, TP.HCM',
      phone: '02887654321',
      status: 'ACTIVE',
      openingHours: defaultOpeningHours,
      holidays: [],
    },
    {
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

  // 2. Seed 12 Services matching Frontend Admin UI exactly
  const servicesData = [
    {
      code: 'GRM01',
      name: 'Tắm & Sấy khô',
      serviceType: 'GROOMING',
      category: 'Vệ sinh cơ bản',
      description: 'Tắm sạch bằng dầu tắm chuyên dụng và sấy chải bông lông',
      basePrice: 70000,
      durationMinutes: 60,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: [
        { label: 'Từ 70.000đ (<5kg)', minWeightKg: 0, maxWeightKg: 4.99, price: 70000 },
        { label: 'S (5-10kg)', minWeightKg: 5, maxWeightKg: 9.99, price: 100000 },
        { label: 'M (10-20kg)', minWeightKg: 10, maxWeightKg: 19.99, price: 150000 },
        { label: 'L (20-30kg)', minWeightKg: 20, maxWeightKg: 30, price: 200000 },
      ],
      status: 'ACTIVE',
      enabledBranchIndices: [0, 1], // 2/3 bật
    },
    {
      code: 'GRM02',
      name: 'Massage chuyên sâu',
      serviceType: 'GROOMING',
      category: 'Spa & Thư giãn',
      description: 'Massage cơ bắp thư giãn cho thú cưng với tinh dầu an toàn',
      basePrice: 75000,
      durationMinutes: 45,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: [
        { label: 'Từ 75.000đ', minWeightKg: 0, maxWeightKg: 10, price: 75000 },
      ],
      status: 'ACTIVE',
      enabledBranchIndices: [0, 1], // 2/3 bật
    },
    {
      code: 'MED01',
      name: 'Khám sức khỏe tổng quát',
      serviceType: 'MEDICAL',
      category: 'Khám bệnh',
      description: 'Khám lâm sàng toàn diện tình trạng sức khỏe của thú cưng',
      basePrice: 150000,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
      enabledBranchIndices: [0], // 1/3 bật
    },
    {
      code: 'MED02',
      name: 'Tiêm phòng',
      serviceType: 'MEDICAL',
      category: 'Phòng ngừa',
      description: 'Tiêm vaccine phòng các bệnh truyền nhiễm cho chó mèo',
      basePrice: 200000,
      durationMinutes: 20,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
      enabledBranchIndices: [0], // 1/3 bật
    },
    {
      code: 'MED06',
      name: 'Phẫu thuật / Triệt sản',
      serviceType: 'MEDICAL',
      category: 'Phẫu thuật',
      description: 'Phẫu thuật triệt sản hoặc ngoại khoa theo chỉ định bác sĩ',
      basePrice: 800000,
      durationMinutes: 120,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'REQUEST_ONLY',
      status: 'ACTIVE',
      enabledBranchIndices: [], // 0/3 bật
    },
    {
      code: 'MED07',
      name: 'Cấp cứu 24/7',
      serviceType: 'MEDICAL',
      category: 'Cấp cứu',
      description: 'Hỗ trợ tiếp nhận cấp cứu khẩn cấp 24/7',
      basePrice: 0,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'CONTACT_ONLY',
      contactInfo: {
        hotline: '1900-PET-EMERGENCY',
        instruction: 'Báo giá sau tiếp nhận',
      },
      status: 'ACTIVE',
      enabledBranchIndices: [], // 0/3 bật
    },
    {
      code: 'GRM03',
      name: 'Cắt tỉa lông',
      serviceType: 'GROOMING',
      category: 'Vệ sinh chuyên sâu',
      description: 'Cắt tỉa tạo kiểu lông nghệ thuật cho thú cưng',
      basePrice: 100000,
      durationMinutes: 50,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
      enabledBranchIndices: [0], // 1/3 bật
    },
    {
      code: 'GRM04',
      name: 'Vệ sinh tai',
      serviceType: 'GROOMING',
      category: 'Vệ sinh cơ bản',
      description: 'Vệ sinh làm sạch bụi bẩn và ráy tai chống ve rận',
      basePrice: 90000,
      durationMinutes: 20,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
      enabledBranchIndices: [0, 1], // 2/3 bật
    },
    {
      code: 'MED03',
      name: 'Xét nghiệm tổng quát',
      serviceType: 'MEDICAL',
      category: 'Chẩn đoán',
      description: 'Xét nghiệm công thức máu và sinh hóa toàn diện',
      basePrice: 350000,
      durationMinutes: 40,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'REQUEST_ONLY',
      status: 'ACTIVE',
      enabledBranchIndices: [0], // 1/3 bật
    },
    {
      code: 'MED04',
      name: 'Khám da liễu',
      serviceType: 'MEDICAL',
      category: 'Khám bệnh',
      description: 'Soi da và điều trị nấm, ghẻ, viêm da cho thú cưng',
      basePrice: 220000,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
      enabledBranchIndices: [0, 2], // 2/3 bật
    },
    {
      code: 'GRM05',
      name: 'Tắm trị liệu',
      serviceType: 'GROOMING',
      category: 'Vệ sinh chuyên sâu',
      description: 'Tắm dầu tắm đặc trị nấm ngứa và dưỡng lông hồi phục',
      basePrice: 120000,
      durationMinutes: 60,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: [
        { label: 'Từ 120.000đ', minWeightKg: 0, maxWeightKg: 10, price: 120000 },
      ],
      status: 'ACTIVE',
      enabledBranchIndices: [1], // 1/3 bật
    },
    {
      code: 'MED05',
      name: 'Tư vấn dinh dưỡng',
      serviceType: 'MEDICAL',
      category: 'Tư vấn',
      description: 'Tư vấn chế độ ăn uống khoa học phù hợp độ tuổi và thể trạng',
      basePrice: 0,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'CONTACT_ONLY',
      contactInfo: {
        hotline: '1900-PET-NUTRITION',
        instruction: 'Báo giá sau tiếp nhận',
      },
      status: 'ACTIVE',
      enabledBranchIndices: [], // 0/3 bật
    },
  ];

  const services = [];
  for (const sData of servicesData) {
    const { enabledBranchIndices, ...serviceFields } = sData;
    const service = await Service.findOneAndUpdate(
      { code: serviceFields.code },
      { $set: serviceFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    services.push({ service, enabledBranchIndices });
  }

  // 3. Seed BranchServiceConfigs matching ratios (2/3, 1/3, 0/3)
  for (let bIndex = 0; bIndex < branches.length; bIndex++) {
    const branch = branches[bIndex];
    for (const { service, enabledBranchIndices } of services) {
      const isEnabled = enabledBranchIndices.includes(bIndex);
      await BranchServiceConfig.findOneAndUpdate(
        { branchId: branch._id, serviceId: service._id },
        {
          $set: {
            branchId: branch._id,
            serviceId: service._id,
            enabled: isEnabled,
            capacity: 2,
            availability: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  console.log(`[Seed] Seeded ${branches.length} branches, ${services.length} services matching Frontend table.`);
};

// Standalone execution if run directly
if (require.main === module) {
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
