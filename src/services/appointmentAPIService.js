import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getMyHistory = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const appointments = await prisma.appointment.findMany({
      where: { user_id: userId },
      include: {
        doctor: { select: { full_name: true } },
        pet: { select: { pet_name: true, species: true } },
        appointment_services: {
          include: { service: { select: { service_name: true } } }
        }
      },
      orderBy: [
        { appointment_date: 'desc' },
        { start_time: 'desc' }
      ]
    });

    return { EM: 'Get history successful', EC: 0, DT: appointments };
  } catch (error) {
    console.error(error);
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
        doctor: { select: { full_name: true } },
        pet: { select: { pet_name: true } },
        appointment_services: { include: { service: true } },
        appointment_status_history: true
      }
    });

    if (!appointment) return { EM: 'Appointment not found', EC: -1, DT: '' };

    if (currentUser.role_code === 'CUSTOMER' && currentUser.user_id !== appointment.user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    return { EM: 'Get appointment successful', EC: 0, DT: appointment };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getAvailableSlots = async (query) => {
  try {
    const { date, doctor_id, branch_id } = query;
    if (!date) return { EM: 'Missing date', EC: 1, DT: '' };

    const whereCondition = {
      slot_date: new Date(date),
      status: 'available'
    };

    if (doctor_id) whereCondition.doctor_id = toBigIntId(doctor_id);
    if (branch_id) whereCondition.branch_id = toBigIntId(branch_id);

    const slots = await prisma.timeSlot.findMany({
      where: whereCondition,
      include: {
        doctor: { select: { full_name: true } }
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

// Quy tắc phụ thu cân nặng chung
const WEIGHT_SURCHARGE_THRESHOLD = 5; // kg
const WEIGHT_SURCHARGE_AMOUNT = 50000; // VND

const calculateWeightSurcharge = (petWeight) => {
  if (!petWeight) return 0;
  const weight = parseFloat(petWeight);
  if (isNaN(weight)) return 0;
  return weight > WEIGHT_SURCHARGE_THRESHOLD ? WEIGHT_SURCHARGE_AMOUNT : 0;
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
            data: {
              pet_name: pet_data.pet_name,
              species_id: pet_data.species_id ? toBigIntId(pet_data.species_id) : undefined,
              breed_id: pet_data.breed_id ? toBigIntId(pet_data.breed_id) : undefined,
              weight_kg: pet_data.weight_kg ? parseFloat(pet_data.weight_kg) : undefined,
              age: pet_data.age ? parseFloat(pet_data.age) : undefined,
              gender: pet_data.gender,
              health_condition: pet_data.health_condition
            },
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
      } else if (pet_data && pet_data.pet_name) {
        // Create new pet
        const newPet = await tx.pet.create({
          data: {
            user_id: userId,
            pet_name: pet_data.pet_name,
            species_id: pet_data.species_id ? toBigIntId(pet_data.species_id) : null,
            breed_id: pet_data.breed_id ? toBigIntId(pet_data.breed_id) : null,
            weight_kg: pet_data.weight_kg ? parseFloat(pet_data.weight_kg) : null,
            age: pet_data.age ? parseFloat(pet_data.age) : null,
            gender: pet_data.gender || 'unknown',
            health_condition: pet_data.health_condition || 'Normal'
          },
          include: { species: true, breed: true }
        });
        finalPetId = newPet.pet_id;
        pet_name_snapshot = newPet.pet_name;
        pet_species_snapshot = newPet.species?.species_name || null;
        pet_breed_snapshot = newPet.breed?.breed_name || null;
        petWeightKg = newPet.weight_kg;
      }

      // 4. Get service details
      const serviceIdsToQuery = servicesInput.map(item => item.service_id);
      const dbServices = await tx.service.findMany({
        where: { service_id: { in: serviceIdsToQuery } }
      });

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
          customer_phone_snapshot: customer_phone_snapshot || null,
          pet_name_snapshot,
          pet_species_snapshot,
          pet_breed_snapshot
        }
      });

      // 6. Calculate surcharge per service
      const surchargePerService = calculateWeightSurcharge(petWeightKg);

      // 7. Create appointment_services
      for (const s of dbServices) {
        const qty = servicesMap.get(s.service_id.toString()) || 1;
        const basePrice = parseFloat(s.base_price);
        const serviceSurcharge = surchargePerService * qty;
        const totalPrice = (basePrice * qty) + serviceSurcharge;

        await tx.appointmentService.create({
          data: {
            appointment_id: newAppointment.appointment_id,
            service_id: s.service_id,
            quantity: qty,
            unit_price: basePrice,
            surcharge_amount: serviceSurcharge,
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
    if (error.message === 'Slot is fully booked or unavailable') {
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
              type: 'system',
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

      // 1. Create Order
      const newOrder = await tx.order.create({
        data: {
          order_code: orderCode,
          order_type: 'appointment',
          user_id: userId,
          appointment_id: appointmentId,
          recipient_name: appointment.customer_name_snapshot,
          recipient_phone: appointment.customer_phone_snapshot,
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
          payment_method: payment_method, // 'store' or 'online'
          subtotal_amount: subtotal,
          voucher_discount_amount: discount_amount,
          points_used: 0,
          points_discount_amount: 0,
          final_amount: total,
          status: 'pending'
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
      const newPaymentStatus = payment_method === 'store' ? 'waiting_store_payment' : 'unpaid';
      
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
      where: { service_id: { in: serviceIdsToQuery } }
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
      const uPrice = parseFloat(dbSvc.base_price);
      
      let sCharge = 0;
      if (dbSvc.is_weight_surcharge_applied && petWeight > 5) {
        const extraWeight = petWeight - 5;
        sCharge = Math.ceil(extraWeight) * 10000;
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
      return { EM: 'Missing customer_name_snapshot', EC: 1, DT: '' };
    }
    if (!payment_method) {
      return { EM: 'Missing payment method', EC: 1, DT: '' };
    }

    // --- RULE: No-show checking ---
    const user = await prisma.user.findUnique({ where: { user_id: userId } });
    if (user && user.no_show_count >= 2 && payment_method === 'store') {
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
            data: {
              pet_name: pet_data.pet_name,
              species_id: pet_data.species_id ? toBigIntId(pet_data.species_id) : undefined,
              breed_id: pet_data.breed_id ? toBigIntId(pet_data.breed_id) : undefined,
              weight_kg: pet_data.weight_kg ? parseFloat(pet_data.weight_kg) : undefined,
              age: pet_data.age ? parseFloat(pet_data.age) : undefined,
              gender: pet_data.gender,
              health_condition: pet_data.health_condition
            },
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
      } else if (pet_data && pet_data.pet_name) {
        const newPet = await tx.pet.create({
          data: {
            user_id: userId,
            pet_name: pet_data.pet_name,
            species_id: pet_data.species_id ? toBigIntId(pet_data.species_id) : null,
            breed_id: pet_data.breed_id ? toBigIntId(pet_data.breed_id) : null,
            weight_kg: pet_data.weight_kg ? parseFloat(pet_data.weight_kg) : null,
            age: pet_data.age ? parseFloat(pet_data.age) : null,
            gender: pet_data.gender || 'unknown',
            health_condition: pet_data.health_condition || 'Normal'
          },
          include: { species: true, breed: true }
        });
        finalPetId = newPet.pet_id;
        pet_name_snapshot = newPet.pet_name;
        pet_species_snapshot = newPet.species?.species_name || null;
        pet_breed_snapshot = newPet.breed?.breed_name || null;
        petWeightKg = newPet.weight_kg;
      }

      // 3. Pricing & Services
      const serviceIdsToQuery = servicesInput.map(item => item.service_id);
      const dbServices = await tx.service.findMany({
        where: { service_id: { in: serviceIdsToQuery } }
      });
      const servicesMap = new Map();
      for (const item of servicesInput) {
        servicesMap.set(item.service_id.toString(), item.quantity);
      }

      let subtotal = 0;
      let surchargeAmount = 0;
      const servicesDetail = [];

      for (const dbSvc of dbServices) {
        const qty = servicesMap.get(dbSvc.service_id.toString()) || 1;
        const uPrice = parseFloat(dbSvc.base_price);
        let sCharge = 0;
        if (dbSvc.is_weight_surcharge_applied && petWeightKg && petWeightKg > 5) {
          const extraWeight = petWeightKg - 5;
          sCharge = Math.ceil(extraWeight) * 10000;
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

        // Apply voucher usage
        await tx.voucherUsage.create({
          data: {
            user_id: userId,
            voucher_id: voucherId,
            order_id: null // Set later
          }
        });
        if (voucher.remaining_usage !== null) {
          await tx.voucher.update({
            where: { voucher_id: voucherId },
            data: { remaining_usage: { decrement: 1 } }
          });
        }
      }

      const totalAmount = subtotal + surchargeAmount - discountAmount;
      const newPaymentStatus = payment_method === 'store' ? 'waiting_store_payment' : 'unpaid';

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
          appointment_date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          customer_name_snapshot,
          customer_phone_snapshot,
          pet_name_snapshot,
          pet_species_snapshot,
          pet_breed_snapshot,
          condition_description: condition_description || null,
          note: note || null,
          status: payment_method === 'store' ? 'pending' : 'confirmed', // If online, might be pending until paid, but simplified here
          payment_status: newPaymentStatus
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
            surcharge_amount: svc.surcharge_amount
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
          recipient_phone: customer_phone_snapshot,
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

      if (voucherId) {
        await tx.voucherUsage.updateMany({
          where: { user_id: userId, voucher_id: voucherId, order_id: null },
          data: { order_id: newOrder.order_id }
        });
      }

      const paymentCode = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newPayment = await tx.payment.create({
        data: {
          payment_code: paymentCode,
          order_id: newOrder.order_id,
          appointment_id: newAppointment.appointment_id,
          payment_method: payment_method,
          payment_status: newPaymentStatus,
          amount: totalAmount,
          transaction_id: paymentCode
        }
      });

      // 8. Notification
      await tx.notification.create({
        data: {
          user_id: userId,
          title: 'Đặt lịch thành công',
          content: `Lịch hẹn (Mã: ${appointmentCode}) của bạn đã được lưu thành công.`,
          type: 'system',
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
    if (error.message === 'Slot not found' || 
        error.message === 'Slot is fully booked or unavailable' ||
        error.message === 'Mã giảm giá không hợp lệ' ||
        error.message === 'Mã giảm giá chưa có hiệu lực' ||
        error.message === 'Mã giảm giá đã hết hạn' ||
        error.message === 'Mã giảm giá không áp dụng cho Đặt lịch' ||
        error.message === 'Chưa đạt giá trị tối thiểu để dùng mã giảm giá' ||
        error.message === 'Mã giảm giá đã hết lượt sử dụng' ||
        error.message === 'Bạn đã sử dụng mã giảm giá này rồi') {
      return { EM: error.message, EC: 2, DT: '' };
    }
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};


module.exports = {, previewPricing, bookAndCheckoutAppointment };
