import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import Pet from './models/Pet.js';
import MedicalRecord from './models/MedicalRecord.js';
import HealthDiary from './models/HealthDiary.js';
import Reminder from './models/Reminder.js';
import { optionalAuth } from '../../shared/authMiddleware.js';
import { resolvePet } from './pet.routes.js';

const router = express.Router();

// Setup disk storage for uploads
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Middleware to handle optional multipart form data
const parseMultipart = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    next();
  });
};

// =========================================================================
// 1. MEDICAL RECORDS
// =========================================================================

// GET /medical-records/pet/:petId
router.get(['/pet/:petId', '/medical-records/pet/:petId'], optionalAuth, async (req, res, next) => {
  try {
    const pet = await resolvePet(req.params.petId);
    if (!pet) {
      return res.json([]);
    }

    const records = await MedicalRecord.find({ petId: pet._id }).sort({ visitDate: -1, createdAt: -1 });
    
    // Also merge embedded records from Pet if any (dedup by string comparison)
    const existingIds = new Set(records.map(r => r._id.toString()));
    const embeddedRecords = (pet.medicalRecords || [])
      .filter(er => er._id && !existingIds.has(er._id.toString()))
      .map(er => ({
        id: er._id.toString(),
        _id: er._id,
        petId: pet._id,
        recordName: er.recordName || er.condition || 'Khám tổng quát',
        condition: er.condition || er.recordName || 'Khám tổng quát',
        doctorName: er.doctorName || er.doctor || pet.doctorName || 'Bác sĩ phụ trách',
        doctor: er.doctor || er.doctorName || pet.doctorName || 'Bác sĩ phụ trách',
        visitDate: er.visitDate || er.examinationDate || er.createdAt,
        notes: er.notes || er.treatmentNote || '',
        treatmentNote: er.treatmentNote || er.notes || '',
        symptoms: er.symptoms || '',
        diagnosis: er.diagnosis || '',
        fileUrl: er.fileUrl || (er.attachments && er.attachments[0]?.fileUrl) || '',
        fileName: er.fileName || (er.attachments && er.attachments[0]?.fileName) || '',
        attachments: er.attachments || [],
        createdAt: er.createdAt || new Date(),
      }));

    const allRecords = [...records.map(r => r.toJSON ? r.toJSON() : r), ...embeddedRecords];
    res.json(allRecords);
  } catch (error) {
    next(error);
  }
});

// POST /medical-records
router.post(['/', '/medical-records'], parseMultipart, optionalAuth, async (req, res, next) => {
  try {
    const rawPetId = req.body.petId || req.body.pet_id || req.params.petId;
    const pet = await resolvePet(rawPetId);
    if (!pet) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ thú cưng' });
    }

    const attachments = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          fileName: file.originalname,
          fileUrl: `/uploads/${file.filename}`,
          fileSize: file.size,
          fileType: file.mimetype,
        });
      });
    }

    const condition = req.body.condition || req.body.record_name || req.body.recordName || req.body.name || 'Khám tổng quát';
    const doctorName = (req.body.doctor || req.body.doctorName || req.body.doctor_name || pet.doctorName || 'Bác sĩ phụ trách').trim();
    const visitDate = req.body.visitDate || req.body.visit_date || req.body.examinationDate || new Date();
    const notes = req.body.notes || req.body.treatment_note || req.body.treatmentNote || req.body.medicalNotes || '';
    const fileUrl = attachments[0]?.fileUrl || req.body.fileUrl || req.body.medicalRecordFileUrl || '';
    const fileName = attachments[0]?.fileName || req.body.fileName || (fileUrl ? path.basename(fileUrl) : '');

    const record = new MedicalRecord({
      petId: pet._id,
      recordName: condition,
      condition,
      doctorName,
      doctor: doctorName,
      visitDate: new Date(visitDate),
      notes,
      treatmentNote: notes,
      symptoms: req.body.symptoms || '',
      diagnosis: req.body.diagnosis || condition,
      fileUrl,
      fileName,
      attachments,
      sourceType: 'user_uploaded',
      createdByUserId: req.actor?.id || null,
    });

    await record.save();

    // Push into pet.medicalRecords and update doctorName / medicalRecordFileUrl
    pet.medicalRecords = pet.medicalRecords || [];
    pet.medicalRecords.push({
      _id: record._id,
      recordName: condition,
      condition,
      doctorName,
      doctor: doctorName,
      fileUrl,
      fileName,
      notes,
      treatmentNote: notes,
      visitDate: new Date(visitDate),
      attachments,
      createdAt: new Date(),
    });
    if (doctorName && (!pet.doctorName || pet.doctorName === 'Bác sĩ phụ trách')) {
      pet.doctorName = doctorName;
    }
    if (fileUrl) {
      pet.medicalRecordFileUrl = fileUrl;
    }
    await pet.save();

    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
});

