import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Roles
  const roles = [
    { role_code: 'ADMIN', role_name: 'Administrator', description: 'System Admin' },
    { role_code: 'STAFF', role_name: 'Staff', description: 'Clinic Staff' },
    { role_code: 'DOCTOR', role_name: 'Doctor', description: 'Veterinarian' },
    { role_code: 'CUSTOMER', role_name: 'Customer', description: 'Pet Owner' }
  ];
  
  for (const r of roles) {
    await prisma.role.upsert({
      where: { role_code: r.role_code },
      update: {},
      create: r,
    });
  }

  // 2. Users
  const passwordHash = await bcrypt.hash('12345678', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@petclinic.com' },
    update: {},
    create: {
      email: 'admin@petclinic.com',
      password_hash: passwordHash,
      full_name: 'Admin',
      role: { connect: { role_code: 'ADMIN' } },
      status: 'active'
    }
  });

  const doctor1 = await prisma.user.upsert({
    where: { email: 'doctor1@petclinic.com' },
    update: {},
    create: {
      email: 'doctor1@petclinic.com',
      password_hash: passwordHash,
      full_name: 'Dr. Nguyen Van A',
      role: { connect: { role_code: 'DOCTOR' } },
      status: 'active'
    }
  });

  const customer1 = await prisma.user.upsert({
    where: { email: 'customer1@petclinic.com' },
    update: {},
    create: {
      email: 'customer1@petclinic.com',
      password_hash: passwordHash,
      full_name: 'Khách hàng 1',
      phone: '0123456789',
      role: { connect: { role_code: 'CUSTOMER' } },
      status: 'active'
    }
  });

  // 3. Species & Breeds
  const catSpecies = await prisma.petSpecies.upsert({
    where: { species_name: 'Mèo' },
    update: {},
    create: { species_name: 'Mèo' }
  });

  await prisma.petBreed.createMany({
    data: [
      { species_id: catSpecies.species_id, breed_name: 'Mèo Anh Lông Ngắn' },
      { species_id: catSpecies.species_id, breed_name: 'Mèo Ba Tư' }
    ],
    skipDuplicates: true
  });

  // 4. Service Categories
  let serviceCat1 = await prisma.serviceCategory.findFirst({ where: { category_name: 'Khám bệnh' } });
  if (!serviceCat1) {
    serviceCat1 = await prisma.serviceCategory.create({
      data: { category_name: 'Khám bệnh', description: 'Các dịch vụ khám chữa bệnh' }
    });
  }

  // 5. Clinic Services
  // We can just ignore clinicService duplicate or upsert if there's a unique field
  // Actually clinicService has no unique field besides ID, so we skip it to prevent duplication
  const existingService = await prisma.service.findFirst({ where: { service_name: 'Khám tổng quát' } });
  if (!existingService) {
    await prisma.service.create({
      data: {
        service_category_id: serviceCat1.service_category_id,
        service_name: 'Khám tổng quát',
        base_price: 150000,
        duration_minutes: 30,
        status: 'active'
      }
    });
  }

  // 6. Product Categories & Products
  let prodCat1 = await prisma.productCategory.findFirst({ where: { category_name: 'Thức ăn chó mèo' } });
  if (!prodCat1) {
    prodCat1 = await prisma.productCategory.create({
      data: { category_name: 'Thức ăn chó mèo', status: 'active' }
    });
  }

  const existingProduct = await prisma.product.findFirst({ where: { product_name: 'Hạt Royal Canin' } });
  if (!existingProduct) {
    await prisma.product.create({
      data: {
        product_category_id: prodCat1.product_category_id,
        product_name: 'Hạt Royal Canin',
        price: 250000,
        stock_quantity: 100,
        status: 'active',
        description: 'Hạt dinh dưỡng cao cấp'
      }
    });
  }

  // 7. Vouchers
  await prisma.voucher.upsert({
    where: { voucher_code: 'WELCOME10' },
    update: {},
    create: {
      voucher_code: 'WELCOME10',
      voucher_name: 'Giảm giá chào mừng 10%',
      discount_type: 'percent',
      discount_value: 10,
      status: 'active',
      start_at: new Date(),
      end_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    }
  });

  console.log('Seed data successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
