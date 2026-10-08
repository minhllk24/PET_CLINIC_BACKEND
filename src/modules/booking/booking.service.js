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

    let appointmentServiceType = null;
    for (const s of services) {
      const service = await Service.findById(s.serviceId).session(session);
      if (!service) throw new AppError(404, 'NotFound', 'SERVICE_NOT_FOUND', `Service ${s.serviceId} not found`);

      if (!appointmentServiceType) {
        appointmentServiceType = service.serviceType;
      } else if (appointmentServiceType !== service.serviceType) {
        throw new AppError(400, 'BadRequest', 'SERVICE_TYPE_MISMATCH', 'All services in an appointment must have the same serviceType');
      }

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
    }

    // V7 Payment Logic
    let status = '';
    let paymentAmount = 0;
    let paymentKind = '';
    let depositAmount = 0;
    let balanceAmount = 0;
    let paidAmount = 0;

    if (paymentMethod === 'PAY_AT_STORE') {
      depositAmount = Math.round(finalAmount * 0.30);
      balanceAmount = finalAmount - depositAmount;
      paymentAmount = depositAmount;
      paymentKind = 'DEPOSIT';
      status = 'PENDING_PAYMENT';
    } else if (paymentMethod === 'ONLINE_MOCK') {
      paymentAmount = finalAmount;
      paidAmount = finalAmount;
      depositAmount = 0;
      balanceAmount = 0;
      paymentKind = 'FULL';
      status = 'PENDING_CONFIRMATION';
    }

    const holdExpiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes hold

    const appointment = new Appointment({
      customerId: actor ? actor.id : undefined,
      branchId,
      petId,
      scheduledStart: startTime,
      scheduledEnd: new Date(startTime.getTime() + totalDuration * 60000),
      totalDuration,
      status,
      services: segments,
      pricing: { finalAmount, paidAmount, depositAmount, balanceAmount },
      paymentMethod,
      holdExpiresAt
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

      if (paymentMethod === 'PAY_AT_STORE') {
        appointment.prepaymentId = payment._id;
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');
    
    const now = new Date();
    const hoursBeforeStart = (apt.scheduledStart.getTime() - now.getTime()) / 3600000;
    let penalty = 0;

    // TA-30 Logic: penalty applies only if canceled by Customer < 24h
    if (actor && actor.systemRole !== 'STAFF' && actor.systemRole !== 'ADMIN' && actor.systemRole !== 'MANAGER') {
      if (hoursBeforeStart < 24) {
        penalty = Math.round(apt.pricing.finalAmount * 0.30);
      }
    }

    const refundAmount = Math.max(0, (apt.pricing.paidAmount || 0) - penalty);

    apt.status = 'CANCELLED';
    apt.cancel = {
      by: actor && ['STAFF', 'ADMIN', 'MANAGER'].includes(actor.systemRole) ? 'STORE' : 'CUSTOMER',
      at: now,
      actorId: actor ? actor.id : null,
      reason: 'User requested cancellation',
      hoursBeforeStart,
      prepaidOutcome: refundAmount > 0 ? 'REFUND_PENDING' : 'FORFEITED'
    };

    if (refundAmount > 0) {
      const payment = await Payment.findOne({ targetType: 'APPOINTMENT', targetId: apt._id, status: 'PAID' }).session(session);
      if (payment) {
        payment.status = 'REFUND_PENDING';
        await payment.save({ session });
      }
    }

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();
    return apt;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const markNoShow = async (id, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const apt = await Appointment.findById(id).session(session);
    if (!apt) throw new AppError(404, 'NotFound', 'APPOINTMENT_NOT_FOUND', 'Appointment not found');

    const penalty = Math.round(apt.pricing.finalAmount * 0.30);
    const refundAmount = Math.max(0, (apt.pricing.paidAmount || 0) - penalty);

    apt.status = 'NO_SHOW';
    apt.cancel = {
      by: 'SYSTEM',
      at: new Date(),
      actorId: actor ? actor.id : null,
      reason: 'NO_SHOW',
      hoursBeforeStart: 0,
      prepaidOutcome: refundAmount > 0 ? 'REFUND_PENDING' : 'FORFEITED'
    };

    if (refundAmount > 0) {
      const payment = await Payment.findOne({ targetType: 'APPOINTMENT', targetId: apt._id, status: 'PAID' }).session(session);
      if (payment) {
        payment.status = 'REFUND_PENDING';
        await payment.save({ session });
      }
    }

    await apt.save({ session });
    await session.commitTransaction();
    session.endSession();
    return apt;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

export const startSegment = async (id, serviceId, actor) => {
  const apt = await Appointment.findById(id);
  const segment = apt.services.find(s => s.serviceId.toString() === serviceId);
  segment.executionStatus = 'IN_PROGRESS';
  if (apt.status === 'CONFIRMED') apt.status = 'IN_PROGRESS';
  await apt.save();
  return apt;
};

export const mockCompletePayment = async (prepaymentId, actor) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const payment = await Payment.findById(prepaymentId).session(session);
    if (!payment) throw new AppError(404, 'NotFound', 'PAYMENT_NOT_FOUND', 'Payment not found');
    if (payment.status === 'PAID') {
      await session.abortTransaction();
      session.endSession();
      return { message: 'Already paid' };
    }
    if (payment.status !== 'PENDING') throw new AppError(400, 'BadRequest', 'INVALID_STATE', 'Payment is not PENDING');

    payment.status = 'PAID';
    payment.paidAt = new Date();
    await payment.save({ session });

    if (payment.targetType === 'APPOINTMENT') {
      const apt = await Appointment.findById(payment.targetId).session(session);
      if (apt && apt.status === 'PENDING_PAYMENT') {
        apt.pricing.paidAmount += payment.amount;
        apt.status = 'PENDING_CONFIRMATION';
        apt.holdExpiresAt = new Date(Date.now() + 10 * 60000); 
        await apt.save({ session });
      }
    }
    await session.commitTransaction();
    session.endSession();
    return payment;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
