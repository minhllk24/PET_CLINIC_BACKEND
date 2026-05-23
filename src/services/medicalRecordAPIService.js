import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getRecordsByPet = async (petIdStr, user) => {
  try {
    const petId = toBigIntId(petIdStr);
    if (!petId) return { EM: 'Invalid pet ID', EC: 1, DT: '' };

    const pet = await prisma.pet.findUnique({ where: { pet_id: petId } });
    if (!pet) return { EM: 'Pet not found', EC: -1, DT: '' };

    if (user.role_code === 'CUSTOMER' && user.user_id !== pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const records = await prisma.medicalRecord.findMany({
      where: { pet_id: petId },
      include: {
        doctor: { select: { full_name: true } },
        attachments: true
      },
      orderBy: { visit_date: 'desc' }
    });

    return { EM: 'Get medical records successful', EC: 0, DT: records };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getRecordById = async (id, user) => {
  try {
    const recordId = toBigIntId(id);
    if (!recordId) return { EM: 'Invalid record ID', EC: 1, DT: '' };

    const record = await prisma.medicalRecord.findUnique({
      where: { record_id: recordId },
      include: {
        doctor: { select: { full_name: true } },
        pet: { select: { owner_user_id: true } },
        attachments: true
      }
    });

    if (!record) return { EM: 'Record not found', EC: -1, DT: '' };

    if (user.role_code === 'CUSTOMER' && user.user_id !== record.pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    return { EM: 'Get record successful', EC: 0, DT: record };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createRecord = async (data, user) => {
  try {
    if (!data.pet_id) return { EM: 'Missing pet_id', EC: 1, DT: '' };
    
    const petId = toBigIntId(data.pet_id);
    const pet = await prisma.pet.findUnique({ where: { pet_id: petId } });
    if (!pet) return { EM: 'Pet not found', EC: -1, DT: '' };

    let sourceType = 'doctor_created';
    let doctorId = null;

    if (user.role_code === 'CUSTOMER') {
      if (user.user_id !== pet.owner_user_id.toString()) {
        return { EM: 'Permission denied', EC: -1, DT: '' };
      }
      sourceType = 'user_uploaded';
    } else {
      doctorId = toBigIntId(user.user_id);
    }

    const newRecord = await prisma.medicalRecord.create({
      data: {
        pet_id: petId,
        doctor_id: doctorId || (data.doctor_id ? toBigIntId(data.doctor_id) : null),
        appointment_id: data.appointment_id ? toBigIntId(data.appointment_id) : null,
        record_name: data.record_name || 'Hồ sơ bệnh án mới',
        visit_date: data.visit_date ? new Date(data.visit_date) : new Date(),
        symptoms: data.symptoms || null,
        diagnosis: data.diagnosis || null,
        treatment_note: data.treatment_note || null,
        created_by_user_id: toBigIntId(user.user_id),
        source_type: sourceType
      }
    });

    // Add attachments if provided
    if (data.attachments && Array.isArray(data.attachments)) {
      const attData = data.attachments.map(att => ({
        record_id: newRecord.record_id,
        file_url: att.file_url,
        file_type: att.file_type || 'image',
        file_name: att.file_name || 'Attachment'
      }));
      await prisma.medicalRecordAttachment.createMany({ data: attData });
    }

    return { EM: 'Create record successful', EC: 0, DT: newRecord };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateRecord = async (id, data, user) => {
  try {
    const recordId = toBigIntId(id);
    if (!recordId) return { EM: 'Invalid record ID', EC: 1, DT: '' };

    const record = await prisma.medicalRecord.findUnique({
      where: { record_id: recordId },
      include: { pet: true }
    });
    if (!record) return { EM: 'Record not found', EC: -1, DT: '' };

    if (user.role_code === 'CUSTOMER') {
      if (record.source_type !== 'user_uploaded' || user.user_id !== record.pet.owner_user_id.toString()) {
        return { EM: 'Permission denied', EC: -1, DT: '' };
      }
    } else if (record.source_type === 'doctor_created' && record.doctor_id && record.doctor_id.toString() !== user.user_id && user.role_code !== 'ADMIN') {
        return { EM: 'Permission denied, only the creator doctor can edit', EC: -1, DT: '' };
    }

    const updatedRecord = await prisma.medicalRecord.update({
      where: { record_id: recordId },
      data: {
        record_name: data.record_name !== undefined ? data.record_name : record.record_name,
        symptoms: data.symptoms !== undefined ? data.symptoms : record.symptoms,
        diagnosis: data.diagnosis !== undefined ? data.diagnosis : record.diagnosis,
        treatment_note: data.treatment_note !== undefined ? data.treatment_note : record.treatment_note,
        visit_date: data.visit_date ? new Date(data.visit_date) : record.visit_date,
        doctor_id: data.doctor_id !== undefined ? (data.doctor_id ? toBigIntId(data.doctor_id) : null) : record.doctor_id
      }
    });

    return { EM: 'Update record successful', EC: 0, DT: updatedRecord };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deleteRecord = async (id, user) => {
  try {
    const recordId = toBigIntId(id);
    if (!recordId) return { EM: 'Invalid record ID', EC: 1, DT: '' };

    const record = await prisma.medicalRecord.findUnique({
      where: { record_id: recordId },
      include: { pet: true }
    });
    if (!record) return { EM: 'Record not found', EC: -1, DT: '' };

    if (user.role_code === 'CUSTOMER') {
      if (record.source_type !== 'user_uploaded' || user.user_id !== record.pet.owner_user_id.toString()) {
        return { EM: 'Permission denied', EC: -1, DT: '' };
      }
    }

    await prisma.medicalRecord.delete({ where: { record_id: recordId } });
    return { EM: 'Delete record successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getRecordsByPet,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord
};
