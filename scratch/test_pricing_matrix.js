import prisma from '../src/configs/prisma';
import servicePricingAPIService from '../src/services/servicePricingAPIService';

const testMatrix = async () => {
  try {
    // 1. Get first active category
    const category = await prisma.serviceCategory.findFirst({
      where: { status: 'active' } // we will just pick first active
    });
    
    if (!category) {
      console.log('No category found');
      return;
    }
    
    const service1 = await prisma.service.findFirst({
      where: { service_category_id: category.service_category_id }
    });
    
    if (!service1) {
      console.log('No service found');
      return;
    }
    
    console.log(`Seeding for service: ${service1.service_name}`);
    
    // Clear old matrix
    await prisma.servicePriceMatrix.deleteMany({
      where: { service_id: service1.service_id }
    });
    
    // Seed new matrix: Dưới 3kg, 3.1 - 5kg, Trên 30kg
    await prisma.servicePriceMatrix.createMany({
      data: [
        { service_id: service1.service_id, weight_min: 0, weight_max: 3, price: 50000, is_contact: false },
        { service_id: service1.service_id, weight_min: 3.1, weight_max: 5, price: 70000, is_contact: false },
        { service_id: service1.service_id, weight_min: 5.1, weight_max: 8, price: 90000, is_contact: false },
        { service_id: service1.service_id, weight_min: 30.1, weight_max: null, price: null, is_contact: true },
      ]
    });
    
    console.log('Seed completed. Testing service getPricingMatrix...');
    
    const res = await servicePricingAPIService.getPricingMatrix();
    console.log(JSON.stringify(res.DT, null, 2));
    
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
};

testMatrix();
