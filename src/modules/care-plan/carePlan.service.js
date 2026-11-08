import mongoose from 'mongoose';
import Pet from '../customer/models/Pet';
import Customer from '../customer/models/Customer';
import Appointment from '../booking/models/Appointment';
import ServiceRecord from '../execution/models/ServiceRecord';
import CarePlanTaskState from './models/CarePlanTaskState';
import Notification from '../notification/models/Notification';
import { buildPetCarePlan } from './carePlan.rules';
import AppError from '../../utils/AppError';

const checkPetAccess = async (petId, actor) => {
  if (!mongoose.Types.ObjectId.isValid(petId)) {
    throw new AppError(400, 'Bad Request', 'INVALID_ID', 'Invalid pet ID');
  }

  const pet = await Pet.findById(petId).lean();
  if (!pet) {
    throw new AppError(404, 'Not Found', 'PET_NOT_FOUND', 'Pet not found');
  }

  if (actor && actor.systemRole === 'CUSTOMER') {
    const customer = await Customer.findOne({ userId: actor.id }).lean();
    if (!customer || pet.customerId.toString() !== customer._id.toString()) {
      throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Access denied to this pet');
    }
  }

  return pet;
};

export const getCarePlan = async (petId, actor) => {
  const pet = await checkPetAccess(petId, actor);

  const [appointments, serviceRecords, taskStates] = await Promise.all([
    Appointment.find({ petId: pet._id })
      .populate('service', 'code name serviceType')
      .sort({ startTime: -1 })
      .limit(50)
      .lean(),
    ServiceRecord.find({ petId: pet._id })
      .populate('serviceIds', 'code name serviceType')
      .sort({ actualEndAt: -1, createdAt: -1 })
      .limit(50)
      .lean(),
    CarePlanTaskState.find({ petId: pet._id }).lean(),
  ]);

  return buildPetCarePlan({
    pet,
    appointments,
    serviceRecords,
    taskStates,
  });
};

export const updateTaskState = async (petId, taskKey, data = {}, actor) => {
  const pet = await checkPetAccess(petId, actor);

  const updateFields = {};
  if (data.completed !== undefined) {
    updateFields.completed = Boolean(data.completed);
    updateFields.completedAt = data.completed ? new Date() : null;
  }
  if (data.notes !== undefined) {
    updateFields.notes = String(data.notes).trim();
  }
  if (data.snoozedUntil !== undefined) {
    updateFields.snoozedUntil = data.snoozedUntil ? new Date(data.snoozedUntil) : null;
  }

  const state = await CarePlanTaskState.findOneAndUpdate(
    { petId: pet._id, taskKey },
    {
      $set: {
        customerId: pet.customerId,
        ...updateFields,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return state;
};

export const sendCarePlanReminder = async (petId, data = {}, actor) => {
  const pet = await checkPetAccess(petId, actor);

  const customer = await Customer.findById(pet.customerId).lean();
  const recipientId = customer?.userId || actor?.id;

  if (recipientId && mongoose.connection.readyState === 1) {
    await Notification.create({
      recipientId,
      type: 'CARE_PLAN_REMINDER',
      title: `Nhắc nhở chăm sóc định kỳ cho bé ${pet.name}`,
      body: data.message || `Đã đến kỳ thực hiện lịch chăm sóc (${data.taskKey || 'Kế hoạch định kỳ'}) cho bé ${pet.name}. Vui lòng kiểm tra và đặt lịch sớm.`,
      read: false,
      metadata: {
        petId: pet._id.toString(),
        petName: pet.name,
        taskKey: data.taskKey || null,
      },
    });
  }

  return {
    success: true,
    message: `Đã gửi thông báo nhắc lịch chăm sóc cho bé ${pet.name}`,
  };
};

export default {
  getCarePlan,
  updateTaskState,
  sendCarePlanReminder,
};

