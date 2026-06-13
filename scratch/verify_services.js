import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.serviceCategory.findMany({
    include: {
      services: true
    }
  });

  let totalServices = 0;
  categories.forEach(cat => {
    console.log(`=== Category: ${cat.category_name} (${cat.services.length} services) ===`);
    cat.services.forEach(s => {
      console.log(`- ${s.service_name} | Price: ${parseFloat(s.base_price)} VND | Duration: ${s.duration_minutes}m`);
      totalServices++;
    });
  });
  console.log(`\nTotal Services Seeded: ${totalServices}`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
