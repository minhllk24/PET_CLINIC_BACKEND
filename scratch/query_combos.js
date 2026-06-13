import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const comboServices = await prisma.service.findMany({
    where: {
      service_category_id: 3
    },
    select: {
      service_id: true,
      service_name: true,
      description: true,
      base_price: true,
      duration_minutes: true
    }
  });

  console.log(JSON.stringify(comboServices, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
