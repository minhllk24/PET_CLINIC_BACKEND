import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const parseEntryTime = (value) => {
  if (!value) return null;
  const match = String(value).match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2]), 0));
};

const buildDiaryAttachments = (diaryId, data) => {
  let attachments = [];

  if (data.attachments && Array.isArray(data.attachments)) {
    attachments = data.attachments.map(att => ({
      diary_entry_id: diaryId,
      file_url: att.file_url,
      file_type: att.file_type || 'image',
      file_name: att.file_name || 'Attachment',
      file_size_kb: att.file_size_kb || null
    }));
  }

  if (data.files && Array.isArray(data.files)) {
    const uploadedFiles = data.files.map(file => ({
      diary_entry_id: diaryId,
      file_url: `/uploads/${file.filename}`,
      file_type: file.mimetype.startsWith('image/') ? 'image' : 'document',
      file_name: file.originalname,
      file_size_kb: file.size ? Math.ceil(file.size / 1024) : null
    }));
    attachments = [...attachments, ...uploadedFiles];
  }

  return attachments;
};

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

    const diaries = await prisma.healthDiaryEntry.findMany({
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

    const newDiary = await prisma.healthDiaryEntry.create({
      data: {
        pet_id: petId,
        user_id: toBigIntId(user.user_id),
        entry_date: data.entry_date ? new Date(data.entry_date) : new Date(),
        entry_time: parseEntryTime(data.entry_time),
        icon_code: data.icon_code || null,
        color_code: data.color_code || null,
        title: data.title || 'Note',
        content: data.content || null
      }
    });

    const attData = buildDiaryAttachments(newDiary.diary_entry_id, data);
    if (attData.length > 0) {
      await prisma.healthDiaryAttachment.createMany({ data: attData });
    }

    const diaryWithAttachments = await prisma.healthDiaryEntry.findUnique({
      where: { diary_entry_id: newDiary.diary_entry_id },
      include: { attachments: true }
    });

    return { EM: 'Create diary successful', EC: 0, DT: diaryWithAttachments };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateDiary = async (id, data, user) => {
  try {
    const diaryId = toBigIntId(id);
    if (!diaryId) return { EM: 'Invalid diary ID', EC: 1, DT: '' };

    const diary = await prisma.healthDiaryEntry.findUnique({
      where: { diary_entry_id: diaryId },
      include: { pet: true }
    });
    if (!diary) return { EM: 'Diary not found', EC: -1, DT: '' };
    if (user.role_code === 'CUSTOMER' && user.user_id !== diary.pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const updatedDiary = await prisma.healthDiaryEntry.update({
      where: { diary_entry_id: diaryId },
      data: {
        entry_date: data.entry_date ? new Date(data.entry_date) : diary.entry_date,
        entry_time: data.entry_time !== undefined ? parseEntryTime(data.entry_time) : diary.entry_time,
        icon_code: data.icon_code !== undefined ? data.icon_code : diary.icon_code,
        color_code: data.color_code !== undefined ? data.color_code : diary.color_code,
        title: data.title !== undefined ? data.title : diary.title,
        content: data.content !== undefined ? data.content : diary.content
      }
    });

    const attData = buildDiaryAttachments(diaryId, data);
    if (attData.length > 0) {
      await prisma.healthDiaryAttachment.createMany({ data: attData });
    }

    const diaryWithAttachments = await prisma.healthDiaryEntry.findUnique({
      where: { diary_entry_id: updatedDiary.diary_entry_id },
      include: { attachments: true }
    });

    return { EM: 'Update diary successful', EC: 0, DT: diaryWithAttachments };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteDiary = async (id, user) => {
  try {
    const diaryId = toBigIntId(id);
    if (!diaryId) return { EM: 'Invalid diary ID', EC: 1, DT: '' };

    const diary = await prisma.healthDiaryEntry.findUnique({
      where: { diary_entry_id: diaryId },
      include: { pet: true }
    });
    if (!diary) return { EM: 'Diary not found', EC: -1, DT: '' };
    if (user.role_code === 'CUSTOMER' && user.user_id !== diary.pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    await prisma.healthDiaryEntry.delete({ where: { diary_entry_id: diaryId } });
    return { EM: 'Delete diary successful', EC: 0, DT: '' };
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
        user_id: toBigIntId(user.user_id),
        reminder_type: data.reminder_type || 'other',
        title: data.title,
        remind_date: new Date(data.remind_date),
        remind_before_days: data.remind_before_days ? parseInt(data.remind_before_days) : 0,
        status: 'pending',
        note: data.notes || data.note || null
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
  updateDiary,
  deleteDiary,
  getRemindersByPet,
  createReminder,
  completeReminder,
  deleteReminder
};
