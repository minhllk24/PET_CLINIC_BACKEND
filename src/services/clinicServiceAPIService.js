import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getAllCategories = async () => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      where: { status: 'active' }
    });
    return { EM: 'Get service categories successful', EC: 0, DT: categories };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getAllServices = async (query) => {
  try {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = query.filter || '';
    const categoryId = query.category_id ? toBigIntId(query.category_id) : undefined;

    const whereCondition = {
      status: 'active',
      service_name: filter ? { contains: filter } : undefined,
      category_id: categoryId ? categoryId : undefined
    };

    const [total, services] = await prisma.$transaction([
      prisma.clinicService.count({ where: whereCondition }),
      prisma.clinicService.findMany({
        where: whereCondition,
        include: { category: true },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      EM: 'Get services successful',
      EC: 0,
      DT: {
        totalRows: total,
        totalPages: Math.ceil(total / limit),
        services
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getServiceById = async (id) => {
  try {
    const serviceId = toBigIntId(id);
    if (!serviceId) return { EM: 'Invalid service ID', EC: 1, DT: '' };

    const service = await prisma.clinicService.findUnique({
      where: { service_id: serviceId },
      include: { category: true }
    });

    if (!service) return { EM: 'Service not found', EC: -1, DT: '' };

    return { EM: 'Get service successful', EC: 0, DT: service };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createService = async (data) => {
  try {
    if (!data.service_name || !data.category_id || !data.base_price) {
      return { EM: 'Missing required fields', EC: 1, DT: '' };
    }

    const newService = await prisma.clinicService.create({
      data: {
        service_name: data.service_name,
        category_id: toBigIntId(data.category_id),
        description: data.description || null,
        base_price: parseFloat(data.base_price),
        duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : 30,
        status: data.status || 'active'
      }
    });

    return { EM: 'Create service successful', EC: 0, DT: newService };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateService = async (id, data) => {
  try {
    const serviceId = toBigIntId(id);
    if (!serviceId) return { EM: 'Invalid service ID', EC: 1, DT: '' };

    const updateData = {};
    if (data.service_name) updateData.service_name = data.service_name;
    if (data.category_id) updateData.category_id = toBigIntId(data.category_id);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.base_price) updateData.base_price = parseFloat(data.base_price);
    if (data.duration_minutes) updateData.duration_minutes = parseInt(data.duration_minutes);
    if (data.status) updateData.status = data.status;

    const updatedService = await prisma.clinicService.update({
      where: { service_id: serviceId },
      data: updateData
    });

    return { EM: 'Update service successful', EC: 0, DT: updatedService };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteService = async (id) => {
  try {
    const serviceId = toBigIntId(id);
    if (!serviceId) return { EM: 'Invalid service ID', EC: 1, DT: '' };

    await prisma.clinicService.update({
      where: { service_id: serviceId },
      data: { status: 'inactive' }
    });

    return { EM: 'Delete service successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getAllCategories,
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService
};
