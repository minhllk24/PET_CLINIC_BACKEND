import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getAllUsers = async (limit, page) => {
  try {
    const skip = (page - 1) * limit;
    
    const [total, users] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.findMany({
        skip,
        take: limit,
        select: {
          user_id: true,
          full_name: true,
          email: true,
          phone: true,
          avatar_url: true,
          status: true,
          role: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      })
    ]);

    return {
      EM: 'Get users successful',
      EC: 0,
      DT: {
        totalRows: total,
        totalPages: Math.ceil(total / limit),
        users
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getUserById = async (id) => {
  try {
    const userId = toBigIntId(id);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone: true,
        avatar_url: true,
        status: true,
        role: true,
        created_at: true
      }
    });

    if (!user) {
      return { EM: 'User not found', EC: -1, DT: '' };
    }

    return { EM: 'Get user successful', EC: 0, DT: user };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateUser = async (id, data) => {
  try {
    const userId = toBigIntId(id);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const existingUser = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!existingUser) return { EM: 'User not found', EC: -1, DT: '' };

    // Prevent update to existing email/phone
    if (data.email && data.email !== existingUser.email) {
      const checkEmail = await prisma.user.findFirst({ where: { email: data.email } });
      if (checkEmail) return { EM: 'Email already exists', EC: 2, DT: '' };
    }

    if (data.phone && data.phone !== existingUser.phone) {
      const checkPhone = await prisma.user.findFirst({ where: { phone: data.phone } });
      if (checkPhone) return { EM: 'Phone already exists', EC: 2, DT: '' };
    }

    const updatedUser = await prisma.user.update({
      where: { user_id: userId },
      data: {
        full_name: data.full_name || existingUser.full_name,
        email: data.email || existingUser.email,
        phone: data.phone || existingUser.phone,
        avatar_url: data.avatar_url || existingUser.avatar_url,
        status: data.status || existingUser.status,
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone: true,
        avatar_url: true,
        status: true
      }
    });

    return { EM: 'Update user successful', EC: 0, DT: updatedUser };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteUser = async (id) => {
  try {
    const userId = toBigIntId(id);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (!user) return { EM: 'User not found', EC: -1, DT: '' };

    // Soft delete
    await prisma.user.update({
      where: { user_id: userId },
      data: { status: 'deleted' }
    });

    return { EM: 'Delete user successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getUserAddresses = async (id) => {
  try {
    const userId = toBigIntId(id);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const addresses = await prisma.userAddress.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });

    return { EM: 'Get user addresses successful', EC: 0, DT: addresses };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createAddress = async (id, data) => {
  try {
    const userId = toBigIntId(id);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const { recipient_name, recipient_phone, recipient_email, address_line, ward, district, province, country, is_default } = data;

    if (!recipient_name || !recipient_phone || !address_line) {
      return { EM: 'Missing required fields', EC: 1, DT: '' };
    }

    if (is_default) {
      await prisma.userAddress.updateMany({
        where: { user_id: userId },
        data: { is_default: false }
      });
    }

    const newAddress = await prisma.userAddress.create({
      data: {
        user_id: userId,
        recipient_name,
        recipient_phone,
        recipient_email: recipient_email || null,
        address_line,
        ward,
        district,
        province,
        country: country || null,
        is_default: is_default || false
      }
    });

    return { EM: 'Create address successful', EC: 0, DT: newAddress };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateAddress = async (addressId, data) => {
  try {
    const addrId = toBigIntId(addressId);
    if (!addrId) return { EM: 'Invalid address ID', EC: 1, DT: '' };

    const existingAddr = await prisma.userAddress.findUnique({ where: { address_id: addrId } });
    if (!existingAddr) return { EM: 'Address not found', EC: -1, DT: '' };

    if (data.is_default) {
      await prisma.userAddress.updateMany({
        where: { user_id: existingAddr.user_id },
        data: { is_default: false }
      });
    }

    const updatedAddr = await prisma.userAddress.update({
      where: { address_id: addrId },
      data: {
        recipient_name: data.recipient_name || existingAddr.recipient_name,
        recipient_phone: data.recipient_phone || existingAddr.recipient_phone,
        recipient_email: data.recipient_email !== undefined ? data.recipient_email : existingAddr.recipient_email,
        address_line: data.address_line || existingAddr.address_line,
        ward: data.ward || existingAddr.ward,
        district: data.district || existingAddr.district,
        province: data.province || existingAddr.province,
        country: data.country !== undefined ? data.country : existingAddr.country,
        is_default: data.is_default !== undefined ? data.is_default : existingAddr.is_default
      }
    });

    return { EM: 'Update address successful', EC: 0, DT: updatedAddr };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteAddress = async (addressId) => {
  try {
    const addrId = toBigIntId(addressId);
    if (!addrId) return { EM: 'Invalid address ID', EC: 1, DT: '' };

    const existingAddr = await prisma.userAddress.findUnique({ where: { address_id: addrId } });
    if (!existingAddr) return { EM: 'Address not found', EC: -1, DT: '' };

    await prisma.userAddress.delete({ where: { address_id: addrId } });

    return { EM: 'Delete address successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getDoctors = async () => {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { status: 'active' },
      select: {
        doctor_id: true,
        doctor_name: true,
        bio: true,
        avatar_url: true,
        average_rating: true,
        branch: {
          select: {
            branch_id: true,
            branch_name: true,
            address: true
          }
        },
        doctor_specialties: {
          select: {
            specialty: {
              select: {
                specialty_id: true,
                specialty_name: true
              }
            }
          }
        },
        user: {
          select: {
            email: true,
            phone: true
          }
        }
      }
    });

    return { EM: 'Get doctors successful', EC: 0, DT: doctors };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  getDoctors
};
