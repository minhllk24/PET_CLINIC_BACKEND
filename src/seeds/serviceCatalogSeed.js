import mongoose from 'mongoose';
import Branch from '../modules/branch/models/Branch';
import Service from '../modules/catalog/models/Service';
import BranchServiceConfig from '../modules/branch/models/BranchServiceConfig';
import config from '../shared/config';

export const seedServiceCatalog = async () => {
  // 1. Seed Branches
  const defaultOpeningHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    dayOfWeek: day,
    open: '08:00',
    close: '18:00',
  }));

  const branchesData = [
    {
      code: 'BR-000001',
      name: 'Chi nhánh Quận 1 - Pet Care Center',
      address: '123 Nguyễn Thị Minh Khai, Phường Bến Thành, Quận 1, TP.HCM',
      phone: '02812345678',
      status: 'ACTIVE',
      openingHours: defaultOpeningHours,
      holidays: [],
    },
    {
      code: 'BR-000002',
      name: 'Chi nhánh Quận 3 - Pet Care Clinic',
      address: '456 Lê Văn Sỹ, Phường 14, Quận 3, TP.HCM',
      phone: '02887654321',
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

  // 2. Seed Services according to docs/catalog.xlsx
  const servicesData = [
    // MEDICAL
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
    },
    {
      code: 'MED03',
      name: 'Xét nghiệm máu / Test nhanh',
      serviceType: 'MEDICAL',
      category: 'Chẩn đoán',
      description: 'Xét nghiệm công thức máu và test nhanh bệnh truyền nhiễm',
      basePrice: 250000,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
    },
    {
      code: 'MED04',
      name: 'Siêu âm',
      serviceType: 'MEDICAL',
      category: 'Chẩn đoán hình ảnh',
      description: 'Siêu âm ổ bụng, siêu âm thai cho thú cưng',
      basePrice: 250000,
      durationMinutes: 30,
      requiredStaffRole: 'VETERINARIAN',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
    },
    {
      code: 'MED05',
      name: 'Thay băng / Chăm sóc sau điều trị',
      serviceType: 'MEDICAL',
      category: 'Điều trị',
      description: 'Vệ sinh vết thương, thay băng và chăm sóc hồi phục',
      basePrice: 120000,
      durationMinutes: 30,
      requiredStaffRole: 'NURSE',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
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
        instruction: 'Vui lòng liên hệ hotline hoặc đưa thú cưng trực tiếp đến chi nhánh gần nhất',
      },
      status: 'ACTIVE',
    },
    // GROOMING & SPA
    {
      code: 'GRM01',
      name: 'Tắm & Sấy khô',
      serviceType: 'GROOMING',
      category: 'Vệ sinh cơ bản',
      description: 'Tắm sạch bằng dầu tắm chuyên dụng và sấy chải bông lông',
      basePrice: 100000,
      durationMinutes: 60,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      priceVariants: [
        { label: 'XS (<5kg)', minWeightKg: 0, maxWeightKg: 4.99, price: 100000 },
        { label: 'S (5-10kg)', minWeightKg: 5, maxWeightKg: 9.99, price: 150000 },
        { label: 'M (10-20kg)', minWeightKg: 10, maxWeightKg: 19.99, price: 200000 },
        { label: 'L (20-30kg)', minWeightKg: 20, maxWeightKg: 30, price: 250000 },
      ],
      status: 'ACTIVE',
    },
    {
      code: 'GRM02',
      name: 'Massage chuyên sâu',
      serviceType: 'GROOMING',
      category: 'Spa & Thư giãn',
      description: 'Massage cơ bắp thư giãn cho thú cưng với tinh dầu an toàn',
      basePrice: 120000,
      durationMinutes: 45,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
    },
    {
      code: 'GRM03',
      name: 'Vệ sinh răng miệng',
      serviceType: 'GROOMING',
      category: 'Vệ sinh chuyên sâu',
      description: 'Đánh răng và xịt thơm miệng diệt khuẩn',
      basePrice: 80000,
      durationMinutes: 20,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
    },
    {
      code: 'GRM04',
      name: 'Cắt & mài móng',
      serviceType: 'GROOMING',
      category: 'Vệ sinh cơ bản',
      description: 'Cắt tỉa và mài êm móng chân',
      basePrice: 60000,
      durationMinutes: 20,
      requiredStaffRole: 'CARE_STAFF_GROOMER',
      bookingMode: 'BOOKABLE',
      status: 'ACTIVE',
    },
  ];

  const services = [];
  for (const sData of servicesData) {
    const service = await Service.findOneAndUpdate(
      { code: sData.code },
      { $set: sData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    services.push(service);
  }

  // 3. Seed BranchServiceConfigs (enable services at branches with capacity = 2)
  for (const branch of branches) {
    for (const service of services) {
      await BranchServiceConfig.findOneAndUpdate(
        { branchId: branch._id, serviceId: service._id },
        {
          $set: {
            branchId: branch._id,
            serviceId: service._id,
            enabled: true,
            capacity: 2,
            availability: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  console.log(`[Seed] Seeded ${branches.length} branches, ${services.length} services, and BranchServiceConfigs.`);
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
