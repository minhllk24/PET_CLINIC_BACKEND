import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SURCHARGE_SERVICE_NAMES = [
  'Tắm & Sấy khô',
  'Massage chuyên sâu',
  'Vệ sinh răng miệng',
  'Cắt & mài móng',
  'Chăm sóc bàn chân',
  'Điều trị ký sinh trùng',
  'Cắt tỉa tạo kiểu',
  'Nhuộm lông thời trang',
  'Vắt tuyến hôi',
  'Combo Tắm 11 bước',
  'Combo Tắm cơ bản & cắt tỉa lông',
  'Combo Chăm sóc & bảo vệ móng',
];

async function main() {
  const enabled = await prisma.service.updateMany({
    where: {
      service_name: { in: SURCHARGE_SERVICE_NAMES },
    },
    data: {
      is_weight_surcharge_applied: true,
    },
  });

  const disabled = await prisma.service.updateMany({
    where: {
      service_name: { notIn: SURCHARGE_SERVICE_NAMES },
    },
    data: {
      is_weight_surcharge_applied: false,
    },
  });

  console.log(`Enabled weight surcharge for ${enabled.count} grooming/combo services.`);
  console.log(`Disabled weight surcharge for ${disabled.count} non-grooming services.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
