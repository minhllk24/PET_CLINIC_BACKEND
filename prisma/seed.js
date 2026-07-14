import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const VN_FIRST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi'];
const VN_MIDDLE = ['Văn', 'Thị', 'Anh', 'Minh', 'Đức', 'Hoàng', 'Hải', 'Xuân', 'Quốc', 'Thành'];
const VN_LAST = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hương', 'Khánh', 'Lan', 'Nam', 'Phúc', 'Quỳnh', 'Sơn', 'Thảo', 'Tú', 'Vinh'];

function generateRandomName() {
  const f = VN_FIRST[Math.floor(Math.random() * VN_FIRST.length)];
  const m = VN_MIDDLE[Math.floor(Math.random() * VN_MIDDLE.length)];
  const l = VN_LAST[Math.floor(Math.random() * VN_LAST.length)];
  return `${f} ${m} ${l}`;
}

function removeAccents(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function generateRandomEmail(name, roleCode, index) {
  const cleanName = removeAccents(name).toLowerCase().replace(/\s+/g, '.');
  const randomStr = Math.random().toString(36).substring(2, 6);
  return `${roleCode.toLowerCase()}.${cleanName}.${index + 1}.${randomStr}@petclinic.com`;
}

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

  // 1.5. Branches
  const branchesData = [
    {
      branch_name: "Chi nhánh Quận 10 (Chính)",
      address: "123 Đường Ba Tháng Hai, Phường 11, Quận 10, TP. Hồ Chí Minh",
      phone: "0281234567",
      email: "branch1@petclinic.com",
      operating_hours: "Cả ngày (24/7) kể cả cuối tuần, lễ, Tết.",
      latitude: 10.7726000,
      longitude: 106.6605000,
    },
    {
      branch_name: "Chi nhánh Bình Thạnh",
      address: "456 Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh",
      phone: "0287654321",
      email: "branch2@petclinic.com",
      operating_hours: "Cả ngày (24/7) kể cả cuối tuần, lễ, Tết.",
      latitude: 10.8015000,
      longitude: 106.7094000,
    },
    {
      branch_name: "Chi nhánh Quận 1",
      address: "15 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh",
      phone: "0281111222",
      email: "branch3@petclinic.com",
      operating_hours: "7:00 - 21:00 (kể cả cuối tuần, lễ, Tết)",
      latitude: 10.7810000,
      longitude: 106.6994000,
    },
    {
      branch_name: "Chi nhánh Quận 7",
      address: "105 Nguyễn Văn Linh, Tân Phú, Quận 7, TP. Hồ Chí Minh",
      phone: "0283333444",
      email: "branch4@petclinic.com",
      operating_hours: "8:00 - 22:00 (kể cả cuối tuần, lễ, Tết)",
      latitude: 10.7295000,
      longitude: 106.7220000,
    },
    {
      branch_name: "Chi nhánh Gò Vấp",
      address: "800 Quang Trung, Phường 8, Gò Vấp, TP. Hồ Chí Minh",
      phone: "0285555666",
      email: "branch5@petclinic.com",
      operating_hours: "7:30 - 21:30 (kể cả cuối tuần, lễ, Tết)",
      latitude: 10.8387000,
      longitude: 106.6572000,
    },
    {
      branch_name: "Chi nhánh Tân Bình",
      address: "300 Cộng Hòa, Phường 13, Tân Bình, TP. Hồ Chí Minh",
      phone: "0287777888",
      email: "branch6@petclinic.com",
      operating_hours: "8:00 - 22:00 (kể cả cuối tuần, lễ, Tết)",
      latitude: 10.8012000,
      longitude: 106.6523000,
    },
    {
      branch_name: "Chi nhánh Thủ Đức",
      address: "50 Võ Văn Ngân, Bình Thọ, Thủ Đức, TP. Hồ Chí Minh",
      phone: "0289999000",
      email: "branch7@petclinic.com",
      operating_hours: "7:00 - 22:00 (kể cả cuối tuần, lễ, Tết)",
      latitude: 10.8509000,
      longitude: 106.7719000,
    },
    {
      branch_name: "Chi nhánh Quận 5",
      address: "120 Nguyễn Trãi, Phường 3, Quận 5, TP. Hồ Chí Minh",
      phone: "0282222333",
      email: "branch8@petclinic.com",
      operating_hours: "8:00 - 21:00 (kể cả cuối tuần, lễ, Tết)",
      latitude: 10.7546000,
      longitude: 106.6634000,
    },
    {
      branch_name: "Chi nhánh Phú Nhuận",
      address: "250 Phan Đăng Lưu, Phường 3, Phú Nhuận, TP. Hồ Chí Minh",
      phone: "0284444555",
      email: "branch9@petclinic.com",
      operating_hours: "8:00 - 22:00 (kể cả cuối tuần, lễ, Tết)",
      latitude: 10.7996000,
      longitude: 106.6822000,
    },
    {
      branch_name: "Chi nhánh Quận 3",
      address: "150 Điện Biên Phủ, Phường 6, Quận 3, TP. Hồ Chí Minh",
      phone: "0286666777",
      email: "branch10@petclinic.com",
      operating_hours: "Cả ngày (24/7) kể cả cuối tuần, lễ, Tết.",
      latitude: 10.7868000,
      longitude: 106.6862000,
    }
  ];

  const createdBranches = [];
  for (const b of branchesData) {
    let branch = await prisma.branch.findFirst({ where: { branch_name: b.branch_name } });
    if (branch) {
      branch = await prisma.branch.update({
        where: { branch_id: branch.branch_id },
        data: {
          address: b.address,
          phone: b.phone,
          email: b.email,
          operating_hours: b.operating_hours,
          latitude: b.latitude,
          longitude: b.longitude,
        }
      });
    } else {
      branch = await prisma.branch.create({
        data: {
          ...b,
          status: "active"
        }
      });
    }
    createdBranches.push(branch);
  }

  const branch1 = createdBranches[0];
  const branch2 = createdBranches[1];

  // 2. Users
  const passwordHash = await bcrypt.hash('Abc12345', 10);
  
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

  await prisma.doctor.upsert({
    where: { user_id: doctor1.user_id },
    update: {},
    create: {
      user_id: doctor1.user_id,
      branch_id: branch1.branch_id,
      doctor_name: doctor1.full_name,
      bio: "Bác sĩ thú y đa khoa khám tổng quát.",
      avatar_url: "https://i.pravatar.cc/150?img=11",
      average_rating: 4.8,
      status: "active"
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

  // Create 20 STAFF
  const currentStaffCount = await prisma.user.count({
    where: { role: { role_code: 'STAFF' } }
  });
  const staffNeeded = 20 - currentStaffCount;
  if (staffNeeded > 0) {
    console.log(`Seeding ${staffNeeded} additional STAFF users...`);
    for (let i = 0; i < staffNeeded; i++) {
      const name = generateRandomName();
      const email = generateRandomEmail(name, 'STAFF', i);
      await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          full_name: name,
          phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
          avatar_url: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
          role: { connect: { role_code: 'STAFF' } },
          status: 'active'
        }
      });
    }
  }

  // Create 15 DOCTOR (4 specific ones + random ones)
  const specificDoctors = [
    {
      email: 'nhan.tran@petclinic.com',
      full_name: 'Bs. Trần Văn Nhân',
      phone: '0912345671',
      avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
      bio: 'Bác sĩ có hơn 20 năm kinh nghiệm trong lĩnh vực phẫu thuật thú y ngoại khoa và điều trị nội khoa chuyên sâu. Tốt nghiệp Thạc sĩ thú y từ Đại học Nông Lâm TP.HCM.',
      branch_id: branch1.branch_id,
      rating: 4.9
    },
    {
      email: 'nam.vo@petclinic.com',
      full_name: 'Bs. Võ Công Nam',
      phone: '0912345672',
      avatar_url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400',
      bio: '14 năm kinh nghiệm chuyên môn về chẩn đoán hình ảnh (siêu âm, X-quang) và xét nghiệm lâm sàng. Từng tu nghiệp tại Thái Lan về chẩn đoán bệnh lý thú y.',
      branch_id: branch2.branch_id,
      rating: 4.8
    },
    {
      email: 'hong.nguyen@petclinic.com',
      full_name: 'Bs. Nguyễn Thu Hồng',
      phone: '0912345673',
      avatar_url: 'https://images.unsplash.com/photo-1594824813573-246434de83fb?w=400',
      bio: '5 năm kinh nghiệm điều trị các bệnh truyền nhiễm, chăm sóc sức khỏe ban đầu, tiêm phòng và tư vấn dinh dưỡng cho thú cưng nhỏ.',
      branch_id: branch1.branch_id,
      rating: 4.7
    },
    {
      email: 'tram.tran@petclinic.com',
      full_name: 'Bs. Trần Phương Trâm',
      phone: '0912345674',
      avatar_url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400',
      bio: '7 năm kinh nghiệm chuyên về da liễu, chăm sóc nha khoa và phục hồi chức năng sau chấn thương cho chó mèo.',
      branch_id: branch2.branch_id,
      rating: 4.8
    }
  ];

  for (const doc of specificDoctors) {
    const docUser = await prisma.user.upsert({
      where: { email: doc.email },
      update: {},
      create: {
        email: doc.email,
        password_hash: passwordHash,
        full_name: doc.full_name,
        phone: doc.phone,
        avatar_url: doc.avatar_url,
        role: { connect: { role_code: 'DOCTOR' } },
        status: 'active'
      }
    });

    await prisma.doctor.upsert({
      where: { user_id: docUser.user_id },
      update: {},
      create: {
        user_id: docUser.user_id,
        branch_id: doc.branch_id,
        doctor_name: doc.full_name,
        bio: doc.bio,
        avatar_url: doc.avatar_url,
        average_rating: doc.rating,
        status: 'active'
      }
    });
  }

  // Count how many users with role DOCTOR exist in the database
  const currentDoctorCount = await prisma.user.count({
    where: { role: { role_code: 'DOCTOR' } }
  });
  const doctorNeeded = 15 - currentDoctorCount;
  if (doctorNeeded > 0) {
    console.log(`Seeding ${doctorNeeded} additional DOCTOR users...`);
    for (let i = 0; i < doctorNeeded; i++) {
      const name = "Dr. " + generateRandomName();
      const email = generateRandomEmail(name, 'DOCTOR', i);
      const user = await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          full_name: name,
          phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
          avatar_url: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
          role: { connect: { role_code: 'DOCTOR' } },
          status: 'active'
        }
      });

      const branchId = Math.random() > 0.5 ? branch1.branch_id : branch2.branch_id;
      await prisma.doctor.create({
        data: {
          user_id: user.user_id,
          branch_id: branchId,
          doctor_name: name,
          bio: "Bác sĩ thú y chuyên nghiệp tại Dr.Pet's House.",
          avatar_url: user.avatar_url,
          average_rating: parseFloat((Math.random() * 0.5 + 4.5).toFixed(1)),
          status: 'active'
        }
      });
    }
  }

  // Double check that ALL doctor users have doctor profiles (for robust seed rerun)
  const allDoctorUsers = await prisma.user.findMany({
    where: { role: { role_code: 'DOCTOR' } }
  });
  for (const u of allDoctorUsers) {
    const existingDocProfile = await prisma.doctor.findUnique({
      where: { user_id: u.user_id }
    });
    if (!existingDocProfile) {
      const branchId = Math.random() > 0.5 ? branch1.branch_id : branch2.branch_id;
      await prisma.doctor.create({
        data: {
          user_id: u.user_id,
          branch_id: branchId,
          doctor_name: u.full_name,
          bio: "Bác sĩ thú y chuyên nghiệp tại Dr.Pet's House.",
          avatar_url: u.avatar_url,
          average_rating: parseFloat((Math.random() * 0.5 + 4.5).toFixed(1)),
          status: 'active'
        }
      });
    }
  }

  // Create 35 CUSTOMER
  const currentCustomerCount = await prisma.user.count({
    where: { role: { role_code: 'CUSTOMER' } }
  });
  const customerNeeded = 35 - currentCustomerCount;
  if (customerNeeded > 0) {
    console.log(`Seeding ${customerNeeded} additional CUSTOMER users...`);
    for (let i = 0; i < customerNeeded; i++) {
      const name = generateRandomName();
      const email = generateRandomEmail(name, 'CUSTOMER', i);
      await prisma.user.create({
        data: {
          email,
          password_hash: passwordHash,
          full_name: name,
          phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
          avatar_url: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
          role: { connect: { role_code: 'CUSTOMER' } },
          status: 'active'
        }
      });
    }
  }

  // 3. Species & Breeds
  const catSpecies = await prisma.petSpecies.upsert({
    where: { species_name: 'Mèo' },
    update: {},
    create: { species_name: 'Mèo' }
  });

  const dogSpecies = await prisma.petSpecies.upsert({
    where: { species_name: 'Chó' },
    update: {},
    create: { species_name: 'Chó' }
  });

  const hamsterSpecies = await prisma.petSpecies.upsert({
    where: { species_name: 'Hamster' },
    update: {},
    create: { species_name: 'Hamster' }
  });

  const rabbitSpecies = await prisma.petSpecies.upsert({
    where: { species_name: 'Thỏ' },
    update: {},
    create: { species_name: 'Thỏ' }
  });

  await prisma.petBreed.createMany({
    data: [
      { species_id: catSpecies.species_id, breed_name: 'Mèo Anh Lông Ngắn' },
      { species_id: catSpecies.species_id, breed_name: 'Mèo Ba Tư' },
      { species_id: catSpecies.species_id, breed_name: 'Mèo Munchkin' },
      { species_id: catSpecies.species_id, breed_name: 'Mèo Xiêm' },
      { species_id: catSpecies.species_id, breed_name: 'Mèo Ragdoll' },
      { species_id: dogSpecies.species_id, breed_name: 'Poodle' },
      { species_id: dogSpecies.species_id, breed_name: 'Corgi' },
      { species_id: dogSpecies.species_id, breed_name: 'Husky' },
      { species_id: dogSpecies.species_id, breed_name: 'Golden Retriever' },
      { species_id: dogSpecies.species_id, breed_name: 'Chihuahua' },
      { species_id: dogSpecies.species_id, breed_name: 'Phú Quốc' },
      { species_id: hamsterSpecies.species_id, breed_name: 'Hamster Winter White' },
      { species_id: hamsterSpecies.species_id, breed_name: 'Hamster Roborovski' },
      { species_id: rabbitSpecies.species_id, breed_name: 'Thỏ Hà Lan' },
      { species_id: rabbitSpecies.species_id, breed_name: 'Thỏ Mini Lop' },
    ],
    skipDuplicates: true
  });

  // Fetch all breeds grouped by species for pet seeding
  const allBreeds = await prisma.petBreed.findMany();
  const breedsBySpecies = {};
  for (const b of allBreeds) {
    const key = b.species_id.toString();
    if (!breedsBySpecies[key]) breedsBySpecies[key] = [];
    breedsBySpecies[key].push(b);
  }

  const speciesList = [catSpecies, dogSpecies, hamsterSpecies, rabbitSpecies];

  const PET_NAMES_DOG = ['Lucky', 'Bông', 'Mập', 'Cún', 'Rex', 'Buddy', 'Gấu', 'Vàng', 'Đen', 'Milo', 'Lulu', 'Bin'];
  const PET_NAMES_CAT = ['Miu', 'Kitty', 'Mèo Mập', 'Luna', 'Simba', 'Tom', 'Mochi', 'Sữa', 'Bông', 'Neko', 'Miu Miu', 'Gạo'];
  const PET_NAMES_HAMSTER = ['Ham', 'Chuột', 'Bé Nhỏ', 'Peanut', 'Cookie', 'Chip'];
  const PET_NAMES_RABBIT = ['Thỏ Trắng', 'Bun Bun', 'Carrot', 'Tuyết', 'Bé Bông', 'Cotton'];

  const PET_IMAGES_DOG = [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400',
    'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=400',
    'https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?w=400',
    'https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=400',
    'https://images.unsplash.com/photo-1544568100-847a948585b9?w=400',
  ];
  const PET_IMAGES_CAT = [
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400',
    'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400',
    'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=400',
    'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400',
    'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400',
    'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400',
  ];
  const PET_IMAGES_HAMSTER = [
    'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=400',
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400',
  ];
  const PET_IMAGES_RABBIT = [
    'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=400',
    'https://images.unsplash.com/photo-1535241749838-299277c6555b?w=400',
  ];

  function getPetNamesForSpecies(speciesId) {
    if (speciesId.toString() === dogSpecies.species_id.toString()) return PET_NAMES_DOG;
    if (speciesId.toString() === catSpecies.species_id.toString()) return PET_NAMES_CAT;
    if (speciesId.toString() === hamsterSpecies.species_id.toString()) return PET_NAMES_HAMSTER;
    return PET_NAMES_RABBIT;
  }

  function getPetImagesForSpecies(speciesId) {
    if (speciesId.toString() === dogSpecies.species_id.toString()) return PET_IMAGES_DOG;
    if (speciesId.toString() === catSpecies.species_id.toString()) return PET_IMAGES_CAT;
    if (speciesId.toString() === hamsterSpecies.species_id.toString()) return PET_IMAGES_HAMSTER;
    return PET_IMAGES_RABBIT;
  }

  function randomDate(startYear, endYear) {
    const start = new Date(startYear, 0, 1);
    const end = new Date(endYear, 11, 31);
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }

  function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 3.5. Seed Pets for CUSTOMER users
  const existingPetCount = await prisma.pet.count();
  if (existingPetCount === 0) {
    console.log('Seeding pets for CUSTOMER users...');

    const allCustomers = await prisma.user.findMany({
      where: { role: { role_code: 'CUSTOMER' } },
      orderBy: { user_id: 'asc' }
    });

    const genders = ['male', 'female'];
    const healthStatuses = ['healthy', 'treating', 'need_recheck'];

    for (let idx = 0; idx < allCustomers.length; idx++) {
      const customer = allCustomers[idx];
      // First 15 customers: 1 pet each; remaining 20: 2-4 pets each
      const petCount = idx < 15 ? 1 : Math.floor(Math.random() * 3) + 2; // 2, 3, or 4

      for (let p = 0; p < petCount; p++) {
        const species = randomElement(speciesList);
        const speciesBreeds = breedsBySpecies[species.species_id.toString()] || [];
        const breed = speciesBreeds.length > 0 ? randomElement(speciesBreeds) : null;
        const petNames = getPetNamesForSpecies(species.species_id);
        const petImages = getPetImagesForSpecies(species.species_id);
        const petName = randomElement(petNames);
        const gender = randomElement(genders);
        const birthDate = randomDate(2018, 2025);
        const weightKg = parseFloat((Math.random() * 15 + 0.5).toFixed(2));
        const healthStatus = randomElement(healthStatuses);
        const profileImage = randomElement(petImages);

        const pet = await prisma.pet.create({
          data: {
            owner_user_id: customer.user_id,
            species_id: species.species_id,
            breed_id: breed ? breed.breed_id : null,
            pet_name: petName,
            gender,
            birth_date: birthDate,
            weight_kg: weightKg,
            profile_image_url: profileImage,
            health_status: healthStatus,
            status: 'active'
          }
        });

        // Create 1-2 pet images
        const img1 = randomElement(petImages);
        const imageData = [
          { pet_id: pet.pet_id, image_url: img1, is_primary: true }
        ];
        if (Math.random() > 0.4) {
          const img2 = randomElement(petImages.filter(i => i !== img1)) || img1;
          imageData.push({ pet_id: pet.pet_id, image_url: img2, is_primary: false });
        }
        await prisma.petImage.createMany({ data: imageData });
      }
    }

    const totalPets = await prisma.pet.count();
    console.log(`Seeded ${totalPets} pets total.`);
  } else {
    console.log(`Pets already exist (${existingPetCount}), skipping pet seeding.`);
  }

  // 4. Service Categories & 5. Clinic Services
  // Rename old 'Khám bệnh' to 'Khám & Điều trị' for consistency with UI.
  let serviceCatMedical = await prisma.serviceCategory.findFirst({
    where: { category_name: 'Khám bệnh' }
  });
  if (serviceCatMedical) {
    serviceCatMedical = await prisma.serviceCategory.update({
      where: { service_category_id: serviceCatMedical.service_category_id },
      data: { category_name: 'Khám & Điều trị', description: 'Khám bệnh, chẩn đoán, siêu âm, xét nghiệm và điều trị bệnh' }
    });
  } else {
    serviceCatMedical = await prisma.serviceCategory.findFirst({
      where: { category_name: 'Khám & Điều trị' }
    });
    if (!serviceCatMedical) {
      serviceCatMedical = await prisma.serviceCategory.create({
        data: {
          category_name: 'Khám & Điều trị',
          description: 'Khám bệnh, chẩn đoán, siêu âm, xét nghiệm và điều trị bệnh'
        }
      });
    }
  }

  let serviceCatSpa = await prisma.serviceCategory.findFirst({
    where: { category_name: 'Grooming & Spa' }
  });
  if (!serviceCatSpa) {
    serviceCatSpa = await prisma.serviceCategory.create({
      data: {
        category_name: 'Grooming & Spa',
        description: 'Dịch vụ tắm, spa và làm đẹp chuyên nghiệp cho thú cưng'
      }
    });
  }

  let serviceCatCombo = await prisma.serviceCategory.findFirst({
    where: { category_name: 'Combo Grooming & Spa' }
  });
  if (!serviceCatCombo) {
    serviceCatCombo = await prisma.serviceCategory.create({
      data: {
        category_name: 'Combo Grooming & Spa',
        description: 'Các gói combo chăm sóc toàn diện tiết kiệm'
      }
    });
  }

  // 18 clinic services data
  const clinicServicesData = [
    // Grooming & Spa
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Tắm & Sấy khô',
      base_price: 50000,
      duration_minutes: 45,
      description: 'Dịch vụ tắm sạch bằng sữa tắm dưỡng lông cao cấp và sấy khô, giúp loại bỏ bụi bẩn và mùi hôi.',
      image_url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Massage chuyên sâu',
      base_price: 50000,
      duration_minutes: 30,
      description: 'Massage thư giãn giảm căng thẳng, kích thích tuần hoàn máu và hỗ trợ sức khỏe xương khớp cho thú cưng.',
      image_url: 'https://images.unsplash.com/photo-1544568100-847a948585b9?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Vệ sinh răng miệng',
      base_price: 30000,
      duration_minutes: 20,
      description: 'Chải răng, loại bỏ mảng bám thức ăn và sử dụng xịt thơm miệng chuyên dụng cho thú cưng.',
      image_url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Cắt & mài móng',
      base_price: 30000,
      duration_minutes: 15,
      description: 'Cắt móng an toàn và mài mịn các góc nhọn, tránh cào xước da chủ nuôi và đồ đạc.',
      image_url: 'https://images.unsplash.com/photo-1597633425046-08f5110420b5?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Chăm sóc bàn chân',
      base_price: 30000,
      duration_minutes: 20,
      description: 'Cạo lông kẽ chân, vệ sinh sạch sẽ và thoa kem dưỡng ẩm bảo vệ đệm chân thú cưng.',
      image_url: 'https://images.unsplash.com/photo-1537151608828-ea2b117b62e4?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Điều trị ký sinh trùng',
      base_price: 80000,
      duration_minutes: 30,
      description: 'Tắm thuốc chuyên dụng loại bỏ ve, rận, bọ chét và hướng dẫn phòng ngừa tái nhiễm.',
      image_url: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Cắt tỉa tạo kiểu',
      base_price: 50000,
      duration_minutes: 60,
      description: 'Cắt tỉa và tạo kiểu lông chuyên nghiệp bởi các groomer giàu kinh nghiệm theo yêu cầu.',
      image_url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Nhuộm lông thời trang',
      base_price: 80000,
      duration_minutes: 90,
      description: 'Nhuộm màu thời trang cho tai, đuôi hoặc chân bằng màu nhuộm organic an toàn tuyệt đối cho thú cưng.',
      image_url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatSpa.service_category_id,
      service_name: 'Vắt tuyến hôi',
      base_price: 50000,
      duration_minutes: 15,
      description: 'Vắt tuyến hôi hậu môn giúp làm giảm mùi hôi đặc trưng và ngăn ngừa viêm nhiễm tuyến hôi.',
      image_url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400',
      status: 'active'
    },
    // Combo Grooming & Spa
    {
      category_id: serviceCatCombo.service_category_id,
      service_name: 'Combo Tắm 11 bước',
      base_price: 150000,
      duration_minutes: 90,
      description: 'Quy trình chăm sóc toàn diện 11 bước: 1. Khám da & lông sơ bộ; 2. Chải lông gỡ rối; 3. Cắt & mài móng; 4. Vệ sinh tai; 5. Cạo lông kẽ bàn chân; 6. Vắt tuyến hôi; 7. Tắm lần 1 (sạch sâu); 8. Tắm lần 2 (dưỡng mượt); 9. Massage nhẹ nhàng; 10. Sấy khô & chải phồng; 11. Xịt dưỡng bóng lông & nước hoa.',
      image_url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatCombo.service_category_id,
      service_name: 'Combo Tắm cơ bản & cắt tỉa lông',
      base_price: 100000,
      duration_minutes: 75,
      description: 'Gói combo tiết kiệm bao gồm dịch vụ tắm sấy thơm tho kết hợp cắt tỉa tạo kiểu gọn gàng cho thú cưng.',
      image_url: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatCombo.service_category_id,
      service_name: 'Combo Chăm sóc & bảo vệ móng',
      base_price: 80000,
      duration_minutes: 30,
      description: 'Gói chăm sóc móng chuyên biệt: cắt móng, mài mịn, vệ sinh sạch đệm chân và thoa dầu dưỡng đệm chân cao cấp.',
      image_url: 'https://images.unsplash.com/photo-1597633425046-08f5110420b5?w=400',
      status: 'active'
    },
    // Khám & Điều trị
    {
      category_id: serviceCatMedical.service_category_id,
      service_name: 'Khám & Điều trị',
      base_price: 30000,
      duration_minutes: 30,
      description: 'Khám lâm sàng tổng quát bởi bác sĩ thú y để chẩn đoán tình trạng sức khỏe và đưa ra phác đồ điều trị.',
      image_url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatMedical.service_category_id,
      service_name: 'Xét nghiệm',
      base_price: 50000,
      duration_minutes: 40,
      description: 'Xét nghiệm máu, xét nghiệm phân, hoặc soi kính hiển vi để phát hiện ký sinh trùng, virus và các bệnh lý.',
      image_url: 'https://images.unsplash.com/photo-1579154204601-01588f35116f?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatMedical.service_category_id,
      service_name: 'Siêu âm',
      base_price: 100000,
      duration_minutes: 25,
      description: 'Siêu âm ổ bụng, siêu âm thai để kiểm tra tình trạng nội tạng, phát hiện khối u hoặc theo dõi thai kỳ.',
      image_url: 'https://images.unsplash.com/photo-1579684389782-64d84b5e901a?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatMedical.service_category_id,
      service_name: 'Tiêm phòng',
      base_price: 100000,
      duration_minutes: 15,
      description: 'Tiêm vaccine phòng các bệnh truyền nhiễm nguy hiểm (dại, 5 bệnh, 7 bệnh) kèm sổ theo dõi sức khỏe.',
      image_url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatMedical.service_category_id,
      service_name: 'Phẫu thuật',
      base_price: 200000,
      duration_minutes: 120,
      description: 'Phẫu thuật ngoại khoa vô trùng: triệt sản, mổ đẻ, khâu vết thương sâu, phẫu thuật xương khớp.',
      image_url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400',
      status: 'active'
    },
    {
      category_id: serviceCatMedical.service_category_id,
      service_name: 'Cấp cứu 24/7',
      base_price: 150000,
      duration_minutes: 60,
      description: 'Dịch vụ xử lý cấp cứu khẩn cấp 24/7 đối với các trường hợp tai nạn, ngộ độc, khó đẻ hoặc suy hô hấp.',
      image_url: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400',
      status: 'active'
    }
  ];

  for (const s of clinicServicesData) {
    const existing = await prisma.service.findFirst({
      where: { service_name: s.service_name }
    });
    if (existing) {
      await prisma.service.update({
        where: { service_id: existing.service_id },
        data: {
          service_category_id: s.category_id,
          base_price: s.base_price,
          duration_minutes: s.duration_minutes,
          description: s.description,
          image_url: s.image_url,
          status: s.status
        }
      });
    } else {
      await prisma.service.create({
        data: {
          service_category_id: s.category_id,
          service_name: s.service_name,
          base_price: s.base_price,
          duration_minutes: s.duration_minutes,
          description: s.description,
          image_url: s.image_url,
          status: s.status
        }
      });
    }
  }

  // Seeding Service Pricing Matrix
  console.log('Seeding service pricing matrix...');
  const matrixPricingData = {
    // Grooming & Spa
    'Tắm & Sấy khô': [50000, 70000, 90000, 120000, 150000, 190000, 240000, 300000, null],
    'Massage chuyên sâu': [50000, 75000, 100000, 130000, 160000, 200000, 250000, 310000, null],
    'Cắt tỉa tạo kiểu': [50000, 85000, 120000, 160000, 210000, 270000, 340000, 420000, null],
    'Vắt tuyến hôi': [50000, 65000, 80000, 100000, 120000, 150000, 180000, 220000, null],
    'Điều trị ký sinh trùng': [80000, 110000, 140000, 180000, 220000, 270000, 330000, 400000, null],
    'Nhuộm lông thời trang': [80000, 120000, 170000, 230000, 300000, 380000, 480000, 600000, null],
    'Vệ sinh răng miệng': [30000, 45000, 60000, 80000, 100000, 130000, 160000, 200000, null],
    'Cắt & mài móng': [30000, 45000, 55000, 70000, 85000, 105000, 130000, 160000, null],
    'Chăm sóc bàn chân': [30000, 45000, 55000, 70000, 85000, 105000, 130000, 160000, null],
    
    // Khám & Điều trị
    'Khám & Điều trị': [30000, 45000, 60000, 80000, 100000, 130000, 160000, 200000, null],
    'Xét nghiệm': [50000, 70000, 90000, 120000, 150000, 190000, 240000, 300000, null],
    'Siêu âm': [100000, 120000, 140000, 170000, 200000, 240000, 290000, 350000, null],
    'Tiêm phòng': [100000, 115000, 130000, 150000, 175000, 205000, 240000, 280000, null],
    'Phẫu thuật': [200000, 260000, 330000, 420000, 530000, 660000, 820000, 1000000, null],
    'Cấp cứu 24/7': [150000, 180000, 210000, 250000, 300000, 360000, 430000, 520000, null],
    
    // Combo
    'Combo Tắm 11 bước': [150000, 180000, 220000, 270000, 330000, 440000, 480000, 570000, null],
    'Combo Tắm cơ bản & cắt tỉa lông': [100000, 135000, 180000, 230000, 290000, 360000, 440000, 530000, null],
    'Combo Chăm sóc & bảo vệ móng': [80000, 100000, 125000, 155000, 190000, 230000, 275000, 325000, null]
  };

  const weightRanges = [
    { min: 0, max: 3 },
    { min: 3.1, max: 5 },
    { min: 5.1, max: 8 },
    { min: 8.1, max: 12 },
    { min: 12.1, max: 15 },
    { min: 15.1, max: 20 },
    { min: 20.1, max: 25 },
    { min: 25.1, max: 30 },
    { min: 30.1, max: null }
  ];

  await prisma.servicePriceMatrix.deleteMany({});
  for (const [serviceName, prices] of Object.entries(matrixPricingData)) {
    const service = await prisma.service.findFirst({
      where: { service_name: serviceName }
    });

    if (service) {
      const createData = weightRanges.map((range, index) => {
        const price = prices[index];
        return {
          service_id: service.service_id,
          weight_min: range.min,
          weight_max: range.max,
          price: price,
          is_contact: price === null
        };
      });

      await prisma.servicePriceMatrix.createMany({
        data: createData
      });
    } else {
      console.log(`Warning: Service '${serviceName}' not found during pricing matrix seed.`);
    }
  }

  // 6. Product Categories & Products (100 products generated with weights)
  const seedData = [
  {
    "name": "Thức ăn",
    "image": "https://cdn-icons-png.flaticon.com/512/3014/3014502.png",
    "items": [
      {
        "name": "Dầu cá cho mèo WILD CAUGHT Omega-3 Fish Oil For Cats",
        "description": "Dầu cá cho mèo WILD CAUGHT Omega-3 Fish Oil For Cats là sản phẩm bổ sung omega-3 dạng lỏng dành cho mèo, hỗ trợ chăm sóc da, lông và sức khỏe tổng thể. Sản phẩm được chiết xuất từ nguồn dầu cá tự nhiên của các loài cá biển như anchovies, herring, mackerel và sardines được đánh bắt từ vùng biển lạnh, sạch gần Iceland. Thiết kế vòi pump tiện lợi giúp định lượng dễ dàng khi sử dụng mỗi ngày. Phù hợp cho nhiều giống mèo, từ mèo con đến mèo trưởng thành.\nLợi ích chính\nSản phẩm cung cấp nguồn omega-3 ...",
        "price": 283000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2026/03/dau-ca-cho-meo-wild-caught-omega-3-fish-oil-for-cats1.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2026/03/dau-ca-cho-meo-wild-caught-omega-3-fish-oil-for-cats2.jpg"
      },
      {
        "name": "Thức ăn cho chó con vị cá hồi JIREHO Salmon Puppy",
        "description": "Thức ăn cho chó con vị cá hồi JIREHO Salmon Puppy là giải pháp dinh dưỡng toàn diện đến từ Hàn Quốc, được thiết kế riêng cho chó dưới 1 tuổi. Với thành phần chính là cá hồi giàu Omega-3 và sự kết hợp từ thịt gà, sản phẩm mang đến nguồn năng lượng lành mạnh, hỗ trợ phát triển toàn diện về trí não, thể lực và hệ tiêu hóa cho bé cún.\nLợi ích chính\n\nCông thức đa protein từ cá hồi và thịt gà giúp tăng cường calo và hỗ trợ tăng trưởng nhanh.\nProbiotics và nấm men giúp cân bằng hệ vi sinh đường ruột, h...",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-cho-con-vi-ca-hoi-jireho-salomon-puppy.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-cho-con-vi-ca-hoi-jireho-salomon-puppy2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ, cá bào nhật &#038; ức gà",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ, cá bào nhật &amp; ức gà Tuna, Bonito &amp; Chicken Breast dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ, cá bào nhật &amp; ức gà bao gồm Katsuo, cá ngừ, dầu đậu nành, chiết xuất Katsuo-bushi, Oligosaccharide, polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-bao-nhat-uc-ga.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-bao-nhat-uc-ga.jpg"
      },
      {
        "name": "Bánh thưởng cho chó BOWWOW Carrot Cheesee Ball",
        "description": "Bánh thưởng cho chó BOWWOW Carrot Cheesee Ball làm từ 100% phô mai nguyên chất và cà rốt, giàu protein và canxi, vitamin A, là món ăn nhẹ bổ dưỡng cho các chú chó, nhất là các chú chó con đang phát triển hệ cơ xương và chó mẹ cần phục hồi thể trạng sau khi sau con. Snack có thể dùng được cho cả chó và mèo.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nLà món ăn nhẹ tuyệt vời cho cả chó và mèo\nThành phần: Phô mai, cà rốt, tinh bột bắp, vitamin, khoáng chất\nGiảm tỷ lệ cholesterol xấu trong ...",
        "price": 70000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/bowwow-carrot-cheesee-ball.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/bowwow-carrot-cheesee-ball.jpg"
      },
      {
        "name": "Snack bánh thưởng cho chó BOWWOW Mixed Sandwich",
        "description": "Snack bánh thưởng cho chó BOWWOW Mixed Sandwich là bánh thưởng đã được các huấn luyện viên sử dụng để huấn luyện chó hiệu quả. Đây cũng là món ăn nhẹ bổ dưỡng cho các chú chó, nhất là chó con và chó mẹ sau khi sinh con cần bổ sung dinh dưỡng bên cạnh các món ăn thường ngày.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Gà, cá hồi, rau củ, phô mai, can-xi, rong biển nâu, lúa mì, xơ đậu tương (bánh đậu tương), axit ...",
        "price": 60000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bow-wow-mixed-sandwich.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bow-wow-mixed-sandwich.jpg"
      },
      {
        "name": "Dụng cụ ăn uống cho chó mèo PAW tự động đa năng",
        "description": "Dụng cụ ăn uống cho chó mèo PAW tự động đa năng là sản phẩm dành cho tất cả giống chó và mèo.\nLợi ích chính\n\nDụng cụ ăn uống cho chó mèo PAW tự động đa năng sang trọng với thiết kế 2 chức năng vô cùng tiện lợi cho thú cưng của bạn dùng để bảo quản thức ăn không bị ỉu hỏng giúp thú cưng ăn ngon miệng hơn\nBình nước uống có thể điều chỉnh cao thấp hợp lý với mọi giống chó mèo\nĐặc biệt chức năng cấp nước uống tự động chảy nước ra khi thú cưng uống hết nhằm đảm bảo giữ vệ sinh sạch sẽ cho nước uống\nB...",
        "price": 430000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2014/12/dung-cu-an-uong-cho-cho-meo-paw-tu-dong-da-nang.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2014/12/Dung-cu-an-uong-cho-cho-meo-tu-dong-da-nang1.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Peanut Butter",
        "description": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Peanut Butter hương vị bơ đậu phộng dành cho tất cả các giống chó.\nLợi ích chính\nGel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Peanut Butter For Dog bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chún...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-peanut-butter.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-peanut-butter.jpg"
      },
      {
        "name": "Thức ăn cho chó hạt mềm vị cá hồi ORIGI-7 Salmon",
        "description": "Thức ăn cho chó hạt mềm vị cá hồi ORIGI-7 Salmon được làm từ cá hồi tươi, kết hợp với các nguyên liệu hữu cơ cao cấp, đảm bảo an toàn và giàu dinh dưỡng. Với công thức đặc biệt từ BOWWOW Hàn Quốc, ORIGI-7 không chỉ mang lại một bữa ăn thơm ngon mà còn giúp thú cưng phát triển toàn diện. Sản phẩm thích hợp cho mọi giống chó và mọi lứa tuổi, từ chó con đến chó trưởng thành.\nĐặc điểm nổi bật\n\nThành phần 100% thịt thật, 70% nguyên liệu hữu cơ, đạt tiêu chuẩn nghiêm ngặt.\nCông thức 7 FREE: KHÔNG bột ...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-ca-hoi-origi7-salmon.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-ca-hoi-origi7-salmon.jpg"
      },
      {
        "name": "Thức ăn cho chó con hạt mềm ZENITH Puppy Chicken Potato",
        "description": "Thức ăn cho chó con hạt mềm ZENITH Puppy Chicken &amp; Potato được chế biến từ các nguyên liệu tươi sạch như thịt cừu, thịt nạc gà rút xương, gạo lứt, yến mạch và dầu cá hồi, cung cấp độ ẩm cao và lượng muối thấp. Sản phẩm không chỉ thơm ngon, dễ nhai và dễ tiêu hóa mà còn đặc biệt tốt cho sức khỏe và sự phát triển của chó con dưới 1 tuổi.\nĐặc điểm nổi bật\n\nKhông chứa ngũ cốc, không gây dị ứng.\nThành phần chính từ thịt cừu, bột gà, gạo lứt và yến mạch.\nGiúp giảm mùi phân và mùi cơ thể, hỗ trợ ti...",
        "price": 240000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/zenith-puppy-chicken-potato.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/zenith-puppy-chicken-potato.jpg"
      },
      {
        "name": "Thức ăn cho chó hữu cơ NATURAL CORE Duck Potato Organic",
        "description": "Thức ăn cho chó hữu cơ NATURAL CORE Duck &amp; Potato Organic thịt vịt được chế biến từ các loại thịt tươi và các nguyên liệu được chứng nhận hữu cơ ECOCERT: thịt vịt astaxanthin, rau bina, khoai lang, các loại ngũ cốc hữu cơ… Với nhiều chất dinh dưỡng tốt cho sức khỏe thú cưng, ECO2 có tác dụng nổi bật với hệ tiêu hóa, làm giảm mệt mỏi cho đôi mắt chú chó.\n\nDành cho các giống chó thuộc mọi lứa tuổi, cân nặng\nTạo sự ngon miệng, tối đa hóa khả năng hấp thụ\nThành phần: thịt vịt astaxanthin, rau bi...",
        "price": 250000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-duck-potato-organic.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-duck-potato-organic2.jpg"
      },
      {
        "name": "Bộ vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Dental Trial Kit",
        "description": "Bộ vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Dental Trial Kit dành cho tất cả các giống chó mèo.\nLợi ích chính\nBộ vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Dental Trial Kit bao gồm gel và nước vệ sinh cho răng sạch và miệng khỏe mạnh. Chai gel chăm sóc răng miệng giúp loại bỏ mảng bám và cao răng. Nhỏ 2 giọt vào mỗi bên miệng của chó hàng ngày theo chỉ dẫn để thấy răng sạch hơn sau 30 ngày hoặc ít hơn. Giúp mang lại hơi thở thơm mát rõ rệt trong vòng 14 ngày hoặc ít hơn khi sử ...",
        "price": 195000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/bo-ve-sinh-rang-mieng-cho-cho-tropiclean-fresh-breath-dental-trial-kit.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/bo-ve-sinh-rang-mieng-cho-cho-tropiclean-fresh-breath-dental-trial-kit.jpg"
      },
      {
        "name": "Nước súc miệng hỗ trợ tiêu hóa cho chó TROPICLEAN Dental Health Digestive",
        "description": "Nước súc miệng hỗ trợ tiêu hóa cho chó TROPICLEAN Dental Health Digestive dành cho tất cả các giống chó.\nLợi ích chính\nNước súc miệng hỗ trợ tiêu hóa cho chó TROPICLEAN Dental Health Digestive bao gồm: nước tinh khiết, Axit citric, Cetylpyridinium Chloride, Chlorophyllin, Glycerin, Natri Benzoate, Axit béo Omega 3 và 6, chiết xuất từ ​​lá trà xanh giúp chăm sóc răng miệng cho thú cưng của bạn hiệu quả. Đó là một trong những vấn đề cần quan tâm khi nuôi chó mèo. Trên thực tế, 80% chó cưng bắt đầu...",
        "price": 360000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-ho-tro-tieu-hoa-cho-cho-tropiclean-dental-health-digestive.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-ho-tro-tieu-hoa-cho-cho-tropiclean-dental-health-digestive.jpg"
      },
      {
        "name": "Nước súc miệng dưỡng lông cho chó TROPICLEAN Dental Skin Health",
        "description": "Nước súc miệng dưỡng lông cho chó TROPICLEAN Dental Skin Health dành cho tất cả các giống chó.\nLợi ích chính\nNước súc miệng dưỡng lông cho chó TROPICLEAN Dental Skin Health bao gồm: nước tinh khiết, Axit citric, Cetylpyridinium Chloride, Chlorophyllin, Glycerin, Natri Benzoate, Axit béo Omega 3 và 6, chiết xuất từ ​​lá trà xanh giúp chăm sóc răng miệng cho thú cưng của bạn hiệu quả. Đó là một trong những vấn đề cần quan tâm khi nuôi chó. Trên thực tế, 80% chó cưng bắt đầu có các dấu hiệu của bện...",
        "price": 360000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-duong-long-cho-cho-tropiclean-dental-skin-health.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-duong-long-cho-cho-tropiclean-dental-skin-health.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó con TROPICLEAN Clean Teeth Gel Puppy",
        "description": "Gel vệ sinh răng miệng cho chó con TROPICLEAN Clean Teeth Gel Puppy phù hợp với những chú cho con 12 tuần tuổi trở lên.\nLợi ích chính\nGel vệ sinh răng miệng cho chó con TROPICLEAN Clean Teeth Gel Puppy với thành phần nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, bạc hà cay, chất tẩy rửa tự nhiên, Kẽm clorua (0,01g/10ml), chiết xuất lá trà xanh, chất diệp lục.\nChăm sóc răng miệng không chỉ là làm cho răng miệng của thú cưng sáng bóng, chắc chắn hơn mà nó là một thành phần quan trọ...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-con-tropiclean-clean-teeth-gel-puppy.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-con-tropiclean-clean-teeth-gel-puppy.jpg"
      },
      {
        "name": "Dung dịch vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Drops",
        "description": "Dung dịch vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Drops for Dogs dành cho tất cả các giống chó.\nLợi ích chính\nDung dịch vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Drops for Dogs với các thành phần bao gồm nước tinh khiết, Glycerin, Cetylpyridinum Clorua, Kali Sorbate, Axit Citric, chiết xuất lá trà xanh, chất diệp lục giữ cho răng miệng của thú cưng của bạn luôn khỏe mạnh và hơi thở thơm tho. Được phát triển với các thành phần tự nhiên, Fresh Breath Drops giúp biến hơi thở có ...",
        "price": 250000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/dung-dich-ve-sinh-rang-mieng-cho-cho-tropiclean-fresh-breath-drops-for-dogs-0.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/dung-dich-ve-sinh-rang-mieng-cho-cho-tropiclean-fresh-breath-drops-for-dogs-1.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà và thanh cua",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà và thanh cua Chicken Breast &amp; Crab Sticks dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà và thanh cua bao gồm: Thịt gà (Sashimi), Kamaboko hương cua, tinh bột, Polysaccharide làm đặc, Vitamin E, chiết xuất trà xanh Protein thô &lt; 14,0%, chất béo thô &gt; 0,7%, chất xơ thô &lt; 0,1% trở xuống, hàm lượng tro thô từ &lt; 2,0% trở xuống, hàm lượng nước &lt; 83,0%, năng lượng 55 kcal/lon. Hạn sử dụng 3 năm kể từ ngày ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-va-thanh-cua.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-va-thanh-cua2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ &#038; cá ngần trắng",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ &amp; cá ngần trắng Tuna &amp; Small Whitebait dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ &amp; cá ngần trắng A-01C bao gồm cá ngừ, Shirasu, tinh bột, Polysaccharide làm đặc, Vitamin E, chiết xuất trà xanh&#8230; Thành phần phân tích đảm bảo Protein thô &gt; 13,0% trở lên, chất béo thô &gt; 0,5% trở lên, chất xơ thô &gt; 0,1%, hàm lượng tro thô &lt; 1,0% trở xuống, hàm lượng nước &lt; 85,0% trở xuống, năng lượng ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-ngan-trang.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-ngan-trang2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ &#038; thịt gà",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ &amp; thịt gà Tuna &amp; Chiken dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ &amp; thịt gà được làm từ các thành phần nguyên liệu tươi ngon từ tự nhiên.Thành phần chính bao gồm: Thịt gà, cá ngừ, Shirasu, chiết xuất cá ngừ, đường (Oligosaccharides), dầu và mỡ thực vật, chất làm đặc (tinh bột đã qua chế biến), khoáng chất, gia vị, Axit Amin, Polysaccharides làm đặc, Vitamin E, màu đỏ Sắc tố Koji, chiết xuất trà xanh,...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-thit-ga.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-thit-ga.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ &#038; cá bào nhật",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ &amp; cá bào nhật Tuna &amp; Bonito Flakes dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ &amp; cá bào nhật được làm từ các thành phần nguyên liệu tươi ngon từ tự nhiên.Thành phần chính bao gồm: Thịt gà, cá ngừ, Kamaboko hương cua, chiết xuất cá ngừ, đường (Oligosaccharides), dầu và mỡ thực vật, chất làm đặc (tinh bột đã qua chế biến), khoáng chất, gia vị, Axit Amin, Polysaccharides làm đặc, Vitamin E, màu đỏ Sắc tố ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-bao-nhat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-bao-nhat.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Bonito Chicken",
        "description": "Pate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Bonito Chicken Wet Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Bonito Chicken Wet Cat Food bao gồm cá ngừ, thịt gà, muối, Taurine, Carrageenan. Phân tích thành phần Protein thô trên 7%, chất béo thô &gt; 1,5%, xơ thô &gt; 0,3%, tro thô &lt; 0,5%, độ ẩm &lt; 84%....",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-thit-ga-iris-bonito-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-iris2.jpg"
      },
      {
        "name": "Súp thưởng cho mèo vị gà và tôm IRIS OHYAMA Chicken Shrimp Soup",
        "description": "Súp thưởng cho mèo vị gà và tôm IRIS OHYAMA Chicken Shrimp Soup dành cho tất cả các giống mèo trên 3 tháng tuổi.\nLợi ích chính\n\nSúp thưởng cho mèo vị gà và tôm IRIS OHYAMA Chicken Shrimp Soup có thể rút ngắn khoảng cách giữa bạn và thú cưng.\nCác loại thảo mộc và ngũ cốc hỗn hợp tạo nên món ăn vừa ngon vừa bổ.\nTạo sự ngon miệng và dễ tiêu hóa.\nCân bằng dinh dưỡng, tươi ngon mỗi ngày.\n\nCách sử dụng\n\nĐối với mèo con: 1 – 2 gói/ngày.\nĐối với mèo trưởng thành: 3 – 4 gói/ngày....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ga-va-tom-iris-chicken-shrimp-soup1.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ga-va-tom-iris-chicken-shrimp-soup1.jpg"
      },
      {
        "name": "Súp thưởng cho mèo vị cá hồi IRIS OHYAMA Salmon Soup",
        "description": "Súp thưởng cho mèo vị cá hồi IRIS OHYAMA Salmon Soup dành cho tất cả các giống mèo trên 3 tháng tuổi.\nLợi ích chính\n\nSúp thưởng cho mèo vị cá hồi IRIS OHYAMA Salmon Soup có thể rút ngắn khoảng cách giữa bạn và thú cưng.\nCác loại thảo mộc và ngũ cốc hỗn hợp tạo nên món ăn vừa ngon vừa bổ.\nTạo sự ngon miệng và dễ tiêu hóa.\nCân bằng dinh dưỡng, tươi ngon mỗi ngày.\n\nCách sử dụng\n\nĐối với mèo con: 1 &#8211; 2 gói/ngày.\nĐối với mèo trưởng thành: 3 &#8211; 4 gói/ngày....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-hoi-iris-salmon-soup8.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-hoi-iris-salmon-soup8.jpg"
      },
      {
        "name": "Pate cho chó vị bò và rau IRIS OHYAMA HRBV375 Beef Vegetable",
        "description": "Pate cho chó vị bò và rau IRIS OHYAMA HRBV375 Beef Vegetable dành cho tất cả các giống chó. Bảo quản sản phẩm nơi khô ráo và thoáng mát. Thời hạn sử dụng 24 tháng kể từ ngày sản xuất.\nThành phần dinh dưỡng\nPate cho chó vị bò và rau IRIS OHYAMA HRBV375 Beef Vegetable bao gồm: gà, bò, cà rốt thái sợi, đậu nành xanh… Cung cấp đầy đủ dưỡng chất cho thú cưng trong mỗi bữa ăn.\nCách sử dụng\n\n\n\nTrọng lượng\nLượng ăn\n\n\n5 kg\n1 gói / ngày\n\n\n5-10 kg\n2 gói / ngày\n\n\n10-20 kg\n4 gói / ngày\n\n\n20-40 kg\n&gt; 4 gói ...",
        "price": 85000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-bo-va-rau-iris-hrbv375-beef-vegetable3.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-bo-va-rau-iris-hrbv375-beef-vegetable4.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và cua IRIS OHYAMA Tuna Crab",
        "description": "Pate cho mèo vị cá ngừ và cua IRIS OHYAMA Tuna Crab Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và cua IRIS OHYAMA Tuna Crab Cat Food bao gồm cá ngừ, thịt cua, Protein thực vật, Xylooligosaccharides, taurine. Phân tích thành phần: hơn 9% Protein, chất béo trên 1%, chất xơ thô dưới 0,5%. Độ ẩm dưới 82%.\nHạn sử dụng: 2 năm kể từ ngày sản xuất....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-cua-iris-tuna-crab.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-cua-iris-tuna-crab-cat-food1.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ IRIS OHYAMA Tuna",
        "description": "Pate cho mèo vị cá ngừ IRIS OHYAMA Tuna Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ IRIS OHYAMA Tuna Cat Food bao gồm cá ngừ, Protein thực vật, Xylooligosaccharides, taurine. Phân tích thành phần: hơn 9% Protein, chất béo trên 1%, chất xơ thô dưới 0,5%. Độ ẩm dưới 82%.\nHạn sử dụng: 2 năm kể từ ngày sản xuất....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-iris-tuna.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-iris-tuna-cat-food1.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và cá chub IRIS OHYAMA Tuna Chub",
        "description": "Pate cho mèo vị cá ngừ và cá chub IRIS OHYAMA Tuna Chub Wet Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và cá chub IRIS OHYAMA Tuna Chub Wet Cat Food bao gồm cá ngừ, cá chub họ nhà cá chép, Protein đậu nành, muối, taurine, cà rốt, carrageenan. Thành phần Protein thô  &gt; 7%, chất béo thô &lt; 2,5%, chất xơ thô &lt; 0,6% tro thô. Độ ẩm &lt; 1%, độ ẩm &lt; 84%....",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-ca-chub-iris-tunas-chub.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-iris2.jpg"
      },
      {
        "name": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN5M",
        "description": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN5M phù hợp với tất cả các giống chó cỡ trung bình và lớn. Sản phẩm có 5 chiếc xương thơm ngon trong 1 túi.\nLợi ích chính\nXương canxi da bò cho chó vị sữa IRIS OHYAMA GN5M được làm bằng da bò, không có sản phẩm phụ từ da, không thêm chất màu. Tạo cảm giác ngon miệng và mùi thơm sữa tươi. Thành phần sữa, giúp răng chắc khỏe đồng thời có mùi thơm của sữa, lưu giữ hơi thở thơm mát. Đặc biệt hiệu quả ngăn chặn các mảng bám trên răng. Hạn sử dụng 16 tháng...",
        "price": 145000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-cho-vi-sua-iris-gn5m.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-iris.jpg"
      },
      {
        "name": "Pate cho mèo vị thịt trộn CATIDEA Variety Of Meat",
        "description": "Pate cho mèo vị thịt trộn CATIDEA Variety Of Meat dành cho tất cả các giống mèo, thích hợp cho mèo ở mọi lứa tuổi. Đặc biệt thích hợp cho mèo mẹ bầu, mèo con, mèo có vóc dáng còi cọc, đường ruột kém&#8230;\nThành phần dinh dưỡng\nPate cho mèo vị thịt trộn CATIDEA Variety Of Meat được làm từ các loại thịt tự nhiên: thịt bò, thịt gà, bí ngô, cà rốt và nguyên liệu thực vật....",
        "price": 60000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-thit-tron-catidea-variety-meat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-thit-tron-catidea-variety-of-meat1.jpg"
      },
      {
        "name": "Đồ chơi mèo bằng cói PAW hình chuột size XL",
        "description": "Đồ chơi mèo bằng cói PAW hình chuột size XL là bộ sản phẩm dành cho tất cả giống mèo.\nLợi ích chính\nĐồ chơi mèo bằng cói PAW hình chuột size XL với chất liệu bằng cói tự nhiên rất an toàn và không gây độc hại. Không những chỉ có tính năng làm đồ chơi, sản phẩm còn giúp mèo của bạn trở nên hoạt bát hơn, năng động hơn. Đồng thời còn có tác dụng để kích thích và định hướng mèo cào mài móng của mình, tránh làm hỏng hóc các đồ vật trong nhà. Đặc biệt nó còn gây tiếng động có tác dụng kích thích sự tò...",
        "price": 150000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-meo-bang-coi-paw-hinh-chuot-size-xl.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-meo-bang-coi-paw-hinh-chuot-size-xl.jpg"
      },
      {
        "name": "Dây dắt cho chó kèm xích đai ngực HAND IN HAND",
        "description": "Dây dắt cho chó kèm xích đai ngực HAND IN HAND là sản phẩm dành cho tất cả giống chó.\nLợi ích chính\n\nDây dắt cho chó kèm xích đai ngực HAND IN HAND được làm bằng sợi Polypropylene\nXích cương ngực cho phép kiểm soát tự nhiên hơn và thoải mái hơn cho chú chó\nĐược thiết kế phong cách đơn giản, dễ dàng và an toàn khi sử dụng\nXích cương ngực có lớp mềm làm giảm sự rụng lông của chó. Với khóa nhựa có tác động cao\nDây dắt cho chó kèm xích đai ngực có nhiều mầu sắc cho bạn chọn lựa\nChiều dài dây dắt là ...",
        "price": 100000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2018/12/day-dat-cho-cho-kem-xich-dai-nguc-hand-in-hand.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2018/12/day-dat-cho-cho-kem-xich-dai-nguc-hand-in-hand-1.jpg"
      },
      {
        "name": "Xương gặm cho chó Poodle VEGEBRAND 360 For Poodles Bone",
        "description": "Xương gặm cho chó Poodle VEGEBRAND 360 For Poodles Bone vị thịt vịt phù hợp với giống chó Poodle trong mọi giai đoạn phát triển.\nLợi ích chính\n\nXương gặm cho chó Poodle VEGEBRAND 360 For Poodles Bone với thành phần dinh dưỡng từ thiên nhiên không độc hại.\nCó thể bổ sung dinh dưỡng.\nNhai lâu tăng hiệu quả matxa răng.\nLoại bỏ mảng bám và cao răng.\nThúc đẩy hoạt động đường ruột, hỗ trợ tiêu hóa.\nXương gặm loại bỏ vị khác lạ ở miệng.\nCó thể làm đồ ăn để huấn luyện.\nHấp dẫn thú cưng, làm tinh thần th...",
        "price": 50000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-gam-cho-cho-poodle-vegebrand-360-for-poodles-bone.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-gam-cho-cho-poodle-vegebrand-360-for-poodles-bone.jpg"
      },
      {
        "name": "Xương cho chó gặm thơm miệng VEGEBRAND 360 Fresh Breath Bone",
        "description": "Xương cho chó gặm thơm miệng VEGEBRAND 360 Fresh Breath Bone thích hợp với: chó kích thước nhỏ, kích thước trung bình và kích thước lớn. Sử dụng: cho ăn trực tiếp, hoặc có thể dùng làm đồ ăn khi huấn luyện hoặc khen thưởng.\nLợi ích chính\n\nThiết kế hình lập thể: hình lập thể có lợi cho việc làm sạch răng, còn có hiệu quả loại bỏ mảng bám cứng đầu, làm sạch bộ phận nướu.\nXương cho chó thơm miệng BONE Fresh Breath với nguyên liệu tự nhiên: đặc biệt có thêm bột sữa, gluten, cám lúc mạch, với nguồn d...",
        "price": 50000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-thom-mieng-vegebrad-360-fresh-breath-bone.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-thom-mieng-vegebrad-360-fresh-breath-bone.jpg"
      },
      {
        "name": "Xương cho chó gặm vị thịt bò VEGEBRAND 360 Delicious Beef Bone",
        "description": "Xương cho chó gặm vị thịt bò VEGEBRAND 360 Delicious Beef Bone thích hợp với các giống chó có kích thước nhỏ, kích thước trung bình và kích thước lớn. Có thể sử dụng cho chó ăn trực tiếp, hoặc có thể dùng làm đồ ăn khi huấn luyện.\nLợi ích chính\n\nXương cho chó gặm vị thịt bò VEGEBRAND 360 Delicious Beef Bone có lợi cho việc làm sạch răng, còn có hiệu quả loại bỏ mảng bám cứng đầu, có thể thâm nhập vào bộ phận nướu, loại bỏ cao răng, có thể tiếp xúc được cả phần mặt trong của răng, loại bỏ những v...",
        "price": 50000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-vi-thit-bo-vegebrand-360-delicious-beef-bone.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-vi-thit-bo-vegebrand-360-delicious-beef-bone.jpg"
      },
      {
        "name": "Xương cho chó gặm vị sữa VEGEBRAND 360 Calcium Milk Bone",
        "description": "Xương cho chó gặm vị sữa VEGEBRAND 360 Calcium Milk Bone thích hợp với: chó kích thước nhỏ, kích thước trung bình và kích thước lớn. Sản phẩm giống như bánh thưởng cho chó, có thể sử dụng: cho ăn trực tiếp, hoặc có thể dùng làm đồ ăn khi huấn luyện hoặc khen thưởng.\nLợi ích chính\n\nVEGEBRAND 360 Calcium Milk Bone với thiết kế hình lập thể: hình lập thể có lợi cho việc làm sạch răng, còn có hiệu quả loại bỏ mảng bám cứng đầu, làm sạch bộ phận nướu.\nNguyên liệu tự nhiên: đặc biệt có thêm bột sữa, G...",
        "price": 50000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-vi-sua-vegebrand-360-calcium-milk-bone.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-vi-sua-vegebrand-360-calcium-milk-bone.jpg"
      },
      {
        "name": "Miếng lót cho chó đi vệ sinh IRIS OHYAMA Clean Pet Sheets CPS-42",
        "description": "Miếng lót cho chó đi vệ sinh IRIS OHYAMA Clean Pet Sheets CPS-42 được dùng cho tất cả giống chó. Cả bịch nguyên có 42 miếng.\nMiếng lót cho chó đi vệ sinh là một sản phẩm chất lượng cao được thiết kế đặc biệt để giúp cho việc vệ sinh cho thú cưng của bạn trở nên dễ dàng và thuận tiện hơn. Với các tính năng tiên tiến như chất liệu chống thấm, độ bền cao và khả năng hấp thụ mùi hôi, Miếng lót IRIS không chỉ giúp giữ cho không gian sống của bạn luôn sạch sẽ và khô ráo mà còn giúp giảm thiểu mùi hôi ...",
        "price": 10000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/mieng-lot-cho-cho-di-ve-sinh-iris-clean-pet-sheets-cps-42.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/mieng-lot-cho-cho-di-ve-sinh-iris-clean-pet-sheets-cps-42.jpg"
      },
      {
        "name": "Miếng lót cho chó đi vệ sinh IRIS OHYAMA Clean Pet Sheets CPS-88",
        "description": "Miếng lót cho chó đi vệ sinh IRIS OHYAMA Clean Pet Sheets CPS-88 được dùng cho tất cả các giống chó. Cả bịch nguyên có 88 miếng.\nMiếng lót IRIS là một sản phẩm chất lượng cao được thiết kế đặc biệt để giúp cho việc vệ sinh cho chó trở nên dễ dàng hơn. Sản phẩm được làm từ vật liệu chất lượng, không gây kích ứng da và thân thiện với môi trường. Miếng lót này có khả năng thấm hút tối đa, giúp cho chất lỏng và mùi hôi không bị lan ra ngoài. Đặc biệt, sản phẩm có thiết kế chống tràn, giúp ngăn chặn ...",
        "price": 5000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/mieng-lot-cho-cho-di-ve-sinh-iris-clean-pet-sheets-cps88.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/mieng-lot-cho-cho-di-ve-sinh-iris-clean-pet-sheets-cps88.jpg"
      },
      {
        "name": "Đồ chơi cho chó mèo bằng bông chút chít ELITE hình ốc sên",
        "description": "Đồ chơi cho chó mèo bằng bông chút chít ELITE hình ốc sên là sản phẩm dành cho tất cả giống chó.\nLợi ích chính\n\nĐồ chơi cho chó mèo bằng bông chút chít ELITE hình ốc sên hình rùa được sản xuất từ cao su mềm không gây độc hại cho thú cưng.\nLà món đồ giúp thú cưng ở trong nhà mà không cảm thấy nhàm chán khi bị bỏ lại một mình. Món đồ chơi đặc biệt dễ thương này không chỉ giúp chú chó giải trí mà còn bảo vệ những thứ quan trọng cho bạn như giày dép, bàn ghế, tủ…\nMàu sắc như thật, âm thanh chút chít...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-cho-cho-meo-bang-bong-chut-chit-elite-hinh-oc-sen.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-cho-cho-meo-bang-bong-chut-chit-elite-hinh-oc-sen.jpg"
      },
      {
        "name": "Đồ chơi cho chó mèo bằng bông chút chít ELITE hình gấu",
        "description": "Đồ chơi cho chó mèo bằng bông chút chít ELITE hình gấu là sản phẩm dành cho tất cả giống chó.\n\nLợi ích chính\n\nĐồ chơi cho chó mèo bằng bông chút chít ELITE hình gấu được sản xuất từ cao su mềm không gây độc hại cho thú cưng.\nLà món đồ giúp thú cưng ở trong nhà mà không cảm thấy nhàm chán khi bị bỏ lại một mình. Món đồ chơi đặc biệt dễ thương này không chỉ giúp chú chó giải trí mà còn bảo vệ những thứ quan trọng cho bạn như giày dép, bàn ghế, tủ…\nMàu sắc như thật, âm thanh chút chít đáng yêu sẽ k...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-cho-cho-meo-bang-bong-chut-chit-elite-hinh-gau.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-cho-cho-meo-bang-bong-chut-chit-elite-hinh-gau.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ nguyên chất CAT SEA FISH Pure Tuna Meat",
        "description": "Pate cho mèo vị cá ngừ nguyên chất CAT SEA FISH Pure Tuna Meat là thức ăn dinh dưỡng cho mèo phù hợp với tất cả các giống và độ tuổi.\nLợi ích chính\nCAT SEA FISH Pure Tuna Meat là một sản phẩm cho sức khỏe. Với dưỡng chất Axit béo trong cá ngừ là các axit béo không bão hòa. Chứa đầy đủ các axit amin đối với cơ thể. Với 8 loại axit amin cần thiết, vitamin, chất sắt, kali, canxi, iốt và các nguyên tố vi lượng khác.\nCá ngừ chứa nhiều DHA. Nó là chất dinh dưỡng thiết yếu cho bộ não cũng như cho sự ph...",
        "price": 30000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/pate-cho-meo-vi-ca-ngu-nguyen-chat-cat-sea-fish-pure-tuna-meat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/pate-cho-meo-vi-ca-ngu-nguyen-chat-cat-sea-fish-pure-tuna-meat1.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ cá cơm CAT SEA FISH Tuna Anchovy",
        "description": "Pate cho mèo vị cá ngừ cá cơm CAT SEA FISH Tuna Anchovy có giá trị dinh dưỡng cao. Phù hợp với tất cả các giống mèo.\nLợi ích chính\nTheo phân tích, một trăm gram CAT SEA FISH Tuna Anchovy có chứa 18-20,1g protein. Chất béo 5,0 g chất khoáng 2,0-2,5 gam. Ngoài ra, có VA, VE. Protein có chứa 16 loại axit amin cơ thể cần. Glutamate và glycine có trong giúp tạo nên hương vị cá cơm tươi ngon. Mỡ cá cơm chứa hai loại axit docosahexaenoic (DHA) và axit eicosapentaenoic (EPA). Cả hai loại axit béo không ...",
        "price": 30000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/pate-cho-meo-vi-ca-com-cat-sea-fish-tuna-anchovy.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/pate-cho-meo-vi-ca-ngu-ca-com-cat-sea-fish-tuna-anchovy.jpg"
      }
    ]
  },
  {
    "name": "Đồ dùng thiết yếu",
    "image": "https://cdn-icons-png.flaticon.com/512/815/815042.png",
    "items": [
      {
        "name": "Dầu cá cho chó WILD CAUGHT Omega-3 Fish Oil For Dogs",
        "description": "Dầu cá cho chó WILD CAUGHT Omega-3 Fish Oil For Dogs là sản phẩm bổ sung omega-3 dạng lỏng dành cho chó, hỗ trợ chăm sóc da, lông và sức khỏe tổng thể. Sản phẩm được chiết xuất từ nguồn dầu cá tự nhiên của các loài cá biển như anchovies, herring, mackerel và sardines. Thiết kế vòi pump tiện lợi giúp định lượng dễ dàng khi sử dụng hằng ngày. Phù hợp cho nhiều giống chó với kích cỡ và độ tuổi khác nhau.\nLợi ích chính\nSản phẩm giúp nuôi dưỡng làn da khỏe mạnh, hỗ trợ bộ lông mềm mượt và bóng đẹp hơ...",
        "price": 283000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2026/03/dau-ca-cho-cho-wild-caught-omega-3-fish-oil-for-dogs1.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2026/03/dau-ca-cho-cho-wild-caught-omega-3-fish-oil-for-dogs2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà và cá bào nhật",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà và cá bào nhật Chicken Breast &amp; Bonito dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà và cá bào nhật bao gồm thịt gà, cá ngừ, sò điệp, dầu đậu nành, chiết xuất Katsuo-Bushi, Oligosaccharide, Polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống,...",
        "price": 37000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-va-ca-bao-nhat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-va-ca-bao-nhat.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ &#038; sò điệp",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ &amp; sò điệp Tuna &amp; Scallop Flavor dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ &amp; sò điệp bao gồm Katsuo, cá ngừ, chiết xuất sò điệp, chiết xuất cá ngừ. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, khoảng 35 kcal/miếng....",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-so-diep.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-so-diep.jpg"
      },
      {
        "name": "Bánh thưởng cho chó BOWWOW Cheddar Cheese Ball",
        "description": "Bánh thưởng cho chó BOWWOW Cheddar Cheese Ball làm từ 100% phô mai nguyên chất, giàu protein và canxi, là món ăn nhẹ bổ dưỡng cho các chú chó, nhất là các chú chó con đang phát triển hệ cơ xương và chó mẹ cần phục hồi thể trạng sau khi sau con. Snack có thể dùng được cho cả chó và mèo.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nLà món ăn nhẹ tuyệt vời cho cả chó và mèo\nThành phần: Phô mai, tinh bột bắp, vitamin, khoáng chất\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo ph...",
        "price": 70000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/bowwow-cheddar-cheese-ball.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/bowwow-cheddar-cheese-ball.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó BOWWOW Soft Chicken",
        "description": "Que bánh thưởng cho chó BOWWOW Soft Chicken được làm từ thịt gà rút xương, chứa nhiều protein, vitamin và khoáng chất, giúp chó tăng cường cơ bắp và chắc khỏe xương khớp. Sản phẩm có lượng chất béo, muối và calo thấp, không gây béo phì, tim mạch, sỏi thận. Đây là snack thơm ngon với thành phần dinh dưỡng tốt cho sức khỏe thú cưng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nThịt gà rút xương mùi thơm hấp dẫn, kích thích chó ăn ngon miệng\nThành phần: Thịt gà rút xương, bột thịt, bột cá, ...",
        "price": 65000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bow-wow-soft-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bow-wow-soft-chicken.jpg"
      },
      {
        "name": "Pate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Carrot Oat",
        "description": "Pate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Carrot Oat đóng hộp dạng mềm được kết hợp bởi các nguyên liệu tươi ngon như ức gà, yến mạch và cà rốt giúp bổ sung đầy đủ dinh dưỡng cho thú cưng.\nLợi ích chính\nPate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Carrot Oat cung cấp các nguyên liệu thô, cân bằng Protein, ít chất béo và đầy đủ dinh dưỡng&#8230; giúp giải phóng vị giác của cún cưng. Sản phẩm giàu năng lượng với tỷ lệ khoa học giúp duy trì sức khỏe của xương. Kết hợp nhiều loại rau quả gi...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-cho-tron-vi-iris-aiwang-chicken-carrot-oat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-cho-tron-vi-iris-aiwang1.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Vanilla Mint",
        "description": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Vanilla Mint dành cho tất cả các giống chó.\nLợi ích chính\nGel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Vanilla Mint bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chúng. Trên thực tế, 70% mèo và 80% ...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-vanilla-mint.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-vanilla-mint.jpg"
      },
      {
        "name": "Pate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Pumpkin Carrot",
        "description": "Pate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Pumpkin Carrot đóng hộp dạng mềm được kết hợp bởi các nguyên liệu tươi ngon như ức gà, bí đỏ và cà rốt giúp bổ sung đầy đủ dinh dưỡng cho thú cưng.\nLợi ích chính\nPate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Pumpkin Carrot cung cấp các nguyên liệu thô, cân bằng Protein, ít chất béo và đầy đủ dinh dưỡng&#8230; giúp giải phóng vị giác của cún cưng. Sản phẩm giàu năng lượng với tỷ lệ khoa học giúp duy trì sức khỏe của xương. Kết hợp nhiều loại rau q...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-cho-tron-vi-iris-aiwang-chicken-pumpkin-carrot.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-cho-tron-vi-iris-aiwang1.jpg"
      },
      {
        "name": "Sữa tắm khô cho mèo TROPICLEAN Berry &#038; Coconut Waterless",
        "description": "Sữa tắm khô cho mèo TROPICLEAN Berry &amp; Coconut Waterless Cat Shampoo dành cho tất cả các giống mèo.\nLợi ích ích\nSữa tắm khô cho mèo TROPICLEAN Berry &amp; Coconut Waterless Cat Shampoo với thành phần nước tinh khiết chất tẩy rửa dịu nhẹ, Protein thực vật thủy phân, chất trung hòa mùi. Hỗn hợp hữu cơ bao gồm chiết xuất mận trắng, chiết xuất dưa chuột, bột yến mạch Avena Sativa làm sạch triệt để và dưỡng ẩm cho lông và da. Đồng thời giúp bộ lông của thú cưng mềm mại, sạch sẽ và có mùi thơm bền...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sua-tam-kho-cho-meo-tropiclean-berry-coconut-waterless-cat-shampoo.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sua-tam-kho-cho-meo-tropiclean-berry-coconut-waterless-cat-shampoo.jpg"
      },
      {
        "name": "Thức ăn cho chó hữu cơ NATURAL CORE Lamb Potato Organic",
        "description": "Thức ăn cho chó hữu cơ NATURAL CORE Lamb &amp; Potato Organic thịt cừu được chế biến từ các loại thịt tươi và các nguyên liệu được chứng nhận hữu cơ ECOCERT: thịt Cừu, rau bina, các loại ngũ cốc hữu cơ. Với nhiều chất dinh dưỡng tốt cho sức khỏe thú cưng, ECO1 có tác dụng nổi bật với hệ tiêu hóa, da và lông chú chó.\n\nDành cho các giống chó thuộc mọi lứa tuổi, cân nặng\nThành phần: thịt Cừu, rau bina, khoai lang hữu cơ, các loại ngũ cốc hữu cơ\nTạo sự ngon miệng, tối đa hóa khả năng hấp thụ\nĐặc biệ...",
        "price": 250000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-lamb-potato-organic.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-lamb-potato-organic1.jpg"
      },
      {
        "name": "Nước súc miệng cho mèo TROPICLEAN Dental Health Solution",
        "description": "Nước súc miệng cho mèo TROPICLEAN Dental Health Solution For Cat dành cho tất cả các giống mèo.\nLợi ích chính\nNước súc miệng cho mèo TROPICLEAN Dental Health Solution bao gồm nước tinh khiết, Axit citric, Cetylpyridinium Chloride, Chlorophyllin, Glycerin, Natri Benzoate, Axit béo Omega 3 và 6, chiết xuất từ ​​lá trà xanh giúp chăm sóc răng miệng cho thú cưng của bạn hiệu quả. Đó là một trong những vấn đề cần quan tâm khi nuôi chó mèo. Trên thực tế, 70% mèo cưng bắt đầu có các dấu hiệu của bệnh r...",
        "price": 360000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-cho-meo-tropiclean-dental-health-solution.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-cho-meo-tropiclean-dental-health-solution.jpg"
      },
      {
        "name": "Nước súc miệng hỗ trợ xương khớp cho chó TROPICLEAN Dental Health Hip Joint",
        "description": "Nước súc miệng hỗ trợ xương khớp cho chó TROPICLEAN Dental Health Hip Joint phù hợp với tất cả các giống chó.\nLợi ích chính\nNước súc miệng hỗ trợ xương khớp cho chó TROPICLEAN Dental Health Hip Joint với các thành phần nước tinh khiết, Axit citric, Cetylpyridinium Chloride, Chlorophyllin, Glycerin, Natri Benzoat, Glucosamine, chiết xuất lá trà xanh giúp chăm sóc sức khỏe răng miệng cho thú cưng vô cùng hiệu quả. Trên thực tế, 80% chó và 70% mèo bắt đầu có dấu hiệu của bệnh răng miệng khi tuổi lê...",
        "price": 360000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-ho-tro-xuong-khop-cho-cho-tropiclean-dental-health-hip-joint.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-ho-tro-xuong-khop-cho-cho-tropiclean-dental-health-hip-joint.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho mèo TROPICLEAN Clean Teeth Gel Oral Care",
        "description": "Gel vệ sinh răng miệng cho mèo TROPICLEAN Clean Teeth Gel Oral Carel for Cats dành cho tất cả các giống mèo.\nLợi ích chính\nGel vệ sinh răng miệng cho mèo TROPICLEAN Clean Teeth Gel Oral Care bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chúng. Trên thực tế, 70% mèo bắt...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-meo-tropiclean-clean-teeth-gel-oral-care.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-meo-tropiclean-clean-teeth-gel-oral-care.jpg"
      },
      {
        "name": "Dung dịch vệ sinh răng miệng cho mèo TROPICLEAN Fresh Breath Drops",
        "description": "Dung dịch vệ sinh răng miệng cho mèo TROPICLEAN Fresh Breath Drops for Cats dành cho tất cả các giống mèo.\nLợi ích chính\nDung dịch vệ sinh răng miệng cho mèo TROPICLEAN Fresh Breath Drops for Cats bao gồm nước tinh khiết, Glycerin, Cetylpyridinum Clorua, Kali Sorbate, Axit Citric, chiết xuất lá trà xanh, chất diệp lục giữ cho miệng mèo của bạn khỏe mạnh và hơi thở thơm tho. Được phát triển với các thành phần tự nhiên, Fresh Breath DROPS for Cats giúp chứng hôi miệng của mèo trở nên thơm tho hơn....",
        "price": 250000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/dung-dich-ve-sinh-rang-mieng-cho-meo-tropiclean-fresh-breath-drops-for-cats.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/dung-dich-ve-sinh-rang-mieng-cho-meo-tropiclean-fresh-breath-drops-for-cats-1.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ và mực biển",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ và mực biển Bonito &amp; Squid dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ và mực biểnbao gồm: Katsuo, Katsuo-bushi, đường (Oligosaccharides), chất béo và dầu thực vật, khoáng chất, Polysaccharide làm đặc, gia vị (Axit Amin), Vitamin E, chiết xuất trà xanh. Thành phần phân tích Protein thô &gt; 12,5%, chất béo thô &gt; 0,3%, chất xơ thô &lt; 0,1% trở xuống, hàm lượng tro thô &lt; 1,8% trở xuống, hàm lượng nước &lt...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-va-muc-bien.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-va-muc-bien2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà &#038; sò điệp",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà &amp; sò điệp Chicken Breast &amp; Scallop dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà &amp; sò điệp bao gồm Katsuo, sò điệp, chiết xuất từ ​​vỏ sò, tinh bột, Polysaccharide làm đặc, chất làm đặc (tinh bột đã qua xử lý), Vitamin E, chiết xuất trà xanh. Thành phần phân tích bảo đảm Protein thô &gt; 13,5%, chất béo thô &gt; 0,3% , chất xơ thô &lt; 0,1%, hàm lượng tro thô &lt; 1,3% trở xuống, hàm lượng nước &lt; 85,0% ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-so-diep.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-so-diep2.jpg"
      },
      {
        "name": "Máy sấy lông chó mèo chuyên dụng CHUNZHOU 2800w A22-2300",
        "description": "Máy sấy lông chó mèo chuyên dụng CHUNZHOU 2800w A22-2300 với vỏ ABS, công suất 2800W giúp làm khô lông chó mèo nhanh chóng.\nLợi ích chính\nMáy sấy lông chó mèo chuyên dụng CHUNZHOU 2800w A22-2300 với 3 ống thổi gió giúp điều chỉnh lượng gió phù hợp, làm khô lông chó mèo nhanh chóng qua từng lớp lông. Đặc biệt là những thú cưng có bộ lông dày. Phích cắm tiêu chuẩn 3 lỗ an toàn hơn và thuận tiện hơn khi sử dụng. Tốc độ gió đạt 65m/s. Nhiệt độ điều chỉnh ở 3 tốc độ, dễ dàng điều chỉnh tốc độ gió và ...",
        "price": 170000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/may-say-long-cho-meo-chuyen-dung-chunzhou-2800w-a22-2300.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/may-say-long-cho-meo-chuyen-dung-chunzhou-2800w-a22-2300-1.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ, thịt gà &#038; sò điệp",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ, thịt gà &amp; sò điệp Tuna &amp; Chicken &amp; Scallop dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ, thịt gà &amp; sò điệp được làm từ các thành phần nguyên liệu tươi ngon từ tự nhiên.Thành phần chính bao gồm thịt cá ngừ, thịt sò, thêm thịt gà và các hương vị thơm ngon. Thành phần phân tích đảm bảo Protein thô &gt; 6,5%, chất béo thô &gt; 0,2% trở lên, chất xơ thô &lt; 0,1%, hàm lượng tro thô &lt; 1,0% trở xuống, ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-thit-ga-so-diep.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-thit-ga-so-diep.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Tuna Chicken",
        "description": "Pate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Tuna Chicken Wet Cat Food dành co tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Tuna Chicken Wet Cat Food bao gồm cá ngừ, thịt gà, Protein đậu nành, muối, taurine, cà rốt, carrageenan. Thành phần Protein thô  &gt; 7%, chất béo thô &lt; 2,5%, chất xơ thô &lt; 0,6% tro thô. Độ ẩm &lt; 1%, độ ẩm &lt; 84%....",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-thit-ga-iris-tuna-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-iris2.jpg"
      },
      {
        "name": "Súp thưởng cho mèo vị cá thu IRIS OHYAMA Bonito Soup",
        "description": "Súp thưởng cho mèo vị cá thu IRIS OHYAMA Bonito Soup dành cho tất cả các giống mèo trên 3 tháng tuổi.\n\nLợi ích chính\n\nSúp thưởng cho mèo vị cá thu IRIS OHYAMA Bonito Soup có thể rút ngắn khoảng cách giữa bạn và thú cưng.\nCác loại thảo mộc và ngũ cốc hỗn hợp tạo nên món ăn vừa ngon vừa bổ.\nTạo sự ngon miệng và dễ tiêu hóa.\nCân bằng dinh dưỡng, tươi ngon mỗi ngày.\n\nCách sử dụng\n\nĐối với mèo con: 1 – 2 gói/ngày.\nĐối với mèo trưởng thành: 3 – 4 gói/ngày....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-thu-iris-bonito-soup.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-thu-iris-bonito-soup.jpg"
      },
      {
        "name": "Súp thưởng cho mèo vị cá ngừ IRIS OHYAMA Tuna Soup",
        "description": "Súp thưởng cho mèo vị cá ngừ IRIS OHYAMA Tuna Soup dành cho tất cả các giống mèo trên 3 tháng tuổi.\nLợi ích chính\n\nSúp thưởng cho mèo vị cá ngừ IRIS OHYAMA Tuna Soup có thể rút ngắn khoảng cách giữa bạn và thú cưng.\nCác loại thảo mộc và ngũ cốc hỗn hợp tạo nên món ăn vừa ngon vừa bổ.\nTạo sự ngon miệng và dễ tiêu hóa.\nCân bằng dinh dưỡng, tươi ngon mỗi ngày.\n\nCách sử dụng\n\nĐối với mèo con: 1 – 2 gói/ngày.\nĐối với mèo trưởng thành: 3 – 4 gói/ngày....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-ngu-iris-tuna-soup5.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-ngu-iris-tuna-soup5.jpg"
      },
      {
        "name": "Pate cho chó vị thịt bò IRIS OHYAMA HRB375 Beef",
        "description": "Pate cho chó vị thịt bò IRIS OHYAMA HRB375 Beef dành cho tất cả các giống chó. Bảo quản sản phẩm nơi khô ráo và thoáng mát. Thời hạn sử dụng 24 tháng kể từ ngày sản xuất.\nThành phần dinh dưỡng\nPate cho chó vị thịt bò IRIS OHYAMA HRB375 Beef bao gồm: thịt gà và thịt bò. Cung cấp đầy đủ dưỡng chất cho thú cưng trong mỗi bữa ăn.\nCách sử dụng\n\n\n\nTrọng lượng\nLượng ăn\n\n\n5 kg\n1 gói / ngày\n\n\n5-10 kg\n2 gói / ngày\n\n\n10-20 kg\n4 gói / ngày\n\n\n20-40 kg\n&gt; 4 gói / ngày...",
        "price": 85000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-thit-bo-iris-hrb375-beef3.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-thit-bo-iris-hrb375-beef4.jpg"
      },
      {
        "name": "Pate cho chó vị gà và rau IRIS OHYAMA HRCV375 Chicken Vegetable",
        "description": "Pate cho chó vị gà và rau IRIS OHYAMA HRCV375 Chicken Vegetable dành cho tất cả các giống chó. Bảo quản sản phẩm nơi khô ráo và thoáng mát. Thời hạn sử dụng 24 tháng kể từ ngày sản xuất.\nThành phần dinh dưỡng\nPate cho chó vị gà và rau IRIS OHYAMA HRCV375 Chicken Vegetable bao gồm: thịt gà, thịt bò, miếng cà rốt, đậu nành xanh&#8230; Cung cấp đầy đủ dưỡng chất cho thú cưng trong mỗi bữa ăn.\nCách sử dụng\n\n\n\nTrọng lượng\nLượng ăn\n\n\n5 kg\n1 gói / ngày\n\n\n5-10 kg\n2 gói / ngày\n\n\n10-20 kg\n4 gói / ngày\n\n\n2...",
        "price": 85000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-ga-va-rau-iris-hrcv375-chicken-vegetable6.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-ga-va-rau-iris-hrcv375-chicken-vegetable2.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và gà IRIS OHYAMA Tuna Chicken",
        "description": "Pate cho mèo vị cá ngừ và gà IRIS OHYAMA Tuna Chicken Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và gà IRIS OHYAMA Tuna Chicken Cat Food bao gồm cá ngừ, thịt gà, Protein thực vật, Xylooligosaccharides, taurine. Phân tích thành phần: hơn 9% Protein, chất béo trên 1%, chất xơ thô dưới 0,5%. Độ ẩm dưới 82%.\nHạn sử dụng: 2 năm kể từ ngày sản xuất....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-ga-iris-tuna-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-ga-iris-tuna-chicken-cat-food1.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ IRIS OHYAMA Bonito Tuna",
        "description": "Pate cho mèo vị cá ngừ IRIS OHYAMA Bonito Tuna Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ IRIS OHYAMA Bonito Tuna Cat Food bao gồm: cá ngừ, muối, Taurine, Carrageenan. Phân tích thành phần Protein thô trên 7%, chất béo thô &gt; 1,5%, xơ thô &gt; 0,3%, tro thô &lt; 0,5%, độ ẩm &lt; 84%....",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-iris-bonito-tuna.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-iris2.jpg"
      },
      {
        "name": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN3L",
        "description": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN3L phù hợp với tất cả các giống chó cỡ lớn với 3 miếng xương thơm ngon trong 1 túi.\nLợi ích chính\nXương canxi da bò cho chó vị sữa IRIS OHYAMA GN3L được làm bằng da bò, không có sản phẩm phụ từ da, không thêm chất màu. Tạo cảm giác ngon miệng và mùi thơm sữa tươi. Thành phần sữa, giúp răng chắc khỏe đồng thời có mùi thơm của sữa, lưu giữ hơi thở thơm mát. Đặc biệt hiệu quả ngăn chặn các mảng bám trên răng. Hạn sử dụng 16 tháng....",
        "price": 145000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-cho-vi-sua-iris-gn3l.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-iris.jpg"
      },
      {
        "name": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN8S",
        "description": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN8S phù hợp với tất cả các giống chó cỡ nhỏ, trung bình và lớn với 8 miếng xương nhỏ thơm ngon trong 1 túi.\nLợi ích chính\nXương canxi da bò cho chó vị sữa IRIS OHYAMA GN8S được làm bằng da bò, không có sản phẩm phụ từ da, không thêm chất màu. Tạo cảm giác ngon miệng và mùi thơm sữa tươi. Thành phần sữa, giúp răng chắc khỏe đồng thời có mùi thơm của sữa, lưu giữ hơi thở thơm mát. Đặc biệt hiệu quả ngăn chặn các mảng bám trên răng. Hạn sử dụng 16 tháng...",
        "price": 145000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-cho-vi-sua-iris-gn8s.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-iris.jpg"
      },
      {
        "name": "Pate cho mèo mẹ và mèo con CATIDEA Mother &#038; Baby Cat",
        "description": "Pate cho mèo mẹ và mèo con CATIDEA Mother &amp; Baby Cat dành cho tất cả các giống mèo, mèo mẹ đang mang thai, đang cho con bú và mèo con.\nThành phần dinh dưỡng\nSản phẩm được làm từ nguyên liệu hoàn toàn tự nhiên. Bao gồm nhiều loại trái cây và rau củ. Không cho thêm ngũ cốc và tinh bột. Thành phần dinh dưỡng chính bao gồm: nước, thịt gà, cá ngừ, cá hồi, thịt bò, cà rốt, miền nam: dưa, cá tươi, cá mòi, dầu nành, Gelatin, Vitamin và khoáng chất, nước sốt, Choline Chloride.\nHướng dẫn sử dụng\nPate ...",
        "price": 30000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-me-va-meo-con-catidea-mother-baby-cat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-me-va-meo-con-catidea-mother-baby-cat2.jpg"
      },
      {
        "name": "Dây dắt cho chó kèm vòng đeo cổ HAND IN HAND Plain Color Double Layers",
        "description": "Dây dắt cho chó kèm vòng đeo cổ HAND IN HAND Plain Color Double Layers là sản phẩm dành cho tất cả giống chó.\nLợi ích chính\n\nDây dắt cho chó kèm vòng đeo cổ HAND IN HAND Plain Color Double Layers được làm bằng chất liệu 100% nylon\nVới thiết kế mang phong cách truyền thống và cổ điển từ xích đeo cổ đến dây dắt\nTay nắm dây dắt và xích đeo cổ chó có lớp cao su tổng hợp làm cho chú chó cảm thấy thoải mái, không bị khó chịu\nBên cạnh đó, có mút mềm tránh ma sát cho thú cưng. Còn làm giảm sự rụng lông ...",
        "price": 200000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2018/12/day-dat-cho-cho-kem-vong-deo-co-hand-in-hand-plain-color-double-layers.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2018/12/day-dat-cho-cho-kem-vong-deo-co-hand-in-hand-plain-color-double-layers-3.jpg"
      },
      {
        "name": "Vòng cổ cho chó gắn chuông kèm dây dắt HAND IN HAND",
        "description": "Vòng cổ cho chó gắn chuông kèm dây dắt HAND IN HAND là sản phẩm dành cho tất cả giống chó.\nLợi ích chính\n\nVòng cổ cho chó gắn chuông kèm dây dắt HAND IN HAND được làm bằng chất liệu 100% nylon.\nVới thiết kế đơn giản mang phong cách cổ điển.\nDây có khóa nhựa an toàn dễ mở và khóa.\nSản phẩm không gây khó chịu cho chú chó khi mang chúng.\nVới chiếc chuông nhỏ tạo ra âm thanh chắc chắc sẽ làm thú cưng thích thú.\nVòng cổ cho chó gắn chuông kèm dây dắt có nhiều màu sắc đa dạng để bạn chọn lựa.\nKích thư...",
        "price": 130000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2018/12/vong-co-cho-cho-gan-chuong-kem-day-dat-hand-in-hand-0.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2018/12/vong-co-cho-cho-gan-chuong-kem-day-dat-hand-in-hand-4.jpg"
      }
    ]
  },
  {
    "name": "Chăm sóc sức khỏe",
    "image": "https://cdn-icons-png.flaticon.com/512/2966/2966453.png",
    "items": [
      {
        "name": "Thức ăn cho mèo con vị cá ngừ JIREHO Tuna Kitten",
        "description": "Thức ăn cho mèo con vị cá ngừ JIREHO Tuna Kitten là lựa chọn tối ưu cho giai đoạn phát triển đầu đời. Sản phẩm cung cấp nguồn đa dạng protein từ cá ngừ và thịt gà, giúp hỗ trợ quá trình tăng trưởng và phát triển toàn diện.\nLợi ích chính\n\nLợi khuẩn đường ruột và nấm men được bổ sung giúp cải thiện hệ tiêu hoá, đặc biệt phù hợp với mèo con có hệ tiêu hoá nhạy cảm.\nNgoài ra, vitamin và khoáng chất thiết yếu giúp củng cố sức đề kháng, hỗ trợ phát triển thị lực, da và lông khỏe mạnh.\n\nThành phần dinh...",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-meo-con-vi-ca-ngu-jireho-tuna-kitten.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-meo-con-vi-ca-ngu-jireho-tuna-kitten2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà &amp; hương sò điệp",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà &amp; hương sò điệp Chicken Breast &amp; Scallop Flavor dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà &amp; hương sò điệp bao gồm thịt gà, cá ngừ, sò điệp, dầu đậu nành, chiết xuất Katsuo-Bushi, Oligosaccharide, Polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt...",
        "price": 37000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-huong-so-diep.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-huong-so-diep.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ nguyên chất",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ nguyên chất Tuna Recipe dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ nguyên chất bao gồm Katsuo, cá ngừ, lưỡi dẹt, chiết xuất Katsuo-Bushi Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, khoảng 35 kcal/miếng....",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-nguyen-chat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-nguyen-chat.jpg"
      },
      {
        "name": "Snack bánh thưởng cho chó BOWWOW Cheese Roll Chicken",
        "description": "Snack bánh thưởng cho chó BOWWOW Cheese Roll Chickencó thành phần chính là thịt gà và phô mai, giàu protein và dưỡng chất. Đây là món ăn nhẹ bổ dưỡng cho cả chó và mèo, nhất là chó con và chó mẹ sau khi sinh con. Hương vị thơm ngon, hấp dẫn, chứa lượng chất béo và muối thấp.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Phô mai, gà, cá, lúa mì, xơ đậu tương (bánh đậu tương), axit amin liên kết và những nguyên liệu...",
        "price": 60000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bowwow-cheese-roll-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bowwow-cheese-roll-chicken.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó BOWWOW Soft Salmon",
        "description": "Que bánh thưởng cho chó BOWWOW Soft Salmon được làm từ cá hồi tươi, chứa nhiều vitamin và khoáng chất, đặc biệt là omega-3, taurine, giúp tăng thị lực và tăng khả năng học hỏi của thú cưng. Sản phẩm có lượng chất béo, muối và calo thấp, không gây béo phì, tim mạch, sỏi thận. Đây là snack thơm ngon với thành phần dinh dưỡng tốt cho sức khỏe thú cưng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nHương vị cá hồi hấp dẫn, kích thích chó ăn ngon miệng\nThành phần: Cá hồi tươi, bột thịt, bột đậ...",
        "price": 65000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/banh-thuong-cho-cho-bow-wow-soft-salmon.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/banh-thuong-cho-cho-bow-wow-soft-salmon.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Oral Care",
        "description": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Oral Care for Dog dành cho tất cả các giống chó.\nLợi ích chính\nGel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Oral Care bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chúng. Trên thực tế, 70% mèo và 80...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-oral-care.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-oral-care.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Berry Fresh",
        "description": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Berry Fresh For Dog hương vị quả mọng dành cho tất cả các giống chó.\nLợi ích chính\nGel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Berry Fresh bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chúng. Trên ...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-berry-fresh.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-berry-fresh.jpg"
      },
      {
        "name": "Xịt khử mùi hôi miệng cho chó TROPICLEAN Peanut Fresh Oral Care Spray",
        "description": "Xịt khử mùi hôi miệng chó TROPICLEAN Peanut Fresh Oral Care Spray mùi vị bơ đậu phộng dành cho tất cả các giống chó.\nLợi ích chính\nXịt khử mùi hôi miệng chó hương bơ đậu phộng TROPICLEAN Peanut Fresh Oral Care Spray bao gồm: nước tinh khiết, Glycerin, cồn chiết xuất tự nhiên, hương vị, Axit citric, chiết xuất lá trà xanh, kẽm clorua (0,01g/10ml), chất diệp lục. Hôi miệng có thể là một trong những dấu hiệu đầu tiên của bệnh răng miệng. Trên thực tế, 80% chó và 70% mèo có dấu hiệu mắc bệnh răng mi...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-huong-bo-dau-phong-tropiclean-peanut-fresh-oral-care-spray.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-huong-bo-dau-phong-tropiclean-peanut-fresh-oral-care-spray-1.png"
      },
      {
        "name": "Pate cho mèo vị cá ngừ IRIS OHYAMA Love Meow Tuna",
        "description": "Pate cho mèo vị cá ngừ IRIS OHYAMA Love Meow Tuna đóng hộp là thực phẩm ướt bổ sung đầy đủ các chất dinh dưỡng cho mèo cần thiết.\nLợi ích chính\nPate cho mèo vị cá ngừ IRIS OHYAMA Love Meow Tuna với hương vị tươi ngon không chứa phẩm màu, không chất hấp dẫn. Có thể sử dụng kết hợp ăn riêng hoặc trộn với thức ăn hạt. Tỷ lệ khoa học, dinh dưỡng cân bằng. Sản phẩm được sản xuất bởi nguyên liệu an toàn, cân bằng đạm cao, ít béo và đầy đủ dinh dưỡng. Kết hợp với nhiều loại rau giúp thúc đẩy sự thấp th...",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-meo-vi-ca-ngu-iris-love-meow-tuna.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-meo-vi-ca-ngu-iris-love-meow-tuna2.jpg"
      },
      {
        "name": "Xịt khử mùi hôi miệng cho chó TROPICLEAN Berry Fresh Oral Care Spray",
        "description": "Xịt khử mùi hôi miệng chó hương quả mọng TROPICLEAN Berry Fresh Oral Care Spray dành cho tất cả các giống chó.\nLợi ích chính\nXịt khử mùi hôi miệng chó hương quả mọng TROPICLEAN Berry Fresh Oral Care Spray bao gồm nước tinh khiết, Glycerin, cồn chiết xuất tự nhiên, hương vị, Axit citric, chiết xuất lá trà xanh, kẽm clorua (0,01g/10ml), chất diệp lục. Hôi miệng có thể là một trong những dấu hiệu đầu tiên của bệnh răng miệng. Trên thực tế, 80% chó và 70% mèo có dấu hiệu mắc bệnh răng miệng ở độ tuổ...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-huong-qua-mong-tropiclean-berry-fresh-oral-care-spray.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-huong-qua-mong-tropiclean-berry-fresh-oral-care-spray-1.jpg"
      }
    ]
  },
  {
    "name": "Đồ chơi",
    "image": "https://cdn-icons-png.flaticon.com/512/2610/2610993.png",
    "items": [
      {
        "name": "Thức ăn cho mèo mọi lứa tuổi vị thịt gà JIREHO Chicken",
        "description": "Thức ăn cho mèo mọi lứa tuổi vị thịt gà JIREHO Chicken là giải pháp dinh dưỡng toàn diện dành cho mèo ở mọi lứa tuổi, hỗ trợ phát triển khỏe mạnh từ trong ra ngoài. Với nguồn thịt gà tươi ngon kết hợp cùng dầu cá, khoáng chất, lợi khuẩn và chiết xuất thảo mộc, sản phẩm mang đến bữa ăn vừa thơm ngon, vừa tốt cho hệ tiêu hóa, da lông và sức đề kháng.\nLợi ích chính\n\nJIREHO Chicken hỗ trợ tiêu hóa tối ưu nhờ probiotics và nấm men.\nDầu cá giàu Omega giúp lông mượt, da khỏe, tim mạch tốt.\nChiết xuất t...",
        "price": 110000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-meo-moi-lua-tuoi-vi-thit-ga-jireho-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-meo-moi-lua-tuoi-vi-thit-ga-jireho-chicken.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà &amp; cá mòi",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà &amp; cá mòi Chicken Breast &amp; Sardines  dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà &amp; cá mòi bao gồm Katsuo, cá ngừ, cá mòi, dầu đậu nành, chiết xuất Katsuo-Bushi, Oligosaccharide, Polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, kh...",
        "price": 37000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-ca-moi.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-ca-moi.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá bào nhật",
        "description": "Nước sốt pate cho mèo CIAO vị cá bào nhật Bonito Formula dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá bào nhật bao gồm thịt gà (sasami), cá ngừ, tinh bột, chiết xuất cá ngừ, chiết xuất hải sản, Polysaccharide làm dày, Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, khoảng 35 kcal/miếng....",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-bao-nhat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-bao-nhat.jpg"
      },
      {
        "name": "Snack bánh thưởng cho chó BOWWOW Cheese Roll Salmon",
        "description": "Snack bánh thưởng cho chó BOWWOW Cheese Roll Salmon có thành phần chính là cá hồi và phô mai, giàu protein và dưỡng chất. Đây là món ăn nhẹ bổ dưỡng cho cả chó và mèo, nhất là chó con và chó mẹ sau khi sinh con. Hương vị thơm ngon, hấp dẫn, chứa lượng chất béo và muối thấp.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Phô mai, gà, cá, lúa mì, xơ đậu tương (bánh đậu tương), axit amin liên kết và những nguyên liệu ...",
        "price": 60000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bowwow-cheese-roll-salmon.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bowwow-cheese-roll-salmon.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó BOWWOW Stick Jerky Beef",
        "description": "Que bánh thưởng cho chó BOWWOW Stick Jerky Beef được làm từ thịt bò tươi Úc và New Zealand, chứa nhiều vitamin và khoáng chất, giúp hỗ trợ việc huấn luyện chó và nâng cao khả năng học hỏi của chó. Sản phẩm có dạng mềm, thơm ngon, có hàm lượng chất béo, muối và calo thấp.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nThành phần: thịt bò tươi từ Úc và New Zealand, cá ngừ, bột mì, bột đậu nành, gia vị, vitamin, khoáng chất\nHương vị bò sấy thơm ngon\nChứa nhiều vitamin và khoáng chất\nĐược sản ...",
        "price": 40000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bow-wow-stick-jerky-beef.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bow-wow-stick-jerky-beef.jpg"
      },
      {
        "name": "Cát vệ sinh hữu cơ cho mèo CATS BEST Original",
        "description": "Cát vệ sinh hữu cơ cho mèo CATS BEST Original vón cục, thấm hút chất lỏng gấp 7 lần thể tích cát, khóa chặt mùi hôi và vi khuẩn trong một thời gian dài nhờ hệ thống mao dẫn của sợi cây, giải pháp tiết kiệm và an toàn cho cả người, mèo và môi trường.\n\nĐược làm từ 100% cây hữu cơ thiên nhiên, có hương thơm tự nhiên của gỗ\nCực kỳ tiết kiệm, sau khi xúc bỏ phần cát chứa chất thải, phần cát còn lại có thể dùng tiếp trong 5-7 tuần\nVón cục, thấm hút lượng chất lỏng lớn gấp 7 lần thể tích của hạt\nKhử mù...",
        "price": 140000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/cats-best-original.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/cats-best-original.jpg"
      },
      {
        "name": "Thức ăn cho chó hạt mềm vị thịt cừu ORIGI-7 Lamb",
        "description": "Thức ăn cho chó hạt mềm vị thịt cừu ORIGI-7 Lamb được làm từ thịt cừu Úc tươi ngon, kết hợp với các nguyên liệu hữu cơ cao cấp, mang lại dinh dưỡng cân bằng và an toàn cho thú cưng. Với công thức độc quyền từ nhà máy BOWWOW Hàn Quốc, sản phẩm không chỉ thơm ngon mà còn hỗ trợ sự phát triển toàn diện cho mọi giống chó ở mọi độ tuổi, từ chó con đến chó trưởng thành.\nĐặc điểm nổi bật\n\nThành phần 100% thịt thật, 70% nguyên liệu hữu cơ, đảm bảo tiêu chuẩn nghiêm ngặt.\nCông thức 7 FREE: KHÔNG bột thịt...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-thit-cuu-origi-7-lamb.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-thit-cuu-origi-7-lamb.jpg"
      },
      {
        "name": "Thức ăn cho chó lớn hạt mềm ZENITH Adult Lamb Potato",
        "description": "Thức ăn cho chó lớn hạt mềm ZENITH Adult Lamb Potato được chế biến từ các thành phần giàu dinh dưỡng như thịt cừu tươi, thịt nạc gà rút xương, gạo lứt, yến mạch và dầu cá hồi. Sản phẩm cung cấp độ ẩm cao, ít muối, hạt mềm dễ nhai và dễ tiêu hóa, đặc biệt tốt cho sức khỏe và phát triển của chó trưởng thành trên 1 tuổi.\nĐặc điểm nổi bật\n\nKhông chứa ngũ cốc, không gây dị ứng.\nGiúp xương khớp chắc khỏe, phòng ngừa loãng xương.\nGiảm mùi phân và mùi cơ thể, duy trì vóc dáng cân đối và đốt cháy mỡ thừa...",
        "price": 240000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/zenith-adult-lamb-potato.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/zenith-adult-lamb-potato.jpg"
      },
      {
        "name": "Thức ăn cho mèo hữu cơ NATURAL CORE Multi Protein Organic",
        "description": "Thức ăn cho mèo hữu cơ NATURAL CORE Multi Protein Organic được chế biến từ thịt gà, thịt cá hồi, thịt vịt rút xương, hồng sâm… với 95% thành phần hữu cơ và 5% khoáng chất vô cơ tốt cho sức khỏe mèo, phù hợp với mọi lứa tuổi, mọi giống mèo. Được chứng nhận hữu cơ ECOCERT, sản phẩm có tác dụng làm đẹp da, đẹp lông, tối đa hóa khả năng hấp thụ, giảm thiểu mùi phân, trị búi lông.\n\nĐược chế biến từ thịt gà, thịt cá hồi, thịt vịt rút xương, hồng sâm…\n95% nguyên liệu hữu cơ và 5% là vitamin và khoáng c...",
        "price": 340000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-meo-huu-co-natural-core-multi-protein-organic.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-meo-huu-co-natural-core-multi-protein-organic1.jpg"
      },
      {
        "name": "Thức ăn cho chó con hữu cơ NATURAL CORE Lamb Puppy",
        "description": "Thức ăn cho chó con hữu cơ NATURAL CORE Lamb Puppy thịt cừu được chế biến từ các loại thịt tươi và các nguyên liệu được chứng nhận hữu cơ ECOCERT: thịt cừu Úc và thịt nạc gà hữu cơ, khoai lang hữu cơ và ngũ cốc. Với nhiều chất dinh dưỡng tốt cho sức khỏe thú cưng, ECO5a có tác dụng nổi bật trong việc hỗ trợ sự phát triển của chó con.\n\nDành cho chó con dưới 1 tuổi, chó mẹ đang mang thai và cho con bú\nThành phần: thịt cừu Úc và thịt nạc gà hữu cơ, khoai lang hữu cơ và ngũ cốc\nKhông chứa thành phần...",
        "price": 290000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-con-huu-co-natural-core-lamb-puppy.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-con-huu-co-natural-core-lamb-puppy1.jpg"
      }
    ]
  },
  {
    "name": "Phụ kiện",
    "image": "https://cdn-icons-png.flaticon.com/512/3233/3233483.png",
    "items": [
      {
        "name": "Thức ăn cho chó mọi lứa tuổi vị thịt vịt JIREHO Duck",
        "description": "Thức ăn cho chó mọi lứa tuổi vị thịt vịt JIREHO Duck là dòng sản phẩm cao cấp phù hợp cho chó ở mọi độ tuổi, từ cún con đến chó trưởng thành. Với công thức kết hợp giữa thịt vịt, rau củ hữu cơ và thảo mộc tự nhiên, sản phẩm giúp thú cưng phát triển khỏe mạnh toàn diện, tăng sức đề kháng và duy trì vóc dáng lý tưởng.\nLợi ích chính\n\nJIREHO Duck hỗ trợ tiêu hóa nhờ probiotics và nấm men giàu vitamin B tổng hợp.\nRau củ hữu cơ giúp tăng lượng chất xơ, cải thiện tình trạng táo bón.\nChiết xuất thảo mộc...",
        "price": 145000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-cho-moi-lua-tuoi-vi-thit-vit-jireho-duck.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-cho-moi-lua-tuoi-vi-thit-vit-jireho-duck.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị thịt gà và cá ngừ",
        "description": "Nước sốt pate cho mèo CIAO vị thịt gà và cá ngừ Chicken &amp; Tuna dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị thịt gà và cá ngừ bao gồm Katsuo, cá ngừ, dầu đậu nành, chiết xuất Katsuo-bushi, Oligosaccharide, polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, khoảng 35 kcal/miếng....",
        "price": 37000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-thit-ga-va-ca-ngu.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-thit-ga-va-ca-ngu.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó hỗn hợp BOWWOW Jerky Mix",
        "description": "Que bánh thưởng cho chó hỗn hợp BOWWOW Jerky Mix có thành phần chính là thịt gà, cá hồi, phô mai và các loại rau củ quả: rau chân vịt, cà rốt, chuối, là món ăn nhẹ bổ dưỡng, giàu vitamin và khoáng chất, đặc biệt là những chú chó ít ăn rau hoặc bị thừa cân, béo phì. Snack có thể dùng được cho cả cún cưng và mèo cưng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Thịt gà, cá hồi, phô mai, rau chân vịt, cà rốt, chuối...",
        "price": 115000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bowwow-jerky-mix.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bowwow-jerky-mix.jpg"
      },
      {
        "name": "Snack bánh thưởng cho chó hỗn hợp BOWWOW Mix",
        "description": "Snack bánh thưởng cho chó hỗn hợp BOWWOW Mix với thành phần chính là thịt gà và cá hồi, là món ăn nhẹ bổ dưỡng, giàu protein và khoáng chất dành cho các chú chó, giúp bổ sung dinh dưỡng thiết yếu cho chó con đang phát triển và chó mẹ biếng ăn sau khi sinh con. Snack được cả cún cưng và mèo cưng ưa chuộng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Gà, cá hồi, rau, phô mai, can-xi, tảo biển (rong biển nâu), lúa ...",
        "price": 65000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-hon-hop-bowwowmix.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-hon-hop-bowwowmix.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó BOWWOW Stick Jerky Lamd",
        "description": "Que bánh thưởng cho chó BOWWOW Stick Jerky Lamd được làm từ thịt cừu tươi Úc, chứa nhiều vitamin và khoáng chất, giúp tăng khả năng học hỏi của thú cưng. Sản phẩm có lượng chất béo, muối và calo thấp, không gây béo phì, tim mạch, sỏi thận. Đây là snack thơm ngon với thành phần dinh dưỡng tốt cho sức khỏe thú cưng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nHương vị cừu sấy thơm ngon\nThành phần: Thịt cừu tươi (Úc, New Zealand), cá ngừ, bột mì, bột đậu nành, gia vị, vitamin, khoáng chất\n...",
        "price": 40000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bowwow-stick-jerky-lamd.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bowwow-stick-jerky-lamd.jpg"
      },
      {
        "name": "Cát vệ sinh hữu cơ cho mèo CATS BEST Smart Peppets",
        "description": "Cát vệ sinh hữu cơ cho mèo CATS BEST Smart Peppets có dạng những viên nén &#8220;thông minh&#8221;, giúp hạn chế bám dính vào lông mèo gây vương vãi ra ngoài, đặc biệt phù hợp với mèo lông dài. Cát vón cục, thấm hút lượng chất lỏng gấp 7 lần thể tích cát.\n\nCó hình viên nén lớn, không dính lông mèo, ít vấy bẩn, lý tưởng cho mèo lông dài\nCực kỳ tiết kiệm, sau khi xúc bỏ phần cát chứa chất thải, phần cát còn lại có thể dùng tiếp trong 5-7 tuần\nVón cục, thấm hút lượng chất lỏng lớn hơn 700% lần thể ...",
        "price": 155000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/cats-best-smart-peppets.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/cats-best-smart-peppets.jpg"
      },
      {
        "name": "Thức ăn cho chó hạt mềm vị thịt bò ORIGI-7 Beef",
        "description": "Thức ăn cho chó hạt mềm vị thịt bò ORIGI-7 Beef được làm từ thịt bò tươi ngon, kết hợp cùng các nguyên liệu hữu cơ cao cấp, đảm bảo an toàn và giàu dinh dưỡng. Với công thức đặc biệt từ nhà máy BOWWOW Hàn Quốc, ORIGI-7 không chỉ mang lại hương vị đậm đà mà còn giúp thú cưng phát triển toàn diện. Sản phẩm phù hợp cho mọi giống chó và mọi lứa tuổi, từ chó con đến chó trưởng thành.\nĐặc điểm nổi bật\n\nThành phần 100% thịt thật, 70% nguyên liệu hữu cơ, đảm bảo tiêu chuẩn nghiêm ngặt.\nCông thức 7 FREE:...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-thit-bo-origi-7-beef.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-thit-bo-origi-7-beef.jpg"
      },
      {
        "name": "Sữa tắm khô cho chó TROPICLEAN Berry &#038; Coconut Waterless",
        "description": "Sữa tắm khô cho chó TROPICLEAN Berry &amp; Coconut Waterless Dog Shampoo dành cho tất cả các giống chó.\nLợi ích chính\nSữa tắm khô cho chó TROPICLEAN Waterless Dog Shampoo với thành phần nước tinh khiết chất tẩy rửa dịu nhẹ, Protein thực vật thủy phân, chất trung hòa mùi. Hỗn hợp hữu cơ bao gồm chiết xuất mận trắng, chiết xuất dưa chuột, bột yến mạch Avena Sativa làm sạch triệt để và dưỡng ẩm cho lông và da. Đồng thời giúp bộ lông của thú cưng mềm mại, sạch sẽ và có mùi thơm bền lâu. Các thành ph...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sua-tam-kho-cho-cho-tropiclean-berry-coconut-waterless-dog-shampoo.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sua-tam-kho-cho-cho-tropiclean-berry-coconut-waterless-dog-shampoo.jpg"
      },
      {
        "name": "Thức ăn cho chó hữu cơ NATURAL CORE Multi Protein Chicken Salmon",
        "description": "Thức ăn cho chó hữu cơ NATURAL CORE Multi Protein Chicken Salmon (Natural Core Bene M50) được chế biến từ các nguyên liệu được chứng nhận hữu cơ ECOCERT: thịt gà rút xương không chứa kháng sinh, thịt cá tươi, khoai tây, cà rốt, đậu, rau bina hữu cơ, hạt hắc mai biển… Với nhiều chất dinh dưỡng tốt cho sức khỏe thú cưng, Bene M50 phù hợp với các chú chó nuôi trong nhà, cần chế độ ăn uống ổn định và cân bằng.\n\nCải thiện chức năng tiêu hóa, ngăn ngừa tiêu chảy, giảm mùi phân\nChống oxy hóa, ngăn ngừa...",
        "price": 290000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-multi-protein-chicken-salmon.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-multi-protein-chicken-salmon2.jpg"
      },
      {
        "name": "Xịt khử mùi hôi miệng cho chó TROPICLEAN Vanilla Mint Oral Care Spray",
        "description": "Xịt khử mùi hôi miệng chó TROPICLEAN Vanilla Mint Oral Care Spray mùi vị vani bạc hà dành cho tất cả các giống chó.\nLợi ích chính\nXịt khử mùi hôi miệng chó hương vani bạc hà TROPICLEAN Vanilla Mint Oral Care Spray bao gồm: nước tinh khiết, Glycerin, cồn chiết xuất tự nhiên, hương vị, Axit citric, chiết xuất lá trà xanh, kẽm clorua (0,01g/10ml), chất diệp lục. Hôi miệng có thể là một trong những dấu hiệu đầu tiên của bệnh răng miệng. Trên thực tế, 80% chó và 70% mèo có dấu hiệu mắc bệnh răng miện...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-meo-huong-vani-bac-ha-tropiclean-vanilla-mint-oral-care-spray.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-meo-huong-vani-bac-ha-tropiclean-vanilla-mint-oral-care-spray-1.jpg"
      }
    ]
  }
];
  
  for (const catData of seedData) {
    let category = await prisma.productCategory.findFirst({ where: { category_name: catData.name } });
    if (!category) {
      category = await prisma.productCategory.create({
        data: {
          category_name: catData.name,
          image_url: catData.image,
          status: 'active'
        }
      });
    }

    for (const item of catData.items) {
      const existingProduct = await prisma.product.findFirst({ where: { product_name: item.name } });
      if (!existingProduct) {
        const basePrice = item.price;
        const originalPrice = basePrice + Math.floor(Math.random() * 5 + 1) * 20000;
        
        const product = await prisma.product.create({
          data: {
            product_category_id: category.product_category_id,
            product_name: item.name,
            description: item.description,
            price: basePrice,
            original_price: originalPrice,
            sold_quantity: Math.floor(Math.random() * 500),
            stock_quantity: Math.floor(Math.random() * 500 + 50),
            average_rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
            status: 'active'
          }
        });

        await prisma.productImage.createMany({
          data: [
            { product_id: product.product_id, image_url: item.image1, is_primary: true },
            { product_id: product.product_id, image_url: item.image2, is_primary: false }
          ]
        });

        await prisma.productVariant.createMany({
          data: [
            {
              product_id: product.product_id,
              variant_name: 'Mặc định',
              price: basePrice,
              original_price: originalPrice,
              stock_quantity: Math.floor(Math.random() * 100 + 20)
            },
            {
              product_id: product.product_id,
              variant_name: 'Đặc biệt',
              price: basePrice + 30000,
              original_price: originalPrice + 40000,
              stock_quantity: Math.floor(Math.random() * 50 + 10)
            }
          ]
        });
      }
    }
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

  // 8. Post Categories, Posts & Comments
  console.log('Seeding blog categories, posts and comments...');
  
  const categoryNames = ["Sức khỏe", "Dinh dưỡng", "Tâm lý", "Vệ sinh & Làm đẹp"];
  const categoriesMap = {};

  for (const catName of categoryNames) {
    const cat = await prisma.postCategory.upsert({
      where: { category_name: catName },
      update: {},
      create: {
        category_name: catName,
        status: 'active'
      }
    });
    categoriesMap[catName] = cat;
  }

  // Get Admin user for official blog posts
  const adminUser = await prisma.user.findFirst({
    where: { role: { role_code: 'ADMIN' } }
  });
  
  const userHoangNam = await prisma.user.upsert({
    where: { email: 'hoangnam@petclinic.com' },
    update: {},
    create: {
      email: 'hoangnam@petclinic.com',
      password_hash: passwordHash,
      full_name: 'Hoàng Nam',
      role: { connect: { role_code: 'CUSTOMER' } },
      status: 'active'
    }
  });

  const userMaiAnh = await prisma.user.upsert({
    where: { email: 'maianh@petclinic.com' },
    update: {},
    create: {
      email: 'maianh@petclinic.com',
      password_hash: passwordHash,
      full_name: 'Mai Anh',
      role: { connect: { role_code: 'CUSTOMER' } },
      status: 'active'
    }
  });

  const authorId = adminUser ? adminUser.user_id : admin.user_id;
  const guestAuthorId1 = userHoangNam.user_id;
  const guestAuthorId2 = userMaiAnh.user_id;

  const postsData = [
    {
      title: "Cẩm nang chăm sóc chó mèo toàn tập cho người mới bắt đầu",
      slug: "cam-nang-cham-soc-cho-meo-toan-tap-cho-nguoi-moi-bat-dau",
      thumbnail_url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800",
      excerpt: "Bạn mới nuôi thú cưng và chưa biết bắt đầu từ đâu? Xem ngay cẩm nang chi tiết từ các chuyên gia dinh dưỡng và sức khỏe tại Dr.Pet's House để chuẩn bị tốt nhất cho người bạn bốn chân.",
      content: `<h2>1. Chuẩn bị không gian sống và vật dụng cần thiết</h2>
<p>Khi đón một chú chó hoặc mèo về nhà, việc chuẩn bị không gian an toàn và sạch sẽ là vô cùng quan trọng. Bạn cần chuẩn bị sẵn:</p>
<ul>
  <li>Khay ăn, chén nước (nên chọn chất liệu inox hoặc sứ).</li>
  <li>Nệm nằm, chuồng hoặc rào quây.</li>
  <li>Dụng cụ vệ sinh: khay cát (cho mèo), tã lót đi vệ sinh (cho chó).</li>
  <li>Đồ chơi gặm nhấm, cào móng giúp giảm stress.</li>
</ul>

<h2>2. Chế độ dinh dưỡng hợp lý</h2>
<p>Dinh dưỡng đóng vai trò quyết định đến sự phát triển của thú cưng. Mèo là động vật ăn thịt bắt buộc, cần nhiều đạm động vật và taurine. Ngược lại, chó là động vật ăn tạp thiên thịt, cần chế độ ăn cân đối giữa protein, tinh bột, chất xơ và chất béo.</p>
<ul>
  <li><strong>Dưới 2 tháng tuổi:</strong> Chủ yếu uống sữa mẹ hoặc sữa công thức chuyên dụng.</li>
  <li><strong>Từ 2 - 6 tháng tuổi:</strong> Ăn cháo loãng, hạt ngâm mềm hoặc pate ăn dặm, chia làm 3-4 bữa nhỏ/ngày.</li>
  <li><strong>Trên 6 tháng tuổi:</strong> Có thể ăn hạt khô hoàn toàn hoặc tự nấu thức ăn (không nêm gia vị), chia làm 2 bữa/ngày.</li>
</ul>

<h2>3. Vắc-xin và chăm sóc y tế định kỳ</h2>
<p>Đừng quên lịch tiêm phòng và tẩy giun. Đây là rào chắn bảo vệ thú cưng khỏi các bệnh truyền nhiễm nguy hiểm như Parvo, Care ở chó hay giảm bạch cầu ở mèo.</p>
<p>Hãy mang bé đến phòng khám thú y uy tín như Dr.Pet's House để được tư vấn phác đồ tiêm chủng chuẩn xác nhất nhé!</p>`,
      is_featured: true,
      likes_count: 1250,
      hashtags: "CHAMSOCPET,KIENTHUCTHUCUNG",
      post_type: "official_blog",
      status: "published",
      view_count: 2450,
      post_category_id: categoriesMap["Sức khỏe"].post_category_id,
      author_user_id: authorId
    },
    {
      title: "Chế độ dinh dưỡng hoàn hảo cho mèo Anh Lông Ngắn dưới 1 tuổi",
      slug: "che-do-dinh-duong-hoan-hao-cho-meo-anh-long-ngan-duoi-1-tuoi",
      thumbnail_url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800",
      excerpt: "Mèo Anh Lông Ngắn con cần chế độ dinh dưỡng thế nào để phát triển khung xương vững chắc và bộ lông dày mượt? Hãy cùng tìm hiểu công thức thức ăn tối ưu từ chuyên gia.",
      content: `<p>Mèo Anh Lông Ngắn (Aln) là giống mèo rất được ưa chuộng nhờ ngoại hình mập mạp và tính cách hiền lành. Giai đoạn dưới 1 tuổi là thời điểm mèo Aln tăng trưởng nhanh nhất, đặc biệt là hệ cơ và xương...</p>`,
      is_featured: false,
      likes_count: 520,
      hashtags: "DINHDUONGMEO,MEOALN",
      post_type: "official_blog",
      status: "published",
      view_count: 1550,
      post_category_id: categoriesMap["Dinh dưỡng"].post_category_id,
      author_user_id: authorId
    },
    {
      title: "Làm thế nào để trị dứt điểm ve rận cho cún yêu tại nhà?",
      slug: "lam-the-nao-de-tri-dut-diem-ve-ran-cho-cun-yeu-tai-nha",
      thumbnail_url: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800",
      excerpt: "Ve rận không chỉ gây ngứa ngáy mà còn truyền nhiễm các bệnh nguy hiểm về máu cho chó. Xem ngay các bước trị ve rận tận gốc và phòng ngừa hiệu quả tại nhà.",
      content: `<p>Ve rận luôn là nỗi ám ảnh của những người nuôi chó. Chúng sinh sôi rất nhanh và có thể sống ẩn nấp trong kẽ tường, thảm nhà...</p>`,
      is_featured: false,
      likes_count: 340,
      hashtags: "SUCKHOEDOG,TRIVERAN",
      post_type: "official_blog",
      status: "published",
      view_count: 1220,
      post_category_id: categoriesMap["Sức khỏe"].post_category_id,
      author_user_id: authorId
    },
    {
      title: "Giải mã ngôn ngữ cơ thể của mèo: Mèo đang muốn nói gì?",
      slug: "giai-ma-ngon-ngu-co-the-cua-meo-meo-dang-muon-noi-gi",
      thumbnail_url: "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=800",
      excerpt: "Mèo giao tiếp chủ yếu qua đuôi, tai và cử chỉ cơ thể. Học cách đọc vị các hành động này sẽ giúp bạn hiểu rõ tâm trạng và gắn kết hơn với chú mèo của mình.",
      content: `<p>Mèo là loài động vật tinh tế và có phần bí ẩn. Đôi khi bạn không hiểu tại sao chúng lại vẫy đuôi liên tục hay cụp tai xuống...</p>`,
      is_featured: false,
      likes_count: 890,
      hashtags: "TAMLYMEO,NGONNGUMEOT",
      post_type: "official_blog",
      status: "published",
      view_count: 980,
      post_category_id: categoriesMap["Tâm lý"].post_category_id,
      author_user_id: authorId
    },
    {
      title: "Quy trình tắm và vệ sinh tai cho chó Poodle sạch thơm như spa",
      slug: "quy-trinh-tam-va-ve-sinh-tai-cho-cho-poodle-sach-thom-nhu-spa",
      thumbnail_url: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800",
      excerpt: "Chó Poodle có bộ lông xoăn đặc thù rất dễ bị rối và bám bẩn. Hướng dẫn chi tiết quy trình tắm, sấy và vệ sinh tai tại nhà chuẩn spa giúp cún cưng luôn thơm tho.",
      content: `<p>Với bộ lông xoăn và cấu trúc tai cụp kín, Poodle cần một chế độ vệ sinh kỹ lưỡng hơn nhiều giống chó khác...</p>`,
      is_featured: false,
      likes_count: 450,
      hashtags: "GROOMING,POODLE",
      post_type: "official_blog",
      status: "published",
      view_count: 750,
      post_category_id: categoriesMap["Vệ sinh & Làm đẹp"].post_category_id,
      author_user_id: authorId
    },
    {
      title: "Kinh nghiệm chọn cát vệ sinh khử mùi tốt cho mèo chung cư",
      slug: "kinh-nghiem-chon-cat-ve-sinh-khu-mui-tot-cho-meo-chung-cu",
      thumbnail_url: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800",
      excerpt: "Sống tại chung cư không gian kín dễ bị tích tụ mùi hôi từ khay cát. Dưới đây là review chi tiết các loại cát vệ sinh đất sét, cát đậu nành tốt nhất.",
      content: `<p>Khi nuôi mèo ở các căn hộ chung cư có diện tích giới hạn, việc giữ gìn vệ sinh và khử mùi khay cát là yếu tố ưu tiên hàng đầu...</p>`,
      is_featured: false,
      likes_count: 217,
      hashtags: "MEOVAT,MEOCHUNGCU",
      post_type: "community",
      status: "published",
      view_count: 420,
      post_category_id: categoriesMap["Vệ sinh & Làm đẹp"].post_category_id,
      author_user_id: guestAuthorId1
    },
    {
      title: "Có nên triệt sản cho chó đực? Lợi ích và những lưu ý quan trọng",
      slug: "co-nen-triet-san-cho-cho-duc-loi-ich-va-nhung-luu-y-quan-trong",
      thumbnail_url: "https://images.unsplash.com/photo-1544568100-847a948585b9?w=800",
      excerpt: "Triệt sản chó đực giúp hạn chế tính trạng đi tiểu đánh dấu lãnh thổ, giảm kích động và ngăn ngừa một số bệnh ung thư. Hãy cùng xem lời khuyên từ bác sĩ.",
      content: `<p>Nhiều chủ nuôi ngần ngại triệt sản cho cún đực vì sợ ảnh hưởng tính cách của bé. Tuy nhiên dưới góc độ y khoa...</p>`,
      is_featured: false,
      likes_count: 180,
      hashtags: "TRIETSAN,SUCKHOEDOG",
      post_type: "official_blog",
      status: "published",
      view_count: 310,
      post_category_id: categoriesMap["Sức khỏe"].post_category_id,
      author_user_id: authorId
    },
    {
      title: "Chia sẻ nhật ký chữa trị bệnh giảm bạch cầu (FPV) thành công cho bé mèo Mun",
      slug: "chia-se-nhat-ky-chua-tri-benh-giam-bach-cau-fpv-thanh-cong-cho-be-meo-mun",
      thumbnail_url: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800",
      excerpt: "Giảm bạch cầu là căn bệnh nguy hiểm với tỷ lệ tử vong cao ở mèo con. Mình xin chia sẻ hành trình điều trị tích cực giúp bé Mun vượt qua tử thần.",
      content: `<p>Chào mọi người, tuần trước bé Mun nhà mình bỗng dưng bỏ ăn, nôn trớ liên tục rồi tiêu chảy cấp. Đi test nhanh thì dương tính với FPV...</p>`,
      is_featured: false,
      likes_count: 1050,
      hashtags: "FPV,SUCKHOEMEO",
      post_type: "community",
      status: "published",
      view_count: 530,
      post_category_id: categoriesMap["Sức khỏe"].post_category_id,
      author_user_id: guestAuthorId2
    },
    {
      title: "Top 5 loại pate dinh dưỡng giàu protein cho mèo kén ăn",
      slug: "top-5-loai-pate-dinh-duong-giau-protein-cho-meo-ken-an",
      thumbnail_url: "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800",
      excerpt: "Mèo lười uống nước và chán hạt khô? Đừng bỏ qua danh sách 5 loại pate thơm ngon, giàu độ ẩm và protein kích thích vị giác của những bé mèo khó tính nhất.",
      content: `<p>Mèo kén ăn là vấn đề khiến nhiều Sen đau đầu. Giải pháp tốt nhất là bổ sung pate dinh dưỡng vừa kích thích ăn ngon vừa cấp nước...</p>`,
      is_featured: false,
      likes_count: 280,
      hashtags: "PATEMEO,DINHDUONG",
      post_type: "official_blog",
      status: "published",
      view_count: 220,
      post_category_id: categoriesMap["Dinh dưỡng"].post_category_id,
      author_user_id: authorId
    },
    {
      title: "Cách xử lý tâm lý khi chó cưng tỏ ra lo lắng, sợ hãi tiếng sấm sét",
      slug: "cach-xu-ly-tam-ly-khi-cho-cung-to-ra-lo-an-so-hai-tieng-sam-set",
      thumbnail_url: "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800",
      excerpt: "Nhiều chú chó hoảng loạn, cào cấu hoặc bỏ trốn khi trời mưa giông sấm sét. Tìm hiểu phương pháp xoa dịu nỗi sợ hãi tiếng động lớn cho cún cưng.",
      content: `<p>Hội chứng sợ tiếng động lớn (sấm sét, pháo hoa) rất phổ biến ở chó cưng. Điều này xuất phát từ thính giác nhạy cảm gấp nhiều lần con người...</p>`,
      is_featured: false,
      likes_count: 390,
      hashtags: "TAMLYDOG,SAMSET",
      post_type: "official_blog",
      status: "published",
      view_count: 140,
      post_category_id: categoriesMap["Tâm lý"].post_category_id,
      author_user_id: authorId
    },
    // Figma Seeding data
    {
      title: "Cuối tuần dạo chơi cùng bé Cún",
      slug: "cuoi-tuan-dao-choi-cung-be-cun",
      thumbnail_url: "https://images.unsplash.com/photo-1544568100-847a948585b9?w=800",
      excerpt: "Thời tiết đẹp quá mọi người ạ! Nhớ mang theo nước uống đầy đủ cho các bé khi ra ngoài nhé. 🐶☀️",
      content: "Thời tiết đẹp quá mọi người ạ! Nhớ mang theo nước uống đầy đủ cho các bé khi ra ngoài nhé. 🐶☀️ Dr.Pet’s House gợi ý nên đi dạo sau 5h chiều để tránh nắng nóng ảnh hưởng đến bàn chân của bé.",
      is_featured: false,
      likes_count: 1200,
      hashtags: "DAOPHO,CUNCUNG,CUOITUAN",
      post_type: "community",
      status: "published",
      view_count: 3200,
      post_category_id: categoriesMap["Sức khỏe"].post_category_id,
      author_user_id: authorId
    },
    {
      title: "Mèo biếng ăn phải làm sao?",
      slug: "meo-bieng-an-phai-lam-sao",
      thumbnail_url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800",
      excerpt: "Bé mèo nhà mình (giống Anh lông ngắn, 2 tuổi) 3 ngày nay tự nhiên ăn rất ít, bỏ bữa sáng. Bé vẫn chơi đùa bình thường nhưng lười vận động hơn...",
      content: "Bé mèo nhà mình (giống Anh lông ngắn, 2 tuổi) 3 ngày nay tự nhiên ăn rất ít, bỏ bữa sáng. Bé vẫn chơi đùa bình thường nhưng lười vận động hơn... Có Sen nào từng gặp tình trạng này chưa, cho mình xin ít kinh nghiệm với ạ!",
      is_featured: false,
      likes_count: 217,
      hashtags: "MEOBIENGAN,SUCKHOETHUCUNG",
      post_type: "community",
      status: "published",
      view_count: 512,
      post_category_id: categoriesMap["Tâm lý"].post_category_id,
      author_user_id: guestAuthorId1
    },
    {
      title: "Cách giữ nhà luôn thơm tho khi nuôi thú cưng",
      slug: "cach-giu-nha-luon-thom-tho-khi-nuoi-thu-cung",
      thumbnail_url: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800",
      excerpt: "Nhà mình nuôi 2 bé cún nên mùi khá là nồng. Sau một thời gian tìm hiểu mình phát hiện ra dùng máy lọc không khí kết hợp với tinh dầu tự nhiên cực kỳ hiệu quả luôn!",
      content: "Nhà mình nuôi 2 bé cún nên mùi khá là nồng. Sau một thời gian tìm hiểu mình phát hiện ra dùng máy lọc không khí kết hợp với tinh dầu tự nhiên (loại an toàn cho pet) cực kỳ hiệu quả luôn!",
      is_featured: false,
      likes_count: 1000,
      hashtags: "MEOVAT,THOMNHASACHCUA",
      post_type: "community",
      status: "published",
      view_count: 1800,
      post_category_id: categoriesMap["Vệ sinh & Làm đẹp"].post_category_id,
      author_user_id: guestAuthorId2
    },
    {
      title: "Cún con bị nấc cụt sau khi ăn có sao không?",
      slug: "cun-con-bi-nac-cut-sau-khi-an-co-sao-khong",
      thumbnail_url: "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800",
      excerpt: "Bé Poodle nhà mình 3 tháng tuổi, cứ ăn xong là bị nấc cụt tầm 5-10 phút. Có bác nào gặp tình trạng này chưa ạ? Có cần phải đưa đi bác sĩ không?",
      content: "Bé Poodle nhà mình 3 tháng tuổi, cứ ăn xong là bị nấc cụt tầm 5-10 phút. Có bác nào gặp tình trạng này chưa ạ? Có cần phải đưa đi bác sĩ không hay là do bé ăn quá nhanh?",
      is_featured: false,
      likes_count: 62,
      hashtags: "HOIDAP,SUCKHOECUN",
      post_type: "community",
      status: "published",
      view_count: 190,
      post_category_id: categoriesMap["Sức khỏe"].post_category_id,
      author_user_id: guestAuthorId1
    },
    {
      title: "Góc ngủ bá đạo của bé Miu nhà em",
      slug: "goc-ngu-ba-dao-cua-be-miu-nha-em",
      thumbnail_url: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800",
      excerpt: "Góc ngủ bá đạo của bé Miu nhà em. Mọi người có ảnh dìm hàng boss không ạ?",
      content: "Góc ngủ bá đạo của bé Miu nhà em. Mọi người có ảnh dìm hàng boss không ạ? Khoe dưới bình luận đi nào cả nhà ơi!",
      is_featured: false,
      likes_count: 89,
      hashtags: "MEOCUNG,ANHDIM",
      post_type: "community",
      status: "published",
      view_count: 240,
      post_category_id: categoriesMap["Tâm lý"].post_category_id,
      author_user_id: guestAuthorId2
    },
    {
      title: "Có nên cho mèo ăn thức ăn hạt giá rẻ không?",
      slug: "co-nen-cho-meo-an-thuc-an-hat-gia-re-khong",
      thumbnail_url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800",
      excerpt: "Nhiều loại hạt giá rẻ chứa quá nhiều chất độn bột ngô, bột sắn dễ gây sỏi thận cho mèo. Hãy cùng chia sẻ kinh nghiệm lựa chọn hạt chất lượng và tiết kiệm.",
      content: "Mình thấy nhiều bạn nuôi mèo sinh viên hay mua mấy loại hạt giá rẻ không rõ nguồn gốc. Mèo ăn lâu ngày rất dễ bị sỏi tiết niệu và suy thận. Mọi người nên đầu tư hạt chất lượng một chút, hoặc tự làm thức ăn ướt trộn thêm sẽ tốt hơn nhiều đó ạ!",
      is_featured: false,
      likes_count: 750,
      hashtags: "DINHDUONGMEO,HATCHOMEO",
      post_type: "community",
      status: "published",
      view_count: 1420,
      post_category_id: categoriesMap["Dinh dưỡng"].post_category_id,
      author_user_id: guestAuthorId2
    },
    {
      title: "Hành trình huấn luyện cún đi vệ sinh đúng chỗ trong 2 tuần",
      slug: "hanh-trinh-huan-luyen-cun-di-ve-sinh-dung-cho-trong-2-tuan",
      thumbnail_url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800",
      excerpt: "Kiên trì áp dụng phương pháp dùng xịt hướng dẫn vệ sinh kết hợp khen thưởng bằng bánh thưởng. Chia sẻ chi tiết lịch trình hằng ngày cho các Sen.",
      content: "Tuần đầu tiên mình dùng xịt xi tiểu của Dr.Pet's House xịt vào khay vệ sinh, cứ thấy bé đi vòng quanh ngửi ngửi là bế ngay vào khay. Khi bé đi đúng thì thưởng ngay Snack Bowwow và xoa đầu khen ngợi. Đến tuần thứ 2 bé đã tự động chạy vào khay khi buồn đi vệ sinh rồi!",
      is_featured: false,
      likes_count: 950,
      hashtags: "HUANLUYENCUN,MEOVAT",
      post_type: "community",
      status: "published",
      view_count: 2100,
      post_category_id: categoriesMap["Tâm lý"].post_category_id,
      author_user_id: guestAuthorId1
    },
    {
      title: "Review máy sấy lông thú cưng 3 trong 1 tại nhà",
      slug: "review-may-say-long-thu-cung-3-trong-1-tai-nha",
      thumbnail_url: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800",
      excerpt: "Tự tắm cho bé tại nhà rất vui nhưng khâu sấy lông luôn là ác mộng. Mình mới tậu em máy sấy chuyên dụng Chunzhou 2800W và đây là đánh giá chi tiết.",
      content: "Em máy sấy này sức gió siêu mạnh luôn mọi người ơi, sấy bé Samoyed lông dày cộp mà chỉ mất tầm 25 phút là khô ráo hoàn toàn. Máy có chế độ sấy ấm và sấy mát điều chỉnh rất linh hoạt, tiếng ồn ở mức chấp nhận được chứ không làm cún hoảng sợ.",
      is_featured: false,
      likes_count: 410,
      hashtags: "GROOMING,VESINH",
      post_type: "community",
      status: "published",
      view_count: 820,
      post_category_id: categoriesMap["Vệ sinh & Làm đẹp"].post_category_id,
      author_user_id: guestAuthorId2
    },
    {
      title: "Dấu hiệu nhận biết sớm bệnh viêm tai ở chó tai cụp",
      slug: "dau-hieu-nhan-biet-som-benh-viem-tai-o-cho-tai-cup",
      thumbnail_url: "https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?w=800",
      excerpt: "Các giống chó tai cụp như Poodle, Cocker rất dễ bị viêm tai giữa nếu không vệ sinh tai đúng cách. Hãy chú ý các biểu hiện gãi tai liên tục, tai có mùi hôi.",
      content: "Mọi người nuôi Poodle nhớ nhổ lông tai định kỳ và dùng nước rửa tai chuyên dụng 1-2 lần/tuần nhé. Nếu thấy bé gãi tai liên tục, lắc đầu thường xuyên hoặc khi ngửi tai thấy có mùi hôi hắc thì 90% là bé bị viêm tai rồi, cần đưa đi bác sĩ thú y ngay.",
      is_featured: false,
      likes_count: 680,
      hashtags: "SUCKHOEDOG,TAICUP",
      post_type: "community",
      status: "published",
      view_count: 1150,
      post_category_id: categoriesMap["Sức khỏe"].post_category_id,
      author_user_id: guestAuthorId1
    },
    {
      title: "Mèo con kêu liên tục vào ban đêm: Nguyên nhân và cách khắc phục",
      slug: "meo-con-keu-lien-tuc-vao-ban-dem-nguyen-nhan-va-cach-khac-phuc",
      thumbnail_url: "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800",
      excerpt: "Mèo con mới về nhà thường khóc đêm vì nhớ mẹ và môi trường lạ. Làm thế nào để xoa dịu giúp bé và gia đình có giấc ngủ ngon?",
      content: "Các Sen có thể để một chiếc áo cũ của mình vào ổ nằm của bé để bé quen mùi chủ, hoặc đặt một chiếc đồng hồ tích tắc nhỏ gần đó giả lập tiếng nhịp tim của mèo mẹ. Ban ngày nhớ chơi với bé nhiều hơn để ban đêm bé mệt và ngủ say nhé!",
      is_featured: false,
      likes_count: 530,
      hashtags: "TAMLYMEO,MEOCON",
      post_type: "community",
      status: "published",
      view_count: 980,
      post_category_id: categoriesMap["Tâm lý"].post_category_id,
      author_user_id: guestAuthorId2
    },
    {
      title: "Lựa chọn sữa tắm cho cún cưng có làn da nhạy cảm",
      slug: "lua-chon-sua-tam-cho-cun-cung-co-lan-da-nhay-cam",
      thumbnail_url: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800",
      excerpt: "Cún nhà mình thuộc dòng Bulldog da nhạy cảm và rất dễ bị dị ứng, nổi mẩn đỏ. Mình đã test qua 5 loại sữa tắm khác nhau và tìm ra chân ái.",
      content: "Khuyên thật lòng các bạn nuôi Bulldog hay Pug da nhạy cảm nên dùng sữa tắm có chiết xuất yến mạch hoặc trà xanh thiên nhiên (như Tropiclean Berry & Coconut). Hạn chế dùng các loại có mùi quá nồng vì rất dễ gây kích ứng da pet.",
      is_featured: false,
      likes_count: 320,
      hashtags: "GROOMING,BULLDOG,SKINCARE",
      post_type: "community",
      status: "published",
      view_count: 670,
      post_category_id: categoriesMap["Vệ sinh & Làm đẹp"].post_category_id,
      author_user_id: guestAuthorId1
    },
    {
      title: "Bổ sung Gel dinh dưỡng cho thú cưng sau khi ốm dậy",
      slug: "bo-sung-gel-dinh-duong-cho-thu-cung-sau-khi-om-day",
      thumbnail_url: "https://images.unsplash.com/photo-1544568100-847a948585b9?w=800",
      excerpt: "Bé cún nhà mình vừa trải qua đợt điều trị viêm ruột, người gầy rộc đi. Bác sĩ khuyên bổ sung Gel dinh dưỡng Nutri-plus để phục hồi thể trạng nhanh chóng.",
      content: "Gel dinh dưỡng rất tốt cho các bé suy nhược, bỏ ăn hoặc sau phẫu thuật. Mình cho bé ăn trực tiếp hoặc trộn vào cháo/hạt ngâm ấm. Chỉ sau 1 tuần bé đã lấy lại được năng lượng và ham chạy nhảy trở lại rồi, trộm vía rất thích mùi vị của loại gel này.",
      is_featured: false,
      likes_count: 480,
      hashtags: "SUCKHOEPET,GELDINHINGUONG",
      post_type: "community",
      status: "published",
      view_count: 890,
      post_category_id: categoriesMap["Dinh dưỡng"].post_category_id,
      author_user_id: guestAuthorId1
    }
  ];

  for (const post of postsData) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      update: {
        is_featured: post.is_featured,
        view_count: post.view_count,
        likes_count: post.likes_count,
        hashtags: post.hashtags,
        post_category_id: post.post_category_id,
        author_user_id: post.author_user_id
      },
      create: post
    });
  }

  // Create comments for the featured post and community posts
  console.log('Seeding comments for posts...');
  const customers = await prisma.user.findMany({
    where: { role: { role_code: 'CUSTOMER' } }
  });

  if (customers.length > 0) {
    // 1. Comments for featured post
    const featuredPost = await prisma.post.findUnique({
      where: { slug: "cam-nang-cham-soc-cho-meo-toan-tap-cho-nguoi-moi-bat-dau" }
    });
    if (featuredPost) {
      const commentCount = await prisma.postComment.count({
        where: { post_id: featuredPost.post_id }
      });
      if (commentCount === 0) {
        console.log('Seeding comments for featured post...');
        const comment1 = await prisma.postComment.create({
          data: {
            post_id: featuredPost.post_id,
            user_id: customers[0].user_id,
            content: "Bài viết chi tiết quá ạ! Bé mèo nhà em 3 tháng tuổi thì nên tiêm phòng mũi thứ mấy rồi bác sĩ ơi?",
            status: "visible"
          }
        });

        await prisma.postComment.create({
          data: {
            post_id: featuredPost.post_id,
            user_id: authorId,
            parent_comment_id: comment1.comment_id,
            content: "Chào bạn, với bé mèo 3 tháng tuổi bạn nên cho bé hoàn thành mũi tiêm vắc-xin 4 trong 1 thứ 2 hoặc thứ 3 nhé. Bạn có thể mang bé qua Dr.Pet's House để được khám lâm sàng trước khi tiêm nha!",
            status: "visible"
          }
        });

        await prisma.postComment.create({
          data: {
            post_id: featuredPost.post_id,
            user_id: customers[1] ? customers[1].user_id : customers[0].user_id,
            content: "Cảm ơn bác sĩ, thông tin cực kỳ hữu ích cho người mới tập nuôi chó như mình.",
            status: "visible"
          }
        });
      }
    }

    // 2. Comments for specific community posts to create dynamic comment counts
    const communityCommentsData = [
      {
        slug: "cuoi-tuan-dao-choi-cung-be-cun",
        comments: [
          { userIndex: 0, content: "Cún cưng cưng quá bạn ơi! Địa điểm này ở đâu vậy ạ?" },
          { userIndex: 1, content: "Thời tiết dạo này nóng thật, đi chiều mát sau 5h là hợp lý nhất rồi." }
        ]
      },
      {
        slug: "meo-bieng-an-phai-lam-sao",
        comments: [
          { userIndex: 2, content: "Bé nhà mình đợt trước cũng vậy, đi khám bác sĩ bảo bị nhiệt miệng đó bạn." },
          { userIndex: 3, content: "Bạn thử đổi sang pate lon xem bé có kích thích ăn hơn không." },
          { userIndex: 4, content: "Nên mang bé đi khám thú y sớm nha bạn, bỏ bữa 3 ngày là khá nguy hiểm đấy." }
        ]
      },
      {
        slug: "cach-giu-nha-luon-thom-tho-khi-nuoi-thu-cung",
        comments: [
          { userIndex: 0, content: "Máy lọc không khí hãng nào tốt cho lông pet hả bạn?" },
          { userIndex: 1, content: "Dùng tinh dầu sả chanh được không bạn ơi? Có sợ ảnh hưởng đường hô hấp của bé không?" }
        ]
      },
      {
        slug: "cun-con-bi-nac-cut-sau-khi-an-co-sao-khong",
        comments: [
          { userIndex: 5, content: "Do cún ăn nhanh nuốt nhiều khí đó bạn, mua bát ăn chậm hoặc chia nhỏ bữa ăn ra thử xem." },
          { userIndex: 6, content: "Trộm vía cún con hay bị nấc vậy á, lớn tí là hết hà, đừng lo quá bạn." }
        ]
      },
      {
        slug: "goc-ngu-ba-dao-cua-be-miu-nha-em",
        comments: [
          { userIndex: 2, content: "Trời đất, ngủ kiểu gì vẹo cả cổ thế kia 😂 boss nhà bạn hài hước quá." },
          { userIndex: 3, content: "Dễ thương xỉu luôn á! Xin vía ngủ ngon nha Miu." }
        ]
      },
      {
        slug: "co-nen-cho-meo-an-thuc-an-hat-gia-re-khong",
        comments: [
          { userIndex: 0, content: "Đúng rồi bạn ơi, tiền chữa sỏi thận bằng mấy lần tiền mua hạt xịn luôn." },
          { userIndex: 1, content: "Chuẩn luôn, nên chọn các thương hiệu uy tín như Royal Canin hoặc Catsrang." },
          { userIndex: 4, content: "Bài viết rất hữu ích cho các bạn mới nuôi mèo!" }
        ]
      },
      {
        slug: "hanh-trinh-huan-luyen-cun-di-ve-sinh-dung-cho-trong-2-tuan",
        comments: [
          { userIndex: 2, content: "Mình cũng đang tập cho bé nhà mình, áp dụng thử cách của bạn xem sao." },
          { userIndex: 3, content: "Mẹo nhỏ là có thể dùng tã thấm nước tiểu của bé đặt sẵn vào khay nha." },
          { userIndex: 5, content: "Cho mình hỏi mua snack Bowwow ở đâu chính hãng rẻ vậy bạn?" }
        ]
      },
      {
        slug: "review-may-say-long-thu-cung-3-trong-1-tai-nha",
        comments: [
          { userIndex: 1, content: "Máy sấy này mua khoảng bao nhiêu tiền vậy bạn?" },
          { userIndex: 6, content: "Lông mèo sấy bằng máy này có bị khô xơ không bạn nhỉ?" }
        ]
      },
      {
        slug: "dau-hieu-nhan-biet-som-benh-viem-tai-o-cho-tai-cup",
        comments: [
          { userIndex: 0, content: "Cún nhà mình bị viêm tai suốt, chữa mãi không dứt điểm, buồn ghê." },
          { userIndex: 2, content: "Bạn phải sấy thật khô tai sau khi tắm nữa nha, ẩm ướt là nấm mốc lên ngay." }
        ]
      }
    ];

    for (const postCommentData of communityCommentsData) {
      const post = await prisma.post.findUnique({
        where: { slug: postCommentData.slug }
      });
      if (post) {
        const existingCount = await prisma.postComment.count({
          where: { post_id: post.post_id }
        });
        if (existingCount === 0) {
          for (const comm of postCommentData.comments) {
            const user = customers[comm.userIndex % customers.length];
            await prisma.postComment.create({
              data: {
                post_id: post.post_id,
                user_id: user.user_id,
                content: comm.content,
                status: "visible"
              }
            });
          }
        }
      }
    }
  }

  // 9. First Aid Categories, Guides, Steps & Media
  console.log('Seeding first aid categories, guides, steps and media...');
  const firstAidCategoriesData = [
    { name: "Tai nạn", description: "Sơ cứu khi thú cưng gặp tai nạn giao thông, hóc dị vật, bỏng, điện giật..." },
    { name: "Ngộ độc", description: "Xử lý khi thú cưng nuốt phải cây độc, chocolate, hóa chất tẩy rửa..." },
    { name: "Khó thở", description: "Các triệu chứng nghẹt thở, suy hô hấp, hen suyễn..." },
    { name: "Chấn thương", description: "Xử lý vết rách da, chảy máu, gãy xương do cắn nhau hoặc ngã cao..." }
  ];

  const firstAidCategoriesMap = {};
  for (const cat of firstAidCategoriesData) {
    const createdCat = await prisma.firstAidCategory.upsert({
      where: { category_name: cat.name },
      update: {},
      create: {
        category_name: cat.name,
        status: 'active'
      }
    });
    firstAidCategoriesMap[cat.name] = createdCat;
  }

  const firstAidGuidesData = [
    {
      title: "Sơ cứu khi chó bị hóc dị vật",
      slug: "so-cuu-khi-cho-bi-hoc-di-vat",
      situation_description: "Khi chó có dấu hiệu nghẹt thở, khó thở hoặc liên tục dùng chân cào vào miệng, rất có thể chúng đang bị hóc dị vật. Đây là tình huống đe dọa tính mạng cần được xử lý bình tĩnh và chính xác ngay lập tức.",
      emergency_phone: "0868686868",
      video_url: "https://www.youtube.com/watch?v=sample_choking_dog",
      first_aid_category_id: firstAidCategoriesMap["Tai nạn"].first_aid_category_id,
      created_by_admin_id: authorId,
      status: "published",
      steps: [
        {
          step_number: 1,
          step_content: "Mở rộng miệng chó bằng hai tay. Sử dụng đèn pin để quan sát kỹ phần cuống họng. Nếu thấy dị vật ở gần, hãy cố gắng lấy ra bằng tay hoặc nhíp.",
          image_url: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800"
        },
        {
          step_number: 2,
          step_content: "Với chó nhỏ, hãy giữ chân sau và dốc ngược chúng. Với chó lớn, hãy giữ chúng ở tư thế 'xe cút kít' (nâng hai chân sau lên cao) để trọng lực giúp dị vật rơi ra.",
          image_url: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=800"
        },
        {
          step_number: 3,
          step_content: "Đặt nắm tay ở vùng bụng ngay dưới xương sườn. Thực hiện 5 lần đẩy mạnh và nhanh về phía trước và hướng lên trên để tạo áp lực tống dị vật ra ngoài.",
          image_url: "https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800"
        }
      ],
      media: [
        { media_type: "video", file_url: "https://www.youtube.com/watch?v=sample_choking_dog", file_size_kb: 10240 }
      ]
    },
    {
      title: "Xử lý mèo bị ngộ độc thực phẩm",
      slug: "xu-ly-meo-bi-ngo-doc-thuc-pham",
      situation_description: "Mèo rất tò mò và có thể nuốt phải chocolate, hành tỏi, cây độc hoặc hóa chất tẩy rửa trong nhà. Ngộ độc thực phẩm ở mèo có thể tiến triển rất nhanh, cần được sơ cứu đúng cách trước khi đưa tới thú y.",
      emergency_phone: "0868686868",
      video_url: "https://www.youtube.com/watch?v=sample_poisoned_cat",
      first_aid_category_id: firstAidCategoriesMap["Ngộ độc"].first_aid_category_id,
      created_by_admin_id: authorId,
      status: "published",
      steps: [
        {
          step_number: 1,
          step_content: "Kiểm tra xung quanh xem có vỏ kẹo chocolate, lá cây bị cắn dở hay chai lọ hóa chất bị đổ không để báo chính xác cho bác sĩ.",
          image_url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800"
        },
        {
          step_number: 2,
          step_content: "Nếu mèo nuốt phải axit, chất kiềm mạnh hoặc hóa chất ăn mòn, việc tự ý gây nôn sẽ làm bỏng thực quản nghiêm trọng hơn. Tuyệt đối không gây nôn trừ khi được bác sĩ hướng dẫn.",
          image_url: "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=800"
        },
        {
          step_number: 3,
          step_content: "Giữ ấm cho mèo bằng chăn, mang theo mẫu chất độc (hoặc vỏ chai hóa chất) và đưa ngay tới cơ sở thú y gần nhất.",
          image_url: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800"
        }
      ]
    },
    {
      title: "Sơ cứu vết bỏng chó mèo",
      slug: "so-cuu-vet-bong-cho-meo",
      situation_description: "Thú cưng có thể bị bỏng do nước sôi, dầu mỡ nóng, bỏng hóa chất hoặc bỏng điện. Sơ cứu vết bỏng nhanh chóng giúp làm giảm tổn thương mô và giảm đau cho bé.",
      emergency_phone: "0868686868",
      video_url: null,
      first_aid_category_id: firstAidCategoriesMap["Tai nạn"].first_aid_category_id,
      created_by_admin_id: authorId,
      status: "published",
      steps: [
        {
          step_number: 1,
          step_content: "Dùng nước sạch xả nhẹ nhàng lên vùng da bị bỏng của thú cưng trong 10-15 phút để hạ nhiệt độ vết bỏng ngay lập tức. Tuyệt đối không dùng đá lạnh áp trực tiếp lên vết thương.",
          image_url: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=800"
        },
        {
          step_number: 2,
          step_content: "Sử dụng gạc sạch hoặc khăn mềm ẩm che phủ lên vết bỏng một cách nhẹ nhàng. Tránh băng quá chặt làm bít khí và gây đau đớn.",
          image_url: "https://images.unsplash.com/photo-1544568100-847a948585b9?w=800"
        },
        {
          step_number: 3,
          step_content: "Tuyệt đối không bôi kem đánh răng, mỡ trăn hay dầu ăn lên vết bỏng vì dễ gây bí nhiệt và nhiễm trùng da nghiêm trọng.",
          image_url: "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800"
        }
      ]
    },
    {
      title: "Cấp cứu vết thương hở do cắn nhau",
      slug: "cap-cuu-vet-thuong-ho-do-can-nhau",
      situation_description: "Xung đột giữa các bé cún hoặc mèo có thể gây ra những vết rách da, chảy máu nhiều. Sơ cứu tại chỗ giúp cầm máu và làm sạch vết thương tạm thời tránh nhiễm trùng nguy hiểm.",
      emergency_phone: "0868686868",
      video_url: null,
      first_aid_category_id: firstAidCategoriesMap["Chấn thương"].first_aid_category_id,
      created_by_admin_id: authorId,
      status: "published",
      steps: [
        {
          step_number: 1,
          step_content: "Dùng một miếng gạc hoặc khăn sạch đè chặt lên vết thương hở trong 3-5 phút để máu ngừng chảy. Giữ lực đè ổn định.",
          image_url: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800"
        },
        {
          step_number: 2,
          step_content: "Rửa sạch vết thương bằng nước muối sinh lý ấm, loại bỏ cát bụi bẩn. Dùng kéo y tế cắt bớt phần lông xung quanh nếu cần thiết để tránh bám dính.",
          image_url: "https://images.unsplash.com/photo-1588943211346-0908a1fb0b01?w=800"
        },
        {
          step_number: 3,
          step_content: "Sử dụng băng thun hoặc băng dính y tế cố định gạc sạch để che chắn vết thương khỏi bụi bẩn khi di chuyển đến phòng khám.",
          image_url: "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=800"
        }
      ]
    }
  ];

  for (const guideData of firstAidGuidesData) {
    const { steps, media, ...guideFields } = guideData;
    const guide = await prisma.firstAidGuide.upsert({
      where: { slug: guideFields.slug },
      update: {
        first_aid_category_id: guideFields.first_aid_category_id,
        situation_description: guideFields.situation_description,
        emergency_phone: guideFields.emergency_phone,
        video_url: guideFields.video_url,
        status: guideFields.status
      },
      create: guideFields
    });

    // Seed Steps
    if (steps && steps.length > 0) {
      const stepCount = await prisma.firstAidStep.count({
        where: { guide_id: guide.guide_id }
      });
      if (stepCount === 0) {
        for (const step of steps) {
          await prisma.firstAidStep.create({
            data: {
              guide_id: guide.guide_id,
              step_number: step.step_number,
              step_content: step.step_content,
              image_url: step.image_url
            }
          });
        }
      }
    }

    // Seed Media
    if (media && media.length > 0) {
      const mediaCount = await prisma.firstAidMedia.count({
        where: { guide_id: guide.guide_id }
      });
      if (mediaCount === 0) {
        for (const m of media) {
          await prisma.firstAidMedia.create({
            data: {
              guide_id: guide.guide_id,
              media_type: m.media_type,
              file_url: m.file_url,
              file_size_kb: m.file_size_kb
            }
          });
        }
      }
    }
  }

  // 10. Generate TimeSlots
  console.log('Generating timeslots for 7 days ahead...');
  const branches = await prisma.branch.findMany({
    where: { status: 'active' }
  });

  const today = new Date();
  const examInterval = 30; // 30 mins
  const groomInterval = 60; // 60 mins

  for (let i = 0; i <= 7; i++) {
    const targetDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().substring(0, 10);
    const dateObj = new Date(dateStr);

    for (const branch of branches) {
      // Exam Slots (8:00 to 21:00)
      let current = new Date(dateStr + 'T08:00:00.000Z');
      const examEnd = new Date(dateStr + 'T21:00:00.000Z');
      
      while (current.getTime() < examEnd.getTime()) {
        const next = new Date(current.getTime() + examInterval * 60000);
        const startTime = new Date(`1970-01-01T${current.toISOString().substring(11, 19)}Z`);
        const endTime = new Date(`1970-01-01T${next.toISOString().substring(11, 19)}Z`);
        
        const existing = await prisma.timeSlot.findFirst({
          where: {
            branch_id: branch.branch_id,
            slot_date: dateObj,
            start_time: startTime,
            end_time: endTime,
            slot_type: 'exam'
          }
        });

        if (!existing) {
          await prisma.timeSlot.create({
            data: {
              branch_id: branch.branch_id,
              slot_date: dateObj,
              start_time: startTime,
              end_time: endTime,
              max_booking: 3,
              slot_type: 'exam',
              status: 'available'
            }
          });
        }
        current = next;
      }

      // Grooming Slots (8:00 to 21:00)
      current = new Date(dateStr + 'T08:00:00.000Z');
      const groomEnd = new Date(dateStr + 'T21:00:00.000Z');
      
      while (current.getTime() < groomEnd.getTime()) {
        const next = new Date(current.getTime() + groomInterval * 60000);
        const startTime = new Date(`1970-01-01T${current.toISOString().substring(11, 19)}Z`);
        const endTime = new Date(`1970-01-01T${next.toISOString().substring(11, 19)}Z`);
        
        const existing = await prisma.timeSlot.findFirst({
          where: {
            branch_id: branch.branch_id,
            slot_date: dateObj,
            start_time: startTime,
            end_time: endTime,
            slot_type: 'grooming'
          }
        });

        if (!existing) {
          await prisma.timeSlot.create({
            data: {
              branch_id: branch.branch_id,
              slot_date: dateObj,
              start_time: startTime,
              end_time: endTime,
              max_booking: 2,
              slot_type: 'grooming',
              status: 'available'
            }
          });
        }
        current = next;
      }
    }
  }

  // 11. Seeding Orders
  console.log('Seeding orders...');
  // Clean up existing orders and user addresses to prevent duplication on multiple seeds
  await prisma.order.deleteMany({});
  await prisma.userAddress.deleteMany({});

  const customersForOrders = await prisma.user.findMany({
    where: { role: { role_code: 'CUSTOMER' } },
    take: 5
  });

  const productsForOrders = await prisma.product.findMany({
    take: 10
  });

  if (customersForOrders.length > 0 && productsForOrders.length > 0) {
    for (let i = 0; i < customersForOrders.length; i++) {
      const customer = customersForOrders[i];
      
      // Create an address first
      const address = await prisma.userAddress.create({
        data: {
          user_id: customer.user_id,
          recipient_name: customer.full_name,
          recipient_phone: customer.phone || '0901234567',
          recipient_email: customer.email,
          address_line: `Đường số ${i + 1}, Phường 1`,
          ward: 'Phường 1',
          district: 'Quận 10',
          province: 'TP. Hồ Chí Minh',
          country: 'Việt Nam',
          is_default: true
        }
      });
      
      // Create 1-2 orders for this customer
      const orderCount = i === 0 ? 3 : Math.floor(Math.random() * 2) + 1; // customer1 (index 0) gets 3 orders
      for (let o = 0; o < orderCount; o++) {
        const orderProducts = [
          productsForOrders[Math.floor(Math.random() * productsForOrders.length)],
          productsForOrders[Math.floor(Math.random() * productsForOrders.length)]
        ];
        
        let subtotal = 0;
        const orderItemsData = [];
        
        for (const prod of orderProducts) {
          const qty = Math.floor(Math.random() * 2) + 1;
          const price = Number(prod.price);
          const itemTotal = price * qty;
          subtotal += itemTotal;
          
          orderItemsData.push({
            item_type: 'product',
            product_id: prod.product_id,
            item_name_snapshot: prod.product_name,
            quantity: qty,
            unit_price: price,
            total_price: itemTotal
          });
        }
        
        const shippingFee = 30000;
        const discount = 0;
        const totalAmount = subtotal + shippingFee - discount;
        
        const orderCode = `ORD-${Math.floor(100000 + Math.random() * 900000)}-${Date.now().toString().slice(-4)}`;
        
        await prisma.order.create({
          data: {
            order_code: orderCode,
            user_id: customer.user_id,
            address_id: address.address_id,
            order_type: 'product',
            order_status: o === 0 ? 'completed' : (o === 1 ? 'shipping' : 'pending'),
            payment_status: o === 0 ? 'paid' : 'unpaid',
            shipping_fee: shippingFee,
            subtotal_amount: subtotal,
            discount_amount: discount,
            total_amount: totalAmount,
            recipient_name: customer.full_name,
            recipient_phone: customer.phone || '0901234567',
            shipping_address: address.address_line,
            note: `Đơn hàng mẫu số ${o + 1} của ${customer.full_name}`,
            order_items: {
              create: orderItemsData
            }
          }
        });
      }
    }
  }

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
