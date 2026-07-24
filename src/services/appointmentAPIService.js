import prisma from '../configs/prisma';
import { serializeBigInt, toBigIntId } from '../utils/prismaHelpers';

const getMyHistory = async (userIdStr, query = {}) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const { status, keyword, page = 1, limit = 10 } = query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const take = parsedLimit;

    const whereClause = { user_id: userId };

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'missed'];
    if (status && validStatuses.includes(status)) {
      whereClause.status = status;
    }

    if (keyword && keyword.trim()) {
      const kw = keyword.trim();
      whereClause.OR = [
        { appointment_code: { contains: kw } },
        { pet_name_snapshot: { contains: kw } },
        {
          services: {
            some: {
              service: {
                service_name: { contains: kw }
              }
            }
          }
        }
      ];
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where: whereClause,
        include: {
          doctor: { select: { doctor_name: true, avatar_url: true } },
          branch: { select: { branch_name: true, address: true, phone: true } },
          pet: {
            select: {
              pet_name: true,
              age: true,
              gender: true,
              weight_kg: true,
              profile_image_url: true,
              health_status: true,
              medical_note: true,
              species: true,
              breed: true,
              pet_images: {
                where: { is_primary: true },
                take: 1
              }
            }
          },
          services: {
            include: {
              service: {
                select: {
                  service_id: true,
                  service_name: true,
                  description: true,
                  base_price: true,
                  duration_minutes: true,
                  image_url: true,
                  category: { select: { category_name: true } }
                }
              }
            }
          },
          payments: {
            select: {
              final_amount: true,
              status: true
            }
          }
        },
        orderBy: [
          { appointment_date: 'desc' },
          { start_time: 'desc' }
        ],
        skip,
        take
      }),
      prisma.appointment.count({ where: whereClause })
    ]);

    const formattedData = appointments.map(app => {
      const validPayment = app.payments.find(p => p.status !== 'failed' && p.status !== 'cancelled') || app.payments[0];
      let finalPrice = 0;
      if (validPayment) {
        finalPrice = parseFloat(validPayment.final_amount);
      } else {
        finalPrice = app.services.reduce((sum, s) => sum + parseFloat(s.total_price), 0);
      }
      
      const { payments, ...rest } = app;
      return {
        ...rest,
        final_price: finalPrice
      };
    });

    return {
      EM: 'Get history successful',
      EC: 0,
      DT: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        data: serializeBigInt(formattedData)
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getMyHistoryCounts = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const statusCounts = await prisma.appointment.groupBy({
      by: ['status'],
      where: { user_id: userId },
      _count: true
    });

    const counts = {
      all: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      rescheduled: 0,
      missed: 0
    };

    let totalAll = 0;
    statusCounts.forEach(item => {
      const countVal = item._count;
      const statusKey = item.status;
      if (statusKey in counts) {
        counts[statusKey] = countVal;
      }
      totalAll += countVal;
    });
    counts.all = totalAll;

    return { EM: 'Get counts successful', EC: 0, DT: counts };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const rescheduleAppointment = async (id, newSlotIdStr, user) => {
  try {
    const appointmentId = toBigIntId(id);
    const newSlotId = toBigIntId(newSlotIdStr);
    
    if (!appointmentId || !newSlotId) {
      return { EM: 'Invalid appointment ID or slot ID', EC: 1, DT: '' };
    }

    // 1. Find the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { appointment_id: appointmentId },
      include: {
        services: {
          include: {
            service: {
              include: { category: true }
            }
          }
        }
      }
    });

    if (!appointment) return { EM: 'Appointment not found', EC: -1, DT: '' };

    // 2. Validate permissions
    if (user.role_code === 'CUSTOMER' && user.user_id !== appointment.user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    // 3. Check status eligibility
    if (!['pending', 'confirmed'].includes(appointment.status)) {
      return { EM: `Không thể đổi lịch hẹn ở trạng thái ${appointment.status}`, EC: 1, DT: '' };
    }

    // 4. Check payment status
    if (!['unpaid', 'waiting_store_payment'].includes(appointment.payment_status)) {
      return { EM: 'Lịch hẹn đã thanh toán không thể tự đổi lịch trực tuyến', EC: 1, DT: '' };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get new slot
      const newSlot = await tx.timeSlot.findUnique({
        where: { slot_id: newSlotId }
      });

      if (!newSlot) throw new Error('Slot mới không tồn tại');
      if (newSlot.status !== 'available' || newSlot.booked_count >= newSlot.max_booking) {
        throw new Error('Slot mới đã đầy hoặc không có sẵn');
      }

      // Check slot type compatibility
      const serviceCategories = appointment.services.map(s => {
        const catName = s.service?.category?.category_name;
        if (catName === 'Khám & Điều trị') return 'exam';
        if (catName === 'Grooming & Spa' || catName === 'Combo Grooming & Spa') return 'grooming';
        return 'unknown';
      });
      const uniqueTypes = [...new Set(serviceCategories)];
      const selectedServiceType = uniqueTypes[0] || 'unknown';

      if (newSlot.slot_type !== selectedServiceType) {
        throw new Error(`Khung giờ mới không khớp với loại dịch vụ (${selectedServiceType === 'exam' ? 'Khám & Điều trị' : 'Grooming & Spa'})`);
      }

      // Nhả slot cũ
      const oldSlot = await tx.timeSlot.findUnique({
        where: { slot_id: appointment.slot_id }
      });
      if (oldSlot) {
        const newBookedCount = Math.max(0, oldSlot.booked_count - 1);
        await tx.timeSlot.update({
          where: { slot_id: oldSlot.slot_id },
          data: {
            booked_count: newBookedCount,
            status: newBookedCount < oldSlot.max_booking ? 'available' : oldSlot.status
          }
        });
      }

      // Chiếm slot mới
      const newBookedCount = newSlot.booked_count + 1;
      const newStatus = newBookedCount >= newSlot.max_booking ? 'full' : newSlot.status;
      await tx.timeSlot.update({
        where: { slot_id: newSlotId },
        data: {
          booked_count: newBookedCount,
          status: newStatus
        }
      });

      // Cập nhật appointment
      const updatedAppointment = await tx.appointment.update({
        where: { appointment_id: appointmentId },
        data: {
          slot_id: newSlotId,
          appointment_date: newSlot.slot_date,
          start_time: newSlot.start_time,
          doctor_id: newSlot.doctor_id,
          branch_id: newSlot.branch_id,
          status: 'rescheduled'
        }
      });

      // Log lịch sử
      await tx.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          old_status: appointment.status,
          new_status: 'rescheduled',
          changed_by_user_id: toBigIntId(user.user_id),
          reason: `Khách hàng đổi lịch sang ngày ${newSlot.slot_date.toISOString().substring(0, 10)} lúc ${newSlot.start_time.toISOString().substring(11, 16)}`
        }
      });

      // Tạo thông báo
      await tx.notification.create({
        data: {
          user_id: appointment.user_id,
          title: 'Đổi lịch hẹn thành công',
          content: `Lịch hẹn ${appointment.appointment_code} đã được đổi sang ngày ${newSlot.slot_date.toISOString().substring(0, 10)} lúc ${newSlot.start_time.toISOString().substring(11, 16)}.`,
          notification_type: 'system',
          channel: 'in_app',
          is_read: false
        }
      });

      return updatedAppointment;
    });

    return { EM: 'Đổi lịch hẹn thành công', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    const knownErrors = [
      'Slot mới không tồn tại',
      'Slot mới đã đầy hoặc không có sẵn'
    ];
    if (knownErrors.includes(error.message) || error.message.includes('khớp với loại dịch vụ')) {
      return { EM: error.message, EC: 2, DT: '' };
    }
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getAppointmentById = async (id, currentUser) => {
  try {
    const appointmentId = toBigIntId(id);
    if (!appointmentId) return { EM: 'Invalid appointment ID', EC: 1, DT: '' };

    const appointment = await prisma.appointment.findUnique({
      where: { appointment_id: appointmentId },
      include: {
        doctor: { select: { doctor_name: true, avatar_url: true } },
        pet: {
          select: {
            pet_name: true,
            gender: true,
            weight_kg: true,
            age: true,
            health_status: true,
            profile_image_url: true,
            pet_images: {
              where: { is_primary: true },
              take: 1
            }
          }
        },
        services: {
          include: {
            service: {
              include: {
                category: {
                  select: { category_name: true }
                }
              }
            }
          }
        },
        slot: {
          select: {
            start_time: true,
            end_time: true
          }
        },
        user: {
          select: {
            full_name: true,
            phone: true,
            user_addresses: {
              where: { is_default: true },
              take: 1
            }
          }
        },
        payments: {
          select: {
            payment_method: true,
            final_amount: true,
            status: true
          }
        },
        orders: {
          select: {
            shipping_address: true,
            total_amount: true
          },
          take: 1
        },
        status_history: {
          include: {
            changed_by: {
              select: { full_name: true }
            }
          },
          orderBy: { changed_at: 'asc' }
        }
      }
    });

    if (!appointment) return { EM: 'Appointment not found', EC: -1, DT: '' };

    if (currentUser.role_code === 'CUSTOMER' && currentUser.user_id !== appointment.user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    // Post-processing to extract final_price, payment_method, and customer_address
    const validPayment = appointment.payments.find(p => p.status !== 'failed' && p.status !== 'cancelled') || appointment.payments[0];
    let finalPrice = 0;
    let paymentMethod = 'store'; // default fallback
    if (validPayment) {
      finalPrice = parseFloat(validPayment.final_amount);
      paymentMethod = validPayment.payment_method;
    } else {
      finalPrice = appointment.services.reduce((sum, s) => sum + parseFloat(s.total_price), 0);
    }

    // Extract address
    let customerAddress = '';
    if (appointment.orders && appointment.orders.length > 0 && appointment.orders[0].shipping_address) {
      customerAddress = appointment.orders[0].shipping_address;
    } else if (appointment.user && appointment.user.user_addresses && appointment.user.user_addresses.length > 0) {
      const addr = appointment.user.user_addresses[0];
      customerAddress = [addr.address_line, addr.ward, addr.district, addr.province].filter(Boolean).join(', ');
    }

    // Clean up fields to match UI and prevent sending raw arrays of payments and orders
    const { payments, orders, ...rest } = appointment;
    const formattedData = {
      ...rest,
      final_price: finalPrice,
      payment_method: paymentMethod,
      customer_address: customerAddress
    };

    return { EM: 'Get appointment successful', EC: 0, DT: serializeBigInt(formattedData) };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getAvailableSlots = async (query) => {
  try {
    const { date, doctor_id, branch_id, service_type } = query;
    if (!date) return { EM: 'Missing date', EC: 1, DT: '' };

    const whereCondition = {
      slot_date: new Date(date),
      status: 'available'
    };

    if (doctor_id) whereCondition.doctor_id = toBigIntId(doctor_id);
    if (branch_id) whereCondition.branch_id = toBigIntId(branch_id);
    if (service_type) whereCondition.slot_type = service_type;

    const slots = await prisma.timeSlot.findMany({
      where: whereCondition,
      include: {
        doctor: { select: { doctor_name: true } }
      },
      orderBy: { start_time: 'asc' }
    });

    return { EM: 'Get slots successful', EC: 0, DT: slots };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const generateAppointmentCode = () => {
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const year = new Date().getFullYear();
  return `BK-${randomPart}-${year}`;
};

const normalizePaymentMethod = (method) => {
  if (!method) return 'store';
  const m = String(method).trim().toLowerCase();
  if (['online', 'banking', 'vnpay', 'momo', 'card', 'trực tuyến', 'truc tuyen'].includes(m)) return 'online';
  if (['cod', 'cash_on_delivery'].includes(m)) return 'cod';
  return 'store';
};

// Quy tắc phụ thu cân nặng chung (Luỹ tiến theo Service Price Matrix)
const calculateWeightSurcharge = (dbSvc, petWeightKg, quantity = 1) => {
  const basePrice = parseFloat(dbSvc.base_price || 0);

  // Nếu không áp dụng phụ thu, phí phụ thu là 0 và giá gốc được giữ nguyên
  if (!dbSvc || !dbSvc.is_weight_surcharge_applied) {
    return { surcharge: 0, unitPrice: basePrice, isContact: false };
  }

  const matrix = dbSvc.price_matrix || [];
  if (matrix.length === 0) {
    return { surcharge: 0, unitPrice: basePrice, isContact: false };
  }

  // Giá tiêu chuẩn là mức cân nặng đầu tiên (Dưới 3kg)
  const sortedMatrix = [...matrix].sort((a, b) => parseFloat(a.weight_min || 0) - parseFloat(b.weight_min || 0));
  const standardItem = sortedMatrix[0];
  const standardPrice = standardItem ? parseFloat(standardItem.price || 0) : basePrice;

  if (!petWeightKg) {
    return { surcharge: 0, unitPrice: standardPrice, isContact: false };
  }

  const weight = parseFloat(petWeightKg);
  if (isNaN(weight)) {
    return { surcharge: 0, unitPrice: standardPrice, isContact: false };
  }

  // Tìm khoảng cân nặng phù hợp
  const matchedItem = sortedMatrix.find(item => {
    const min = parseFloat(item.weight_min || 0);
    const max = item.weight_max ? parseFloat(item.weight_max) : null;
    if (max === null) {
      return weight >= min;
    }
    return weight >= min && weight <= max;
  });

  if (!matchedItem) {
    return { surcharge: 0, unitPrice: standardPrice, isContact: false };
  }

  if (matchedItem.is_contact) {
    return { surcharge: 0, unitPrice: standardPrice, isContact: true };
  }

  const actualPrice = parseFloat(matchedItem.price || 0);
  const surcharge = Math.max(0, actualPrice - standardPrice);

  return {
    surcharge: surcharge * quantity,
    unitPrice: standardPrice,
    isContact: false
  };
};

const normalizePetGender = (value) => {
  if (!value) return 'unknown';
  const val = String(value).trim().toLowerCase();
  if (['male', 'đực', 'duc', 'nam', 'm'].includes(val)) return 'male';
  if (['female', 'cái', 'cai', 'nữ', 'nu', 'f'].includes(val)) return 'female';
  return 'unknown';
};

const normalizePetHealthStatus = (value) => {
  if (!value) return 'unknown';
  const val = String(value).trim().toLowerCase();
  const statusMap = {
    normal: 'healthy',
    healthy: 'healthy',
    'bình thường': 'healthy',
    'binh thuong': 'healthy',
    treating: 'treating',
    'đang điều trị': 'treating',
    'dang dieu tri': 'treating',
    chronic: 'unknown',
    'có bệnh nền': 'unknown',
    'co benh nen': 'unknown',
    need_recheck: 'need_recheck',
    unknown: 'unknown'
  };

  return statusMap[val] || 'unknown';
};

const buildPetUpdateData = (petData = {}) => ({
  pet_name: petData.pet_name || undefined,
  species_id: petData.species_id ? toBigIntId(petData.species_id) : undefined,
  breed_id: petData.breed_id ? toBigIntId(petData.breed_id) : undefined,
  weight_kg: petData.weight_kg ? parseFloat(petData.weight_kg) : undefined,
  age: petData.age ? String(petData.age) : undefined,
  gender: petData.gender ? normalizePetGender(petData.gender) : undefined,
  health_status: petData.health_status ? normalizePetHealthStatus(petData.health_status) : undefined,
  medical_note: petData.medical_note || undefined
});

const buildPetCreateData = async (tx, petData = {}, userId) => {
  let speciesId = petData.species_id ? toBigIntId(petData.species_id) : null;
  
  if (!speciesId) {
    const nameSearch = petData.species_name || petData.species || 'Chó';
    const foundSpecies = await tx.petSpecies.findFirst({
      where: {
        OR: [
          { species_name: { contains: nameSearch } },
          { species_id: !isNaN(Number(nameSearch)) ? toBigIntId(nameSearch) : undefined }
        ].filter(Boolean)
      }
    });
    if (foundSpecies) {
      speciesId = foundSpecies.species_id;
    } else {
      const firstSpecies = await tx.petSpecies.findFirst();
      if (firstSpecies) speciesId = firstSpecies.species_id;
    }
  }

  if (!speciesId) throw new Error('Missing pet species');

  let breedId = petData.breed_id ? toBigIntId(petData.breed_id) : null;
  if (!breedId && (petData.breed_name || petData.breed)) {
    const breedSearch = petData.breed_name || petData.breed;
    const foundBreed = await tx.petBreed.findFirst({
      where: { breed_name: { contains: breedSearch } }
    });
    if (foundBreed) breedId = foundBreed.breed_id;
  }

  return {
    owner_user_id: userId,
    pet_name: petData.pet_name || 'Thú cưng',
    species_id: speciesId,
    breed_id: breedId,
    weight_kg: petData.weight_kg ? parseFloat(petData.weight_kg) : null,
    age: petData.age ? String(petData.age) : null,
    gender: normalizePetGender(petData.gender),
    health_status: normalizePetHealthStatus(petData.health_status),
    medical_note: petData.medical_note || null
  };
};

const createAppointment = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    const { 
      slot_id, 
      pet_id,
      pet_data,
      service_ids, 
      customer_name_snapshot,
      customer_phone_snapshot,
      note,
      condition_description 
    } = data;

    if (!slot_id || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
      return { EM: 'Missing slot_id or service_ids', EC: 1, DT: '' };
    }

    if (!customer_name_snapshot) {
      return { EM: 'Missing customer_name_snapshot', EC: 1, DT: '' };
    }

    if (customer_phone_snapshot) {
      const phoneRegex = /^\+?[0-9]{9,15}$/;
      if (!phoneRegex.test(String(customer_phone_snapshot).replace(/[\s-]/g, ''))) {
        return { EM: 'Số điện thoại liên hệ không hợp lệ', EC: 1, DT: '' };
      }
    }
    
    const safePhone = customer_phone_snapshot ? String(customer_phone_snapshot).substring(0, 20) : '';

    const slotIdBig = toBigIntId(slot_id);
    const petIdBig = pet_id ? toBigIntId(pet_id) : null;

    let servicesInput = service_ids.map(item => {
      if (typeof item === 'object' && item !== null && item.service_id) {
        return {
          service_id: toBigIntId(item.service_id),
          quantity: item.quantity ? parseInt(item.quantity, 10) : 1
        };
      } else {
        return {
          service_id: toBigIntId(item),
          quantity: 1
        };
      }
    });

    // We must use transaction to ensure slot availability
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock and check the slot
      const slot = await tx.timeSlot.findUnique({
        where: { slot_id: slotIdBig }
      });

      if (!slot) throw new Error('Slot not found');
      if (slot.status !== 'available' || slot.booked_count >= slot.max_booking) {
        throw new Error('Slot is fully booked or unavailable');
      }

      // Query service details to validate compatibility
      const serviceIdsToQuery = servicesInput.map(item => item.service_id);
      const dbServices = await tx.service.findMany({
        where: { service_id: { in: serviceIdsToQuery } },
        include: { category: true, price_matrix: true }
      });

      const serviceTypes = dbServices.map(s => {
        const catName = s.category?.category_name;
        if (catName === 'Khám & Điều trị') return 'exam';
        if (catName === 'Grooming & Spa' || catName === 'Combo Grooming & Spa') return 'grooming';
        return 'unknown';
      });

      const uniqueTypes = [...new Set(serviceTypes)];
      if (uniqueTypes.length > 1) {
        throw new Error('Chỉ được chọn một loại dịch vụ (Khám hoặc Grooming) cho mỗi lần đặt lịch');
      }
      if (uniqueTypes.includes('unknown')) {
        throw new Error('Loại dịch vụ không hợp lệ');
      }

      const selectedServiceType = uniqueTypes[0];
      if (slot.slot_type !== selectedServiceType) {
        throw new Error(`Khung giờ đã chọn không khớp với loại dịch vụ (${selectedServiceType === 'exam' ? 'Khám & Điều trị' : 'Grooming & Spa'})`);
      }

      // 2. Increase booked count
      const newBookedCount = slot.booked_count + 1;
      let newStatus = slot.status;
      if (newBookedCount >= slot.max_booking) {
        newStatus = 'full';
      }

      await tx.timeSlot.update({
        where: { slot_id: slotIdBig },
        data: {
          booked_count: newBookedCount,
          status: newStatus
        }
      });

      // 3. Get pet info if any
      let pet_name_snapshot = null;
      let pet_species_snapshot = null;
      let pet_breed_snapshot = null;
      let petWeightKg = null;
      
      let finalPetId = petIdBig;

      if (finalPetId) {
        if (pet_data) {
          // Update pet if pet_data is provided
          const updatedPet = await tx.pet.update({
            where: { pet_id: finalPetId },
            data: buildPetUpdateData(pet_data),
            include: { species: true, breed: true }
          });
          pet_name_snapshot = updatedPet.pet_name;
          pet_species_snapshot = updatedPet.species?.species_name || null;
          pet_breed_snapshot = updatedPet.breed?.breed_name || null;
          petWeightKg = updatedPet.weight_kg;
        } else {
          const pet = await tx.pet.findUnique({ 
            where: { pet_id: finalPetId }, 
            include: { species: true, breed: true } 
          });
          if (pet) {
            pet_name_snapshot = pet.pet_name;
            pet_species_snapshot = pet.species?.species_name || null;
            pet_breed_snapshot = pet.breed?.breed_name || null;
            petWeightKg = pet.weight_kg;
          }
        }
      } else if (pet_data) {
        // Create new pet
        const petCreateInput = await buildPetCreateData(tx, pet_data, userId);
        const newPet = await tx.pet.create({
          data: petCreateInput,
          include: { species: true, breed: true }
        });
        finalPetId = newPet.pet_id;
        pet_name_snapshot = newPet.pet_name;
        pet_species_snapshot = newPet.species?.species_name || null;
        pet_breed_snapshot = newPet.breed?.breed_name || null;
        petWeightKg = newPet.weight_kg ? parseFloat(newPet.weight_kg) : null;
      }

      const servicesMap = new Map();
      for (const item of servicesInput) {
        servicesMap.set(item.service_id.toString(), item.quantity);
      }

      // 5. Create appointment
      const newAppointment = await tx.appointment.create({
        data: {
          appointment_code: generateAppointmentCode(),
          user_id: userId,
          pet_id: finalPetId,
          doctor_id: slot.doctor_id,
          branch_id: slot.branch_id,
          slot_id: slotIdBig,
          appointment_date: slot.slot_date,
          start_time: slot.start_time,
          status: 'pending',
          note: note || null,
          condition_description: condition_description || null,
          customer_name_snapshot,
          customer_phone_snapshot: safePhone,
          pet_name_snapshot,
          pet_species_snapshot,
          pet_breed_snapshot
        }
      });

      // 6. Calculate surcharge per service is now done inside the loop

      // 7. Create appointment_services
      for (const s of dbServices) {
        const qty = servicesMap.get(s.service_id.toString()) || 1;
        const { surcharge, unitPrice, isContact } = calculateWeightSurcharge(s, petWeightKg, qty);
        if (isContact) {
          throw new Error(`Dịch vụ "${s.service_name}" không hỗ trợ đặt lịch online cho cân nặng hiện tại của thú cưng. Vui lòng liên hệ trực tiếp chi nhánh.`);
        }
        const totalPrice = (unitPrice * qty) + surcharge;

        await tx.appointmentService.create({
          data: {
            appointment_id: newAppointment.appointment_id,
            service_id: s.service_id,
            quantity: qty,
            unit_price: unitPrice,
            surcharge_amount: surcharge,
            total_price: totalPrice
          }
        });
      }

      // 8. Log history
      await tx.appointmentStatusHistory.create({
        data: {
          appointment_id: newAppointment.appointment_id,
          old_status: null,
          new_status: 'pending',
          changed_by_user_id: userId,
          reason: 'Khách hàng tạo lịch hẹn mới'
        }
      });

      return newAppointment;
    });

    return { EM: 'Create appointment successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    const knownErrors = [
      'Slot not found',
      'Slot is fully booked or unavailable',
      'Missing pet species',
      'Chỉ được chọn một loại dịch vụ (Khám hoặc Grooming) cho mỗi lần đặt lịch',
      'Loại dịch vụ không hợp lệ',
      'Khung giờ đã chọn không khớp với loại dịch vụ (Khám & Điều trị)',
      'Khung giờ đã chọn không khớp với loại dịch vụ (Grooming & Spa)'
    ];
    if (knownErrors.includes(error.message) || error.message.includes('không khớp với loại dịch vụ')) {
      return { EM: error.message, EC: 2, DT: '' };
    }
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateAppointmentStatus = async (id, status, user, note = '') => {
  try {
    const appointmentId = toBigIntId(id);
    if (!appointmentId) return { EM: 'Invalid ID', EC: 1, DT: '' };

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'missed'];
    if (!validStatuses.includes(status)) {
      return { EM: 'Invalid status', EC: 1, DT: '' };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { appointment_id: appointmentId },
      include: { user: true }
    });
    if (!appointment) return { EM: 'Appointment not found', EC: -1, DT: '' };

    // Check permissions
    if (user.role_code === 'CUSTOMER' && status !== 'cancelled') {
      return { EM: 'Customers can only cancel appointments', EC: -1, DT: '' };
    }
    if (user.role_code === 'CUSTOMER' && user.user_id !== appointment.user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const result = await prisma.$transaction(async (tx) => {
      // --- NO-SHOW RULE ---
      let isLateCancel = false;
      if (status === 'cancelled' && appointment.status !== 'cancelled') {
        // If cancel within 24h -> count as 1 penalty
        const timeDiff = new Date(appointment.appointment_date).getTime() - new Date().getTime();
        if (timeDiff < 24 * 60 * 60 * 1000) {
          isLateCancel = true;
          await tx.user.update({
            where: { user_id: appointment.user_id },
            data: { no_show_count: { increment: 1 } }
          });
        }
      }

      if (status === 'missed' && appointment.status !== 'missed') {
        const updatedUser = await tx.user.update({
          where: { user_id: appointment.user_id },
          data: { no_show_count: { increment: 1 } }
        });
        // Reminder for first no-show
        if (updatedUser.no_show_count === 1) {
          await tx.notification.create({
            data: {
              user_id: appointment.user_id,
              title: 'Nhắc nhở: Lịch hẹn bị bỏ lỡ',
              content: `Bạn đã không đến đúng hẹn cho lịch hẹn ${appointment.appointment_code}. Lưu ý: Nếu vắng mặt nhiều lần, bạn sẽ phải đặt cọc cho các lần đặt lịch sau.`,
              notification_type: 'system',
              channel: 'in_app',
              is_read: false
            }
          });
        }
      }
      // --------------------

      // If cancelling, free up the slot
      if ((status === 'cancelled' || status === 'missed') && appointment.status !== 'cancelled' && appointment.status !== 'missed') {
        const slot = await tx.timeSlot.findUnique({
          where: { slot_id: appointment.slot_id }
        });

        if (slot) {
          const newBookedCount = Math.max(0, slot.booked_count - 1);
          await tx.timeSlot.update({
            where: { slot_id: slot.slot_id },
            data: {
              booked_count: newBookedCount,
              status: newBookedCount < slot.max_booking ? 'available' : slot.status
            }
          });
        }
      }

      const updated = await tx.appointment.update({
        where: { appointment_id: appointmentId },
        data: { status }
      });

      let finalReason = note;
      if (isLateCancel) finalReason = (note ? note + ' - ' : '') + 'Huỷ sát giờ (Dưới 24h), tính 1 lần vi phạm.';

      await tx.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          old_status: appointment.status,
          new_status: status,
          changed_by_user_id: toBigIntId(user.user_id),
          reason: finalReason || null
        }
      });

      return updated;
    });

    return { EM: 'Update status successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getAppointmentPricing = async (id, currentUser, voucherCode) => {
  try {
    const appointmentId = toBigIntId(id);
    if (!appointmentId) return { EM: 'Invalid appointment ID', EC: 1, DT: '' };

    const appointment = await prisma.appointment.findUnique({
      where: { appointment_id: appointmentId },
      include: {
        services: {
          include: { service: { select: { service_name: true } } }
        },
        pet: { select: { weight_kg: true } }
      }
    });

    if (!appointment) return { EM: 'Appointment not found', EC: -1, DT: '' };

    // Check permission
    if (currentUser.role_code === 'CUSTOMER' && currentUser.user_id !== appointment.user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    // Calculate subtotal and surcharge from saved services
    let subtotal = 0;
    let surchargeAmount = 0;
    const services = appointment.services.map(item => {
      const uPrice = parseFloat(item.unit_price);
      const qty = item.quantity;
      const sCharge = parseFloat(item.surcharge_amount || 0);
      const lineTotal = (uPrice * qty) + sCharge;
      
      subtotal += uPrice * qty;
      surchargeAmount += sCharge;

      return {
        service_id: item.service_id.toString(),
        service_name: item.service?.service_name || 'Dịch vụ',
        quantity: qty,
        unit_price: uPrice,
        surcharge: sCharge,
        total: lineTotal
      };
    });

    // Validate and calculate voucher discount if voucherCode is passed
    let voucherId = null;
    let discountAmount = 0;
    let voucherError = null;

    if (voucherCode) {
      const vCode = voucherCode.toUpperCase();
      const voucher = await prisma.voucher.findUnique({ where: { voucher_code: vCode } });
      
      if (!voucher || voucher.status !== 'active') {
        voucherError = 'Mã giảm giá không tồn tại hoặc đã bị khóa';
      } else {
        const now = new Date();
        if (voucher.start_at && now < voucher.start_at) {
          voucherError = 'Mã giảm giá chưa đến thời gian sử dụng';
        } else if (voucher.end_at && now > voucher.end_at) {
          voucherError = 'Mã giảm giá đã hết hạn';
        } else if (voucher.target_type && !['all', 'appointment'].includes(voucher.target_type)) {
          voucherError = 'Mã giảm giá không áp dụng cho dịch vụ đặt lịch';
        } else if (voucher.min_order_amount && (subtotal + surchargeAmount) < parseFloat(voucher.min_order_amount)) {
          voucherError = `Mã giảm giá chỉ áp dụng cho đơn từ ${parseFloat(voucher.min_order_amount).toLocaleString('vi-VN')} đ`;
        } else if (voucher.remaining_usage !== null && voucher.remaining_usage <= 0) {
          voucherError = 'Mã giảm giá đã hết lượt sử dụng';
        } else {
          // Check if user already used this voucher
          const userUsed = await prisma.voucherUsage.findFirst({
            where: { user_id: appointment.user_id, voucher_id: voucher.voucher_id }
          });
          if (userUsed) {
            voucherError = 'Bạn đã sử dụng mã giảm giá này rồi';
          } else {
            voucherId = voucher.voucher_id;
            if (voucher.discount_type === 'percent') {
              discountAmount = (subtotal + surchargeAmount) * (parseFloat(voucher.discount_value) / 100);
              if (voucher.max_discount_amount && discountAmount > parseFloat(voucher.max_discount_amount)) {
                discountAmount = parseFloat(voucher.max_discount_amount);
              }
            } else if (voucher.discount_type === 'fixed') {
              discountAmount = parseFloat(voucher.discount_value);
            }

            if (discountAmount > (subtotal + surchargeAmount)) {
              discountAmount = subtotal + surchargeAmount;
            }
          }
        }
      }
    }

    const total = subtotal + surchargeAmount - discountAmount;

    return {
      EM: 'Calculate pricing successful',
      EC: 0,
      DT: {
        subtotal,
        surcharge_amount: surchargeAmount,
        discount_amount: discountAmount,
        total,
        services,
        pet_weight_kg: appointment.pet?.weight_kg ? parseFloat(appointment.pet.weight_kg) : null,
        voucher_id: voucherId ? voucherId.toString() : null,
        voucher_error: voucherError
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const checkoutAppointment = async (id, userIdStr, data) => {
  try {
    const appointmentId = toBigIntId(id);
    const userId = toBigIntId(userIdStr);
    const { payment_method, voucher_code } = data;

    if (!payment_method) {
      return { EM: 'Missing payment method', EC: 1, DT: '' };
    }

    if (!['store', 'online'].includes(payment_method)) {
      return { EM: 'Invalid payment method', EC: 1, DT: '' };
    }

    // Reuse pricing calculation
    const pricingRes = await getAppointmentPricing(id, { user_id: userIdStr, role_code: 'CUSTOMER' }, voucher_code);
    if (pricingRes.EC !== 0) {
      return pricingRes;
    }

    const { subtotal, surcharge_amount, discount_amount, total, voucher_id, voucher_error } = pricingRes.DT;

    if (voucher_code && voucher_error) {
      return { EM: voucher_error, EC: 1, DT: '' };
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get fresh locked appointment
      const appointment = await tx.appointment.findUnique({
        where: { appointment_id: appointmentId },
        include: { services: { include: { service: true } } }
      });

      if (!appointment) throw new Error('Appointment not found');
      if (appointment.status === 'cancelled') {
        throw new Error('Appointment is cancelled');
      }
      if (appointment.payment_status !== 'unpaid') {
        throw new Error('Appointment already checked out or paid');
      }

      // Generate order and payment codes
      const orderCode = `ORD-APT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const paymentCode = `PAY-APT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const normalizedPaymentMethod = normalizePaymentMethod(payment_method);
      const safeRecipientPhone = appointment.customer_phone_snapshot ? String(appointment.customer_phone_snapshot).substring(0, 20) : 'N/A';

      // 1. Create Order
      const newOrder = await tx.order.create({
        data: {
          order_code: orderCode,
          order_type: 'appointment',
          user_id: userId,
          appointment_id: appointmentId,
          recipient_name: appointment.customer_name_snapshot,
          recipient_phone: safeRecipientPhone,
          subtotal_amount: subtotal,
          discount_amount: discount_amount,
          points_discount_amount: 0,
          shipping_fee: 0,
          total_amount: total,
          order_status: 'pending',
          payment_status: 'unpaid'
        }
      });

      // 2. Create OrderItem snapshot for services
      for (const item of appointment.services) {
        const uPrice = parseFloat(item.unit_price);
        const sCharge = parseFloat(item.surcharge_amount || 0);
        const nameSnapshot = item.service?.service_name || 'Dịch vụ';

        await tx.orderItem.create({
          data: {
            order_id: newOrder.order_id,
            service_id: item.service_id,
            item_type: 'service',
            item_name_snapshot: nameSnapshot,
            quantity: item.quantity,
            unit_price: uPrice,
            total_price: (uPrice * item.quantity) + sCharge
          }
        });
      }

      // 3. Create Payment record
      const newPayment = await tx.payment.create({
        data: {
          payment_code: paymentCode,
          user_id: userId,
          order_id: newOrder.order_id,
          appointment_id: appointmentId,
          payment_target_type: 'appointment',
          payment_method: normalizedPaymentMethod,
          subtotal_amount: subtotal,
          voucher_discount_amount: discount_amount,
          points_used: 0,
          points_discount_amount: 0,
          final_amount: total,
          status: normalizedPaymentMethod === 'store' ? 'waiting_store_payment' : 'pending'
        }
      });

      // 4. Create VoucherUsage record + decrement voucher usage count if valid voucher is used
      if (voucher_id) {
        await tx.voucherUsage.create({
          data: {
            voucher_id: toBigIntId(voucher_id),
            user_id: userId,
            payment_id: newPayment.payment_id,
            discount_amount: discount_amount
          }
        });

        // Decrement remaining usage if not unlimited
        const voucher = await tx.voucher.findUnique({ where: { voucher_id: toBigIntId(voucher_id) } });
        if (voucher && voucher.remaining_usage !== null) {
          await tx.voucher.update({
            where: { voucher_id: toBigIntId(voucher_id) },
            data: { remaining_usage: { decrement: 1 } }
          });
        }
      }

      // 5. Update Appointment status and payment_status
      const newPaymentStatus = normalizedPaymentMethod === 'store' ? 'waiting_store_payment' : 'unpaid';
      
      const updatedAppointment = await tx.appointment.update({
        where: { appointment_id: appointmentId },
        data: {
          payment_status: newPaymentStatus
        }
      });

      // 6. Log appointment history
      await tx.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          old_status: appointment.status,
          new_status: appointment.status, // status unchanged, only payment status updated
          changed_by_user_id: userId,
          reason: `Xác nhận đặt lịch, thanh toán qua ${payment_method === 'store' ? 'Cửa hàng' : 'Trực tuyến'}`
        }
      });

      // 7. Create system notification
      await tx.notification.create({
        data: {
          user_id: userId,
          title: 'Đặt lịch thành công',
          content: `Lịch hẹn (Mã: ${appointment.appointment_code}) của bạn đã được xác nhận.`,
          type: 'system',
          is_read: false
        }
      });

      return {
        appointment: updatedAppointment,
        order: newOrder,
        payment: newPayment
      };
    });

    return { EM: 'Checkout appointment successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    if (error.message === 'Appointment not found' || 
        error.message === 'Appointment is cancelled' || 
        error.message === 'Appointment already checked out or paid') {
      return { EM: error.message, EC: 2, DT: '' };
    }
    return { EM: 'Something went wrong during checkout', EC: -2, DT: '' };
  }
};

// ==================== NEW APIS FOR UNIFIED BOOKING ==================== //

const previewPricing = async (data, currentUser) => {
  try {
    const { pet_data, service_ids, voucher_code } = data;
    
    if (!service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
      return { EM: 'Missing service_ids', EC: 1, DT: '' };
    }

    let servicesInput = service_ids.map(item => {
      if (typeof item === 'object' && item !== null && item.service_id) {
        return {
          service_id: toBigIntId(item.service_id),
          quantity: item.quantity ? parseInt(item.quantity, 10) : 1
        };
      } else {
        return {
          service_id: toBigIntId(item),
          quantity: 1
        };
      }
    });

    const serviceIdsToQuery = servicesInput.map(item => item.service_id);
    const dbServices = await prisma.service.findMany({
      where: { service_id: { in: serviceIdsToQuery } },
      include: { price_matrix: true }
    });

    const servicesMap = new Map();
    for (const item of servicesInput) {
      servicesMap.set(item.service_id.toString(), item.quantity);
    }

    let subtotal = 0;
    let surchargeAmount = 0;
    const petWeight = pet_data && pet_data.weight_kg ? parseFloat(pet_data.weight_kg) : 0;
    
    const servicesDetail = [];

    for (const dbSvc of dbServices) {
      const qty = servicesMap.get(dbSvc.service_id.toString()) || 1;
      const { surcharge: sCharge, unitPrice: uPrice, isContact } = calculateWeightSurcharge(dbSvc, petWeight, 1);
      if (isContact) {
        return { EM: `Dịch vụ "${dbSvc.service_name}" không hỗ trợ đặt lịch online cho cân nặng hiện tại của thú cưng. Vui lòng liên hệ trực tiếp chi nhánh.`, EC: 1, DT: '' };
      }
      
      surchargeAmount += (sCharge * qty);
      subtotal += (uPrice * qty);

      servicesDetail.push({
        service_id: dbSvc.service_id.toString(),
        service_name: dbSvc.service_name,
        quantity: qty,
        unit_price: uPrice,
        surcharge: sCharge,
        total: (uPrice * qty) + (sCharge * qty)
      });
    }

    let discountAmount = 0;
    let voucherError = null;

    if (voucher_code) {
      const vCode = voucher_code.toUpperCase();
      const voucher = await prisma.voucher.findUnique({ where: { voucher_code: vCode } });
      
      if (!voucher || voucher.status !== 'active') {
        voucherError = 'Mã giảm giá không tồn tại hoặc đã bị khóa';
      } else {
        const now = new Date();
        if (voucher.start_at && now < voucher.start_at) {
          voucherError = 'Mã giảm giá chưa đến thời gian sử dụng';
        } else if (voucher.end_at && now > voucher.end_at) {
          voucherError = 'Mã giảm giá đã hết hạn';
        } else if (voucher.target_type && !['all', 'appointment'].includes(voucher.target_type)) {
          voucherError = 'Mã giảm giá không áp dụng cho dịch vụ đặt lịch';
        } else if (voucher.min_order_amount && (subtotal + surchargeAmount) < parseFloat(voucher.min_order_amount)) {
          voucherError = `Mã giảm giá chỉ áp dụng cho đơn từ ${parseFloat(voucher.min_order_amount).toLocaleString('vi-VN')} đ`;
        } else if (voucher.remaining_usage !== null && voucher.remaining_usage <= 0) {
          voucherError = 'Mã giảm giá đã hết lượt sử dụng';
        } else {
          const userUsed = await prisma.voucherUsage.findFirst({
            where: { user_id: currentUser.user_id, voucher_id: voucher.voucher_id }
          });
          if (userUsed) {
            voucherError = 'Bạn đã sử dụng mã giảm giá này rồi';
          } else {
            if (voucher.discount_type === 'percent') {
              discountAmount = (subtotal + surchargeAmount) * (parseFloat(voucher.discount_value) / 100);
              if (voucher.max_discount_amount && discountAmount > parseFloat(voucher.max_discount_amount)) {
                discountAmount = parseFloat(voucher.max_discount_amount);
              }
            } else if (voucher.discount_type === 'fixed') {
              discountAmount = parseFloat(voucher.discount_value);
            }

            if (discountAmount > (subtotal + surchargeAmount)) {
              discountAmount = subtotal + surchargeAmount;
            }
          }
        }
      }
    }

    const total = subtotal + surchargeAmount - discountAmount;

    return {
      EM: 'Preview pricing successful',
      EC: 0,
      DT: {
        subtotal,
        surcharge_amount: surchargeAmount,
        discount_amount: discountAmount,
        total,
        services: servicesDetail,
        pet_weight_kg: petWeight,
        voucher_error: voucherError
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const bookAndCheckoutAppointment = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    const { 
      slot_id, 
      pet_id, 
      pet_data,
      service_ids, 
      customer_name_snapshot,
      customer_phone_snapshot,
      note,
      condition_description,
      payment_method, 
      voucher_code
    } = data;

    if (!slot_id || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
      return { EM: 'Missing slot_id or service_ids', EC: 1, DT: '' };
    }
    if (!customer_name_snapshot) {
      return { EM: 'Vui lòng cung cấp họ tên khách hàng', EC: 1, DT: '' };
    }

    if (customer_phone_snapshot) {
      const phoneRegex = /^\+?[0-9]{9,15}$/;
      if (!phoneRegex.test(String(customer_phone_snapshot).replace(/[\s-]/g, ''))) {
        return { EM: 'Số điện thoại liên hệ không hợp lệ', EC: 1, DT: '' };
      }
    }

    const safePhone = customer_phone_snapshot ? String(customer_phone_snapshot).substring(0, 20) : '';
    if (!payment_method) {
      return { EM: 'Missing payment method', EC: 1, DT: '' };
    }

    const normalizedPaymentMethod = normalizePaymentMethod(payment_method);

    // --- RULE: No-show checking ---
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (user && user.no_show_count >= 2 && normalizedPaymentMethod === 'store') {
      return { EM: 'Bạn đã vắng mặt nhiều lần. Vui lòng thanh toán trực tuyến (đặt cọc) để đặt lịch.', EC: 1, DT: '' };
    }

    const slotIdBig = toBigIntId(slot_id);
    const petIdBig = pet_id ? toBigIntId(pet_id) : null;

    let servicesInput = service_ids.map(item => {
      if (typeof item === 'object' && item !== null && item.service_id) {
        return {
          service_id: toBigIntId(item.service_id),
          quantity: item.quantity ? parseInt(item.quantity, 10) : 1
        };
      } else {
        return {
          service_id: toBigIntId(item),
          quantity: 1
        };
      }
    });

    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock slot
      const slot = await tx.timeSlot.findUnique({ where: { slot_id: slotIdBig } });
      if (!slot) throw new Error('Slot not found');
      if (slot.status !== 'available' || slot.booked_count >= slot.max_booking) {
        throw new Error('Slot is fully booked or unavailable');
      }

      // Validate service type compatibility
      const serviceIdsToQuery = servicesInput.map(item => item.service_id);
      const dbServices = await tx.service.findMany({
        where: { service_id: { in: serviceIdsToQuery } },
        include: { category: true, price_matrix: true }
      });

      const serviceTypes = dbServices.map(s => {
        const catName = s.category?.category_name;
        if (catName === 'Khám & Điều trị') return 'exam';
        if (catName === 'Grooming & Spa' || catName === 'Combo Grooming & Spa') return 'grooming';
        return 'unknown';
      });

      const uniqueTypes = [...new Set(serviceTypes)];
      if (uniqueTypes.length > 1) {
        throw new Error('Chỉ được chọn một loại dịch vụ (Khám hoặc Grooming) cho mỗi lần đặt lịch');
      }
      if (uniqueTypes.includes('unknown')) {
        throw new Error('Loại dịch vụ không hợp lệ');
      }

      const selectedServiceType = uniqueTypes[0];
      if (slot.slot_type !== selectedServiceType) {
        throw new Error(`Khung giờ đã chọn không khớp với loại dịch vụ (${selectedServiceType === 'exam' ? 'Khám & Điều trị' : 'Grooming & Spa'})`);
      }

      const newBookedCount = slot.booked_count + 1;
      let newStatus = slot.status;
      if (newBookedCount >= slot.max_booking) {
        newStatus = 'full';
      }

      await tx.timeSlot.update({
        where: { slot_id: slotIdBig },
        data: { booked_count: newBookedCount, status: newStatus }
      });

      // 2. Pet
      let pet_name_snapshot = null;
      let pet_species_snapshot = null;
      let pet_breed_snapshot = null;
      let petWeightKg = null;
      let finalPetId = petIdBig;

      if (finalPetId) {
        if (pet_data) {
          const updatedPet = await tx.pet.update({
            where: { pet_id: finalPetId },
            data: buildPetUpdateData(pet_data),
            include: { species: true, breed: true }
          });
          pet_name_snapshot = updatedPet.pet_name;
          pet_species_snapshot = updatedPet.species?.species_name || null;
          pet_breed_snapshot = updatedPet.breed?.breed_name || null;
          petWeightKg = updatedPet.weight_kg;
        } else {
          const pet = await tx.pet.findUnique({ 
            where: { pet_id: finalPetId }, 
            include: { species: true, breed: true } 
          });
          if (pet) {
            pet_name_snapshot = pet.pet_name;
            pet_species_snapshot = pet.species?.species_name || null;
            pet_breed_snapshot = pet.breed?.breed_name || null;
            petWeightKg = pet.weight_kg;
          }
        }
      } else if (pet_data) {
        const petCreateInput = await buildPetCreateData(tx, pet_data, userId);
        const newPet = await tx.pet.create({
          data: petCreateInput,
          include: { species: true, breed: true }
        });
        finalPetId = newPet.pet_id;
        pet_name_snapshot = newPet.pet_name;
        pet_species_snapshot = newPet.species?.species_name || null;
        pet_breed_snapshot = newPet.breed?.breed_name || null;
        petWeightKg = newPet.weight_kg ? parseFloat(newPet.weight_kg) : null;
      }

      // 3. Pricing & Services
      const servicesMap = new Map();
      for (const item of servicesInput) {
        servicesMap.set(item.service_id.toString(), item.quantity);
      }

      let subtotal = 0;
      let surchargeAmount = 0;
      const servicesDetail = [];

      for (const dbSvc of dbServices) {
        const qty = servicesMap.get(dbSvc.service_id.toString()) || 1;
        const { surcharge: sCharge, unitPrice: uPrice, isContact } = calculateWeightSurcharge(dbSvc, petWeightKg, 1);
        if (isContact) {
          throw new Error(`Dịch vụ "${dbSvc.service_name}" không hỗ trợ đặt lịch online cho cân nặng hiện tại của thú cưng. Vui lòng liên hệ trực tiếp chi nhánh.`);
        }
        surchargeAmount += (sCharge * qty);
        subtotal += (uPrice * qty);
        servicesDetail.push({
          service_id: dbSvc.service_id,
          quantity: qty,
          unit_price: uPrice,
          surcharge_amount: sCharge
        });
      }

      // 4. Voucher
      let voucherId = null;
      let discountAmount = 0;
      if (voucher_code) {
        const vCode = voucher_code.toUpperCase();
        const voucher = await tx.voucher.findUnique({ where: { voucher_code: vCode } });
        if (!voucher || voucher.status !== 'active') throw new Error('Mã giảm giá không hợp lệ');
        const now = new Date();
        if (voucher.start_at && now < voucher.start_at) throw new Error('Mã giảm giá chưa có hiệu lực');
        if (voucher.end_at && now > voucher.end_at) throw new Error('Mã giảm giá đã hết hạn');
        if (voucher.target_type && !['all', 'appointment'].includes(voucher.target_type)) throw new Error('Mã giảm giá không áp dụng cho Đặt lịch');
        if (voucher.min_order_amount && (subtotal + surchargeAmount) < parseFloat(voucher.min_order_amount)) throw new Error('Chưa đạt giá trị tối thiểu để dùng mã giảm giá');
        if (voucher.remaining_usage !== null && voucher.remaining_usage <= 0) throw new Error('Mã giảm giá đã hết lượt sử dụng');
        
        const userUsed = await tx.voucherUsage.findFirst({
          where: { user_id: userId, voucher_id: voucher.voucher_id }
        });
        if (userUsed) throw new Error('Bạn đã sử dụng mã giảm giá này rồi');

        voucherId = voucher.voucher_id;
        if (voucher.discount_type === 'percent') {
          discountAmount = (subtotal + surchargeAmount) * (parseFloat(voucher.discount_value) / 100);
          if (voucher.max_discount_amount && discountAmount > parseFloat(voucher.max_discount_amount)) {
            discountAmount = parseFloat(voucher.max_discount_amount);
          }
        } else if (voucher.discount_type === 'fixed') {
          discountAmount = parseFloat(voucher.discount_value);
        }
        if (discountAmount > (subtotal + surchargeAmount)) {
          discountAmount = subtotal + surchargeAmount;
        }

        if (voucher.remaining_usage !== null) {
          await tx.voucher.update({
            where: { voucher_id: voucherId },
            data: { remaining_usage: { decrement: 1 } }
          });
        }
      }

      const totalAmount = subtotal + surchargeAmount - discountAmount;
      const newPaymentStatus = 'unpaid'; // OrderPaymentStatus only has unpaid, paid, failed, refunded

      // 5. Create Appointment
      const appointmentCode = `APT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newAppointment = await tx.appointment.create({
        data: {
          appointment_code: appointmentCode,
          user_id: userId,
          pet_id: finalPetId,
          doctor_id: slot.doctor_id,
          branch_id: slot.branch_id,
          slot_id: slot.slot_id,
          appointment_date: slot.slot_date,
          start_time: slot.start_time,
          customer_name_snapshot,
          customer_phone_snapshot: safePhone,
          pet_name_snapshot,
          pet_species_snapshot,
          pet_breed_snapshot,
          condition_description: condition_description || null,
          note: note || null,
          status: normalizedPaymentMethod === 'store' ? 'pending' : 'confirmed', // If online, might be pending until paid, but simplified here
          payment_status: normalizedPaymentMethod === 'store' ? 'waiting_store_payment' : 'unpaid'
        }
      });

      // 6. Create Appointment Services
      for (const svc of servicesDetail) {
        await tx.appointmentService.create({
          data: {
            appointment_id: newAppointment.appointment_id,
            service_id: svc.service_id,
            quantity: svc.quantity,
            unit_price: svc.unit_price,
            surcharge_amount: svc.surcharge_amount,
            total_price: (svc.unit_price * svc.quantity) + (svc.surcharge_amount * svc.quantity)
          }
        });
      }

      // 7. Create Order & Payment
      const orderCode = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newOrder = await tx.order.create({
        data: {
          order_code: orderCode,
          order_type: 'appointment',
          user_id: userId,
          voucher_id: voucherId,
          recipient_name: customer_name_snapshot,
          recipient_phone: safePhone,
          shipping_address: 'In-store',
          subtotal_amount: subtotal + surchargeAmount,
          discount_amount: discountAmount,
          points_discount_amount: 0,
          shipping_fee: 0,
          total_amount: totalAmount,
          order_status: 'completed',
          payment_status: newPaymentStatus,
          note: `Thanh toán cho lịch hẹn ${appointmentCode}`
        }
      });

      const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newPayment = await tx.payment.create({
        data: {
          payment_code: paymentCode,
          user_id: userId,
          order_id: newOrder.order_id,
          appointment_id: newAppointment.appointment_id,
          payment_target_type: 'appointment',
          payment_method: normalizedPaymentMethod,
          subtotal_amount: subtotal + surchargeAmount,
          voucher_discount_amount: discountAmount,
          points_used: 0,
          points_discount_amount: 0,
          final_amount: totalAmount,
          status: normalizedPaymentMethod === 'store' ? 'waiting_store_payment' : 'pending',
          gateway_transaction_id: normalizedPaymentMethod === 'online' ? paymentCode : null
        }
      });

      if (voucherId) {
        await tx.voucherUsage.create({
          data: {
            user_id: userId,
            voucher_id: voucherId,
            payment_id: newPayment.payment_id,
            discount_amount: discountAmount
          }
        });
      }

      // 8. Notification
      await tx.notification.create({
        data: {
          user_id: userId,
          title: 'Đặt lịch thành công',
          content: `Lịch hẹn (Mã: ${appointmentCode}) của bạn đã được lưu thành công.`,
          notification_type: 'system',
          channel: 'in_app',
          is_read: false
        }
      });

      return {
        appointment: newAppointment,
        order: newOrder,
        payment: newPayment
      };
    });

    return { EM: 'Book and checkout successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    const knownErrors = [
      'Slot not found',
      'Slot is fully booked or unavailable',
      'Missing pet species',
      'Mã giảm giá không hợp lệ',
      'Mã giảm giá chưa có hiệu lực',
      'Mã giảm giá đã hết hạn',
      'Mã giảm giá không áp dụng cho Đặt lịch',
      'Chưa đạt giá trị tối thiểu để dùng mã giảm giá',
      'Mã giảm giá đã hết lượt sử dụng',
      'Bạn đã sử dụng mã giảm giá này rồi',
      'Chỉ được chọn một loại dịch vụ (Khám hoặc Grooming) cho mỗi lần đặt lịch',
      'Loại dịch vụ không hợp lệ',
      'Khung giờ đã chọn không khớp với loại dịch vụ (Khám & Điều trị)',
      'Khung giờ đã chọn không khớp với loại dịch vụ (Grooming & Spa)'
    ];
    if (knownErrors.includes(error.message) || error.message.includes('dịch vụ') || error.message.includes('không khớp')) {
      return { EM: error.message, EC: 2, DT: '' };
    }
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const generateSlotsForDate = async (dateStr) => {
  const dateObj = new Date(dateStr);
  const branches = await prisma.branch.findMany({
    where: { status: 'active' }
  });

  const examInterval = 30; // 30 mins
  const groomInterval = 60; // 60 mins

  for (const branch of branches) {
    // 1. Get existing slots for the branch and date to avoid duplicates
    const existingSlots = await prisma.timeSlot.findMany({
      where: {
        branch_id: branch.branch_id,
        slot_date: dateObj
      }
    });

    const existingKeys = new Set(
      existingSlots.map(s => `${s.slot_type}-${s.start_time.toISOString().substring(11, 19)}`)
    );

    const slotsToCreate = [];

    // 2. Exam Slots (8:00 to 20:00) -> 30-min interval, max_booking = 3
    let current = new Date(dateStr + 'T08:00:00.000Z');
    const examEnd = new Date(dateStr + 'T20:00:00.000Z');
    
    while (current.getTime() < examEnd.getTime()) {
      const next = new Date(current.getTime() + examInterval * 60000);
      
      const startTimeIso = current.toISOString().substring(11, 19);
      if (!existingKeys.has(`exam-${startTimeIso}`)) {
        const startTime = new Date(`1970-01-01T${startTimeIso}Z`);
        const endTime = new Date(`1970-01-01T${next.toISOString().substring(11, 19)}Z`);
        
        slotsToCreate.push({
          branch_id: branch.branch_id,
          slot_date: dateObj,
          start_time: startTime,
          end_time: endTime,
          max_booking: 3,
          slot_type: 'exam',
          status: 'available'
        });
      }
      
      current = next;
    }

    // 3. Grooming Slots (8:00 to 20:00) -> 60-min interval, max_booking = 2
    current = new Date(dateStr + 'T08:00:00.000Z');
    const groomEnd = new Date(dateStr + 'T20:00:00.000Z');
    
    while (current.getTime() < groomEnd.getTime()) {
      const next = new Date(current.getTime() + groomInterval * 60000);
      
      const startTimeIso = current.toISOString().substring(11, 19);
      if (!existingKeys.has(`grooming-${startTimeIso}`)) {
        const startTime = new Date(`1970-01-01T${startTimeIso}Z`);
        const endTime = new Date(`1970-01-01T${next.toISOString().substring(11, 19)}Z`);
        
        slotsToCreate.push({
          branch_id: branch.branch_id,
          slot_date: dateObj,
          start_time: startTime,
          end_time: endTime,
          max_booking: 2,
          slot_type: 'grooming',
          status: 'available'
        });
      }
      
      current = next;
    }

    // Insert new slots
    if (slotsToCreate.length > 0) {
      await prisma.timeSlot.createMany({
        data: slotsToCreate
      });
    }
  }
};

const generateAutoSlots = async (daysAhead = 7) => {
  try {
    const today = new Date();
    for (let i = 0; i <= daysAhead; i++) {
      const targetDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = targetDate.toISOString().substring(0, 10);
      await generateSlotsForDate(dateStr);
    }
    console.log(`Successfully generated/checked slots for today and ${daysAhead} days ahead.`);
  } catch (error) {
    console.error('Error generating auto slots:', error);
  }
};


module.exports = {
  getMyHistory,
  getMyHistoryCounts,
  rescheduleAppointment,
  getAppointmentById,
  getAvailableSlots,
  createAppointment,
  updateAppointmentStatus,
  getAppointmentPricing,
  checkoutAppointment,
  previewPricing,
  bookAndCheckoutAppointment,
  generateSlotsForDate,
  generateAutoSlots
};

