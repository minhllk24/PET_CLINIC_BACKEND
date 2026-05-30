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

const createAppointment = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    const { 
      slot_id, 
      pet_id, 
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
      if (petIdBig) {
        const pet = await tx.pet.findUnique({ 
          where: { pet_id: petIdBig }, 
          include: { species: true, breed: true } 
        });
        if (pet) {
          pet_name_snapshot = pet.pet_name;
          pet_species_snapshot = pet.species?.species_name || null;
          pet_breed_snapshot = pet.breed?.breed_name || null;
        }
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
          pet_id: petIdBig,
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

      // 6. Create appointment_services
      for (const s of dbServices) {
        const qty = servicesMap.get(s.service_id.toString()) || 1;
        const basePrice = parseFloat(s.base_price);
        const totalPrice = basePrice * qty;

        await tx.appointmentService.create({
          data: {
            appointment_id: newAppointment.appointment_id,
            service_id: s.service_id,
            quantity: qty,
            unit_price: basePrice,
            total_price: totalPrice
          }
        });
      }

      // 7. Log history
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

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) {
      return { EM: 'Invalid status', EC: 1, DT: '' };
    }

    const appointment = await prisma.appointment.findUnique({
      where: { appointment_id: appointmentId }
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
      // If cancelling, free up the slot
      if (status === 'cancelled' && appointment.status !== 'cancelled') {
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

      await tx.appointmentStatusHistory.create({
        data: {
          appointment_id: appointmentId,
          old_status: appointment.status,
          new_status: status,
          changed_by_user_id: toBigIntId(user.user_id),
          reason: note || null
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

module.exports = {
  getMyHistory,
  getAppointmentById,
  getAvailableSlots,
  createAppointment,
  updateAppointmentStatus
};
