import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- BRANCHES ---');
  const branches = await prisma.branch.findMany();
  console.log(JSON.stringify(branches, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

  console.log('--- DOCTORS ---');
  const doctors = await prisma.doctor.findMany();
  console.log(JSON.stringify(doctors, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

  console.log('--- SERVICE CATEGORIES ---');
  const serviceCategories = await prisma.serviceCategory.findMany();
  console.log(JSON.stringify(serviceCategories, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
