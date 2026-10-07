import mongoose from 'mongoose';
import Appointment from './models/Appointment';
import SlotReservation from './models/SlotReservation';
import Payment from '../payment/models/Payment';
import Service from '../catalog/models/Service';
import StaffProfile from '../staff/models/StaffProfile';
import AppError from '../../utils/AppError';

export const createAppointment = async (data, actor, guestToken) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { branchId, services, scheduledStart, petId, paymentMethod } = data; // services is array of { serviceId }
    
    // 1. Fetch Service Details to determine duration, role, pricing
    let totalDuration = 0;
    let finalAmount = 0;
    let depositRequired = 0;
    
    const segments = [];
    const startTime = new Date(scheduledStart);

    for (const s of services) {
      const service = await Service.findById(s.serviceId).session(session);
      if (!service) throw new AppError(404, 'NotFound', 'SERVICE_NOT_FOUND', `Service ${s.serviceId} not found`);

      // Mock calculation for slot duration (15 min unit)
      const durationMin = 30; // mock duration
      const durationUnits = durationMin / 15;
      
      const segmentStart = new Date(startTime.getTime() + totalDuration * 60000);
      
      // Auto-assign staff logic (Find first available staff)
      const staffList = await StaffProfile.find().session(session);
      let assignedStaffId = staffList.length > 0 ? staffList[0]._id : null; // simplified

      if (!assignedStaffId) throw new AppError(422, 'UnprocessableEntity', 'STAFF_UNAVAILABLE', 'No staff available for this role');

      // Create Slot Reservation (Double booking prevention via unique compound index)
      const reservation = new SlotReservation({
        branchId,
        staffId: assignedStaffId,
        kind: 'STAFF',
        status: 'HELD',
        slotStartUnit: Math.floor(segmentStart.getTime() / (15 * 60000)), // 15-min epoch
        unitIndex: 0,
        appointmentId: null // will update after appointment created
      });
      await reservation.save({ session }); // Will throw E11000 if double booked
      s._reservationId = reservation._id;

      segments.push({
        serviceId: service._id,
        serviceName: service.name,
        assignedStaffId,
        executionStatus: 'NOT_STARTED',
        price: service.basePrice || 100000
      });

      totalDuration += durationMin;
      finalAmount += service.basePrice || 100000;
      
      if (service.depositConfig && service.depositConfig.type === 'PERCENTAGE') {
        depositRequired += ((service.basePrice || 100000) * service.depositConfig.value) / 100;
      }
    }

    // Determine status and payment
    let status = 'PENDING_CONFIRMATION';
    let paymentAmount = finalAmount;
    let paymentKind = 'FULL';

    if (paymentMethod === 'PAY_AT_STORE') {
      if (depositRequired > 0) {
        status = 'PENDING_PAYMENT';
        paymentAmount = depositRequired;
        paymentKind = 'DEPOSIT';
      } else {
        paymentAmount = 0; // No payment upfront required
      }
    }

    const appointment = new Appointment({
      customerId: actor ? actor.id : undefined,
      branchId,
      petId,
      scheduledStart: startTime,
      scheduledEnd: new Date(startTime.getTime() + totalDuration * 60000),
      totalDuration,
      status,
      services: segments,
      pricing: { finalAmount, paidAmount: 0 },
      paymentMethod
    });

    await appointment.save({ session });

    // Update reservation with appointmentId
    for (const s of services) {
      await SlotReservation.findByIdAndUpdate(s._reservationId, { appointmentId: appointment._id }, { session });
    }

    // Create payment if needed
    if (paymentAmount > 0) {
      const payment = new Payment({
        targetType: 'APPOINTMENT',
        targetId: appointment._id,
        method: paymentMethod,
        kind: paymentKind,
        status: paymentMethod === 'ONLINE_MOCK' ? 'PAID' : 'PENDING',
        amount: paymentAmount
      });
      await payment.save({ session });

      if (paymentMethod === 'ONLINE_MOCK') {
        appointment.pricing.paidAmount = finalAmount;
        await appointment.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return appointment;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    if (error.code === 11000) {
      throw new AppError(409, 'Conflict', 'SLOT_UNAVAILABLE', 'The requested slot is already booked');
    }
    throw error;
  }
};

export const getAppointments = async () => Appointment.find();

export const confirmAppointment = async (id) => {
  const apt = await Appointment.findById(id);
  apt.status = 'CONFIRMED';
  await apt.save();
  return apt;
};

export const rescheduleAppointment = async (id, data, actor) => {
  // Omitted complex logic
  return await Appointment.findById(id);
};

export const cancelAppointment = async (id, actor) => {
  const apt = await Appointment.findById(id);
  apt.status = 'CANCELLED';
  await apt.save();
  return apt;
};

export const markNoShow = async (id, actor) => {
  const apt = await Appointment.findById(id);
  apt.status = 'NO_SHOW';
  await apt.save();
  return apt;
};

export const startSegment = async (id, serviceId, actor) => {
  const apt = await Appointment.findById(id);
  const segment = apt.services.find(s => s.serviceId.toString() === serviceId);
  segment.executionStatus = 'IN_PROGRESS';
  if (apt.status === 'CONFIRMED') apt.status = 'IN_PROGRESS';
  await apt.save();
  return apt;
};
