import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getPricingMatrix = async () => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { status: 'active' },
      include: {
        services: {
          where: { status: 'active' },
          include: {
            price_matrix: {
              orderBy: { weight_min: 'asc' }
            }
          },
          orderBy: { service_id: 'asc' }
        }
      },
      orderBy: { service_category_id: 'asc' }
    });

    const result = categories.map(category => {
      const weightRangeSet = new Map();
      
      category.services.forEach(service => {
        service.price_matrix.forEach(matrix => {
          const min = matrix.weight_min ? parseFloat(matrix.weight_min) : 0;
          const max = matrix.weight_max ? parseFloat(matrix.weight_max) : null;
          
          let label = '';
          if (max === null) {
            label = `Trên ${min}kg`;
          } else if (min === 0) {
            label = `Dưới ${max}kg`;
          } else {
            label = `${min} - ${max}kg`;
          }
          
          const key = `${min}-${max}`;
          if (!weightRangeSet.has(key)) {
            weightRangeSet.set(key, { min, max, label });
          }
        });
      });
      
      const weightRanges = Array.from(weightRangeSet.values()).sort((a, b) => a.min - b.min);
      
      return {
        category_id: category.service_category_id.toString(),
        category_name: category.category_name,
        weight_ranges: weightRanges,
        services: category.services.map(service => {
          const pricesMap = {};
          service.price_matrix.forEach(matrix => {
            const min = matrix.weight_min ? parseFloat(matrix.weight_min) : 0;
            const max = matrix.weight_max ? parseFloat(matrix.weight_max) : null;
            const key = `${min}-${max}`;
            pricesMap[key] = {
              price: matrix.price ? parseFloat(matrix.price) : null,
              is_contact: matrix.is_contact
            };
          });
          
          const prices = weightRanges.map(range => {
            const key = `${range.min}-${range.max}`;
            return {
              weight_label: range.label,
              price: pricesMap[key]?.price || null,
              is_contact: pricesMap[key]?.is_contact || false
            };
          });
          
          return {
            service_id: service.service_id.toString(),
            service_name: service.service_name,
            prices
          };
        })
      };
    });

    return { EM: 'Get pricing matrix successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getPricingMatrix
};
