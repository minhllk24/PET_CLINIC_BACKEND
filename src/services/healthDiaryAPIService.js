import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

// --- HEALTH DIARY ---
const getDiariesByPet = async (petIdStr, query, user) => {
  try {
    const petId = toBigIntId(petIdStr);
    if (!petId) return { EM: 'Invalid pet ID', EC: 1, DT: '' };

    // Permissions check
    const pet = await prisma.pet.findUnique({ where: { pet_id: petId } });
    if (!pet) return { EM: 'Pet not found', EC: -1, DT: '' };
    if (user.role_code === 'CUSTOMER' && user.user_id !== pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const { month, year } = query;
    const whereCondition = { pet_id: petId };

    if (month && year) {
      const startDate = new Date(`${year}-${month}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      whereCondition.entry_date = {
        gte: startDate,
        lt: endDate
      };
    }

    const diaries = await prisma.healthDiary.findMany({
      where: whereCondition,
      include: { attachments: true },
      orderBy: [{ entry_date: 'desc' }, { entry_time: 'desc' }]
    });

    return { EM: 'Get diaries successful', EC: 0, DT: diaries };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createDiary = async (data, user) => {
  try {
    const petId = toBigIntId(data.pet_id);
    if (!petId) return { EM: 'Invalid pet ID', EC: 1, DT: '' };

    const pet = await prisma.pet.findUnique({ where: { pet_id: petId } });
    if (!pet) return { EM: 'Pet not found', EC: -1, DT: '' };
    if (user.role_code === 'CUSTOMER' && user.user_id !== pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const newDiary = await prisma.healthDiary.create({
      data: {
        pet_id: petId,
        entry_date: data.entry_date ? new Date(data.entry_date) : new Date(),
        entry_time: data.entry_time || null,
        icon_code: data.icon_code || null,
        color_code: data.color_code || null,
        title: data.title || 'Note',
        content: data.content || null
      }
    });

    if (data.attachments && Array.isArray(data.attachments)) {
      const attData = data.attachments.map(att => ({
        diary_id: newDiary.diary_id,
        file_url: att.file_url,
        file_type: att.file_type || 'image',
        file_name: att.file_name || 'Attachment'
      }));
      await prisma.healthDiaryAttachment.createMany({ data: attData });
    }

    return { EM: 'Create diary successful', EC: 0, DT: newDiary };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- REMINDER ---
const getRemindersByPet = async (petIdStr, user) => {
  try {
    const petId = toBigIntId(petIdStr);
    if (!petId) return { EM: 'Invalid pet ID', EC: 1, DT: '' };

    const pet = await prisma.pet.findUnique({ where: { pet_id: petId } });
    if (!pet) return { EM: 'Pet not found', EC: -1, DT: '' };
    if (user.role_code === 'CUSTOMER' && user.user_id !== pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const reminders = await prisma.petReminder.findMany({
      where: { pet_id: petId },
      orderBy: { remind_date: 'asc' }
    });

    return { EM: 'Get reminders successful', EC: 0, DT: reminders };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createReminder = async (data, user) => {
  try {
    const petId = toBigIntId(data.pet_id);
    if (!petId) return { EM: 'Invalid pet ID', EC: 1, DT: '' };

    const pet = await prisma.pet.findUnique({ where: { pet_id: petId } });
    if (!pet) return { EM: 'Pet not found', EC: -1, DT: '' };
    if (user.role_code === 'CUSTOMER' && user.user_id !== pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const newReminder = await prisma.petReminder.create({
      data: {
        pet_id: petId,
        reminder_type: data.reminder_type || 'other',
        title: data.title,
        remind_date: new Date(data.remind_date),
        remind_before_days: data.remind_before_days ? parseInt(data.remind_before_days) : 0,
        repeat_type: data.repeat_type || 'none',
        status: 'pending',
        notes: data.notes || null
      }
    });

    return { EM: 'Create reminder successful', EC: 0, DT: newReminder };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const completeReminder = async (id, user) => {
  try {
    const reminderId = toBigIntId(id);
    if (!reminderId) return { EM: 'Invalid ID', EC: 1, DT: '' };

    const reminder = await prisma.petReminder.findUnique({
      where: { reminder_id: reminderId },
      include: { pet: true }
    });

    if (!reminder) return { EM: 'Reminder not found', EC: -1, DT: '' };
    if (user.role_code === 'CUSTOMER' && user.user_id !== reminder.pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const updated = await prisma.petReminder.update({
      where: { reminder_id: reminderId },
      data: { status: 'completed' }
    });

    return { EM: 'Complete reminder successful', EC: 0, DT: updated };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteReminder = async (id, user) => {
  try {
    const reminderId = toBigIntId(id);
    if (!reminderId) return { EM: 'Invalid ID', EC: 1, DT: '' };

    const reminder = await prisma.petReminder.findUnique({
      where: { reminder_id: reminderId },
      include: { pet: true }
    });

    if (!reminder) return { EM: 'Reminder not found', EC: -1, DT: '' };
    if (user.role_code === 'CUSTOMER' && user.user_id !== reminder.pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    await prisma.petReminder.delete({ where: { reminder_id: reminderId } });

    return { EM: 'Delete reminder successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getDiariesByPet,
  createDiary,
  getRemindersByPet,
  createReminder,
  completeReminder,
  deleteReminder
};
