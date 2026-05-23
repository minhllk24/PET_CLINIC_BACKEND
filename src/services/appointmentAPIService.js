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

    const slots = await prisma.clinicSlot.findMany({
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

const createAppointment = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    const { slot_id, pet_id, service_ids, reason } = data;

    if (!slot_id || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
      return { EM: 'Missing slot_id or service_ids', EC: 1, DT: '' };
    }

    const slotIdBig = toBigIntId(slot_id);
    const petIdBig = pet_id ? toBigIntId(pet_id) : null;

    // We must use transaction to ensure slot availability
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock and check the slot
      const slot = await tx.clinicSlot.findUnique({
        where: { slot_id: slotIdBig }
      });

      if (!slot) throw new Error('Slot not found');
      if (slot.status !== 'available' || slot.booked_count >= slot.max_capacity) {
        throw new Error('Slot is fully booked or unavailable');
      }

      // 2. Increase booked count
      const newBookedCount = slot.booked_count + 1;
      let newStatus = slot.status;
      if (newBookedCount >= slot.max_capacity) {
        newStatus = 'full';
      }

      await tx.clinicSlot.update({
        where: { slot_id: slotIdBig },
        data: {
          booked_count: newBookedCount,
          status: newStatus
        }
      });

      // 3. Get pet info if any
      let snapshot_pet_name = null;
      let snapshot_species = null;
      if (petIdBig) {
        const pet = await tx.pet.findUnique({ where: { pet_id: petIdBig }, include: { species: true } });
        if (pet) {
          snapshot_pet_name = pet.pet_name;
          snapshot_species = pet.species?.species_name || null;
        }
      }

      // 4. Calculate total estimated price from services
      let totalEstimatedPrice = 0;
      const services = await tx.clinicService.findMany({
        where: { service_id: { in: service_ids.map(id => toBigIntId(id)) } }
      });
      for (const s of services) {
        totalEstimatedPrice += parseFloat(s.base_price);
      }

      // 5. Create appointment
      const newAppointment = await tx.appointment.create({
        data: {
          user_id: userId,
          pet_id: petIdBig,
          doctor_id: slot.doctor_id,
          branch_id: slot.branch_id,
          appointment_date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          status: 'pending',
          reason: reason || null,
          snapshot_pet_name,
          snapshot_species,
          total_estimated_price: totalEstimatedPrice
        }
      });

      // 6. Create appointment_services
      for (const s of services) {
        await tx.appointmentService.create({
          data: {
            appointment_id: newAppointment.appointment_id,
            service_id: s.service_id,
            price_at_booking: s.base_price
          }
        });
      }

      // 7. Log history
      await tx.appointmentStatusHistory.create({
        data: {
          appointment_id: newAppointment.appointment_id,
          status_from: null,
          status_to: 'pending',
          changed_by: userId,
          note: 'Created by user'
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
        const slot = await tx.clinicSlot.findFirst({
          where: {
            doctor_id: appointment.doctor_id,
            slot_date: appointment.appointment_date,
            start_time: appointment.start_time
          }
        });

        if (slot) {
          const newBookedCount = Math.max(0, slot.booked_count - 1);
          await tx.clinicSlot.update({
            where: { slot_id: slot.slot_id },
            data: {
              booked_count: newBookedCount,
              status: newBookedCount < slot.max_capacity ? 'available' : slot.status
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
          status_from: appointment.status,
          status_to: status,
          changed_by: toBigIntId(user.user_id),
          note: note
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