// PUT /medical-records/:id
router.put(['/:id', '/medical-records/:id'], parseMultipart, optionalAuth, async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await MedicalRecord.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Bệnh án không tồn tại' });
    }

    const updates = {};
    if (req.body.condition || req.body.record_name || req.body.recordName) {
      updates.condition = req.body.condition || req.body.record_name || req.body.recordName;
      updates.recordName = updates.condition;
    }
    if (req.body.doctor || req.body.doctorName || req.body.doctor_name) {
      updates.doctorName = (req.body.doctor || req.body.doctorName || req.body.doctor_name).trim();
      updates.doctor = updates.doctorName;
    }
    if (req.body.visitDate || req.body.visit_date) {
      updates.visitDate = new Date(req.body.visitDate || req.body.visit_date);
    }
    if (req.body.notes || req.body.treatment_note || req.body.treatmentNote) {
      updates.notes = req.body.notes || req.body.treatment_note || req.body.treatmentNote;
      updates.treatmentNote = updates.notes;
    }
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      updates.attachments = req.files.map(file => ({
        fileName: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        fileSize: file.size,
        fileType: file.mimetype,
      }));
      updates.fileUrl = updates.attachments[0].fileUrl;
      updates.fileName = updates.attachments[0].fileName;
    }

    const updated = await MedicalRecord.findByIdAndUpdate(id, { $set: updates }, { new: true });

    // Sync embedded record in Pet
    await Pet.updateOne(
      { 'medicalRecords._id': existing._id },
      {
        $set: {
          'medicalRecords.$.recordName': updated.recordName,
          'medicalRecords.$.condition': updated.condition,
          'medicalRecords.$.doctorName': updated.doctorName,
          'medicalRecords.$.doctor': updated.doctor,
          'medicalRecords.$.notes': updated.notes,
          'medicalRecords.$.visitDate': updated.visitDate,
          ...(updated.fileUrl ? { 'medicalRecords.$.fileUrl': updated.fileUrl, 'medicalRecords.$.fileName': updated.fileName } : {}),
        }
      }
    );

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// DELETE /medical-records/:id
router.delete(['/:id', '/medical-records/:id'], optionalAuth, async (req, res, next) => {
  try {
    const id = req.params.id;
    await MedicalRecord.findByIdAndDelete(id);
    await Pet.updateMany(
      { 'medicalRecords._id': id },
      { $pull: { medicalRecords: { _id: id } } }
    );
    res.json({ success: true, message: 'Đã xóa bệnh án thành công' });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 2. HEALTH DIARIES
// =========================================================================

export const healthDiaryRouter = express.Router();

healthDiaryRouter.get('/pet/:petId', optionalAuth, async (req, res, next) => {
  try {
    const pet = await resolvePet(req.params.petId);
    if (!pet) return res.json([]);
    const diaries = await HealthDiary.find({ petId: pet._id }).sort({ entryDate: -1, createdAt: -1 });
    res.json(diaries);
  } catch (error) {
    next(error);
  }
});

healthDiaryRouter.post('/', parseMultipart, optionalAuth, async (req, res, next) => {
  try {
    const rawPetId = req.body.petId || req.body.pet_id;
    const pet = await resolvePet(rawPetId);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });

    const attachments = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          fileName: file.originalname,
          fileUrl: `/uploads/${file.filename}`,
          fileSize: file.size,
          fileType: file.mimetype,
        });
      });
    }

    const diary = new HealthDiary({
      petId: pet._id,
      entryDate: req.body.entryDate || req.body.entry_date || new Date(),
      entryTime: req.body.entryTime || req.body.entry_time || null,
      iconCode: req.body.icon || req.body.icon_code || 'paw',
      colorCode: req.body.type || req.body.color_code || 'blue',
      title: req.body.title || 'Ghi chú',
      content: req.body.content || req.body.title || '',
      attachments,
      createdByUserId: req.actor?.id || null,
    });
    await diary.save();
    res.status(201).json(diary);
  } catch (error) {
    next(error);
  }
});

healthDiaryRouter.put('/:id', parseMultipart, optionalAuth, async (req, res, next) => {
  try {
    const diary = await HealthDiary.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!diary) return res.status(404).json({ message: 'Diary not found' });
    res.json(diary);
  } catch (error) {
    next(error);
  }
});

healthDiaryRouter.delete('/:id', optionalAuth, async (req, res, next) => {
  try {
    await HealthDiary.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa nhật ký thành công' });
  } catch (error) {
    next(error);
  }
});

// =========================================================================
// 3. REMINDERS
// =========================================================================

export const reminderRouter = express.Router();

reminderRouter.get('/pet/:petId', optionalAuth, async (req, res, next) => {
  try {
    const pet = await resolvePet(req.params.petId);
    if (!pet) return res.json([]);
    const reminders = await Reminder.find({ petId: pet._id }).sort({ remindDate: 1 });
    res.json(reminders);
  } catch (error) {
    next(error);
  }
});

reminderRouter.post('/', optionalAuth, async (req, res, next) => {
  try {
    const rawPetId = req.body.petId || req.body.pet_id;
    const pet = await resolvePet(rawPetId);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });

    const reminder = new Reminder({
      petId: pet._id,
      reminderType: req.body.reminderType || req.body.reminder_type || 'other',
      title: req.body.title || 'Nhắc lịch',
      remindDate: req.body.remindDate || req.body.remind_date || new Date(),
      remindBeforeDays: Number(req.body.remindBeforeDays || req.body.remind_before_days || 0),
      repeatType: req.body.repeatType || req.body.repeat_type || 'none',
      notes: req.body.notes || req.body.note || '',
      status: 'pending',
      createdByUserId: req.actor?.id || null,
    });
    await reminder.save();
    res.status(201).json(reminder);
  } catch (error) {
    next(error);
  }
});

reminderRouter.patch('/:id/complete', optionalAuth, async (req, res, next) => {
  try {
    const reminder = await Reminder.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'completed' } },
      { new: true }
    );
    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });
    res.json(reminder);
  } catch (error) {
    next(error);
  }
});

reminderRouter.delete('/:id', optionalAuth, async (req, res, next) => {
  try {
    await Reminder.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa nhắc lịch thành công' });
  } catch (error) {
    next(error);
  }
});

export default router;
