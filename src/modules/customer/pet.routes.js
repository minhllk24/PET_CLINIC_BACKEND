import express from 'express';
import mongoose from 'mongoose';
import Pet from './models/Pet';
import Customer from './models/Customer';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';
import medicalRecordRoutes from './medicalRecord.routes';

const router = express.Router();

export const resolveCustomerIds = async (rawId, actor) => {
  const ids = [];
  const idToProbe = rawId || (actor ? actor.id : null);
  if (idToProbe) {
    ids.push(idToProbe.toString());
    if (mongoose.Types.ObjectId.isValid(idToProbe)) {
      const customer = await Customer.findOne({
        $or: [{ _id: idToProbe }, { userId: idToProbe }]
      }).lean();
      if (customer) {
        ids.push(customer._id.toString());
        if (customer.userId) ids.push(customer.userId.toString());
      }
    }
  }
  return [...new Set(ids)];
};

export const normalizePetStatus = (rawStatus, rawArchived, rawHidden) => {
  if (rawStatus !== undefined && rawStatus !== null) {
    const s = String(rawStatus).trim().toUpperCase();
    if (s === 'HIDDEN' || s === 'ẨN' || s === 'AN' || s === 'INACTIVE' || s === 'ARCHIVED' || s === 'HIDE') {
      return { status: 'HIDDEN', isArchived: true };
    }
    if (s === 'ACTIVE' || s === 'HOẠT ĐỘNG' || s === 'HOAT DONG' || s === 'SHOW') {
      return { status: 'ACTIVE', isArchived: false };
    }
  }
  if (rawHidden !== undefined && rawHidden !== null) {
    const isHidden = Boolean(rawHidden);
    return { status: isHidden ? 'HIDDEN' : 'ACTIVE', isArchived: isHidden };
  }
  if (rawArchived !== undefined && rawArchived !== null) {
    const isArchived = Boolean(rawArchived);
    return { status: isArchived ? 'HIDDEN' : 'ACTIVE', isArchived };
  }
  return { status: 'ACTIVE', isArchived: false };
};

export const parseMedicalRecords = (body) => {
  const doctorName = (body.doctorName || body.attendingDoctor || body.doctor || body.bacSi || '').trim();
  const medicalRecordFileUrl = body.medicalRecordFileUrl || body.fileUrl || body.medicalFile || body.recordFileUrl || null;
  
  let records = [];
  if (Array.isArray(body.medicalRecords)) {
    records = body.medicalRecords.map((r) => ({
      doctorName: (r.doctorName || r.attendingDoctor || r.doctor || doctorName || '').trim(),
      fileUrl: r.fileUrl || r.medicalRecordFileUrl || r.file || '',
      fileName: r.fileName || r.name || '',
      notes: r.notes || r.note || '',
      examinationDate: r.examinationDate ? new Date(r.examinationDate) : null,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    }));
  } else if (Array.isArray(body.records)) {
    records = body.records.map((r) => ({
      doctorName: (r.doctorName || r.attendingDoctor || r.doctor || doctorName || '').trim(),
      fileUrl: r.fileUrl || r.medicalRecordFileUrl || r.file || '',
      fileName: r.fileName || r.name || '',
      notes: r.notes || r.note || '',
      examinationDate: r.examinationDate ? new Date(r.examinationDate) : null,
      createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
    }));
  } else if (medicalRecordFileUrl || doctorName) {
    records.push({
      doctorName,
      fileUrl: medicalRecordFileUrl || '',
      fileName: body.fileName || (medicalRecordFileUrl ? String(medicalRecordFileUrl).split('/').pop() : ''),
      notes: body.medicalNotes || body.medical_note || '',
      examinationDate: body.examinationDate ? new Date(body.examinationDate) : new Date(),
      createdAt: new Date(),
    });
  }

  return { doctorName, medicalRecordFileUrl, medicalRecords: records };
};

export const listPetsHandler = async (req, res, next) => {
  try {
    const rawId = req.params.customerId || req.params.id || (req.actor ? req.actor.id : null);
    const targetCustomerIds = await resolveCustomerIds(rawId, req.actor);
    const filter = targetCustomerIds.length > 0 ? { customerId: { $in: targetCustomerIds } } : {};

    // Archiving & Status filter
    const statusQuery = req.query.status ? String(req.query.status).trim().toUpperCase() : null;
    if (statusQuery === 'ALL' || req.query.includeArchived === 'true' || targetCustomerIds.length > 0) {
      if (statusQuery === 'HIDDEN' || statusQuery === 'ẨN' || req.query.isArchived === 'true' || req.query.archived === 'true') {
        filter.$or = [{ status: 'HIDDEN' }, { isArchived: true }];
      } else if (statusQuery === 'ACTIVE' || statusQuery === 'HOẠT ĐỘNG') {
        filter.status = 'ACTIVE';
        filter.isArchived = { $ne: true };
      }
    } else if (statusQuery === 'HIDDEN' || statusQuery === 'ẨN' || req.query.isArchived === 'true' || req.query.archived === 'true') {
      filter.$or = [{ status: 'HIDDEN' }, { isArchived: true }];
    } else if (statusQuery === 'ACTIVE' || statusQuery === 'HOẠT ĐỘNG') {
      filter.status = 'ACTIVE';
      filter.isArchived = { $ne: true };
    } else {
      filter.isArchived = { $ne: true };
      filter.status = { $ne: 'HIDDEN' };
    }

    const pets = await Pet.find(filter).sort({ createdAt: -1 });
    res.json(pets);
  } catch (error) {
    next(error);
  }
};

export const createPetHandler = async (req, res, next) => {
  try {
    const rawId = req.params.customerId || req.params.id || (req.actor ? req.actor.id : null);
    let customerId = null;
    if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
      const customer = await Customer.findOne({
        $or: [{ _id: rawId }, { userId: rawId }]
      }).lean();
      if (customer) customerId = customer._id;
      else customerId = new mongoose.Types.ObjectId(rawId);
    }
    if (!customerId && req.actor && req.actor.id && mongoose.Types.ObjectId.isValid(req.actor.id)) {
      let customer = await Customer.findOne({ userId: req.actor.id }).lean();
      if (!customer) {
        customer = await Customer.create({
          userId: req.actor.id,
          accountStatus: 'ACTIVE',
          activationStatus: 'ACTIVATED'
        });
      }
      customerId = customer._id;
    }
    if (!customerId) {
      customerId = new mongoose.Types.ObjectId();
    }

    let species = String(req.body.species || req.body.species_name || 'DOG').toUpperCase();
    if (species.includes('CHÓ') || species.includes('CHO')) species = 'DOG';
    else if (species.includes('MÈO') || species.includes('MEO')) species = 'CAT';
    else if (!['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'].includes(species)) species = 'OTHER';

    const { status, isArchived } = normalizePetStatus(
      req.body.status,
      req.body.isArchived !== undefined ? req.body.isArchived : req.body.archived
    );
    const { doctorName, medicalRecordFileUrl, medicalRecords } = parseMedicalRecords(req.body);

    const petData = {
      name: req.body.name || req.body.pet_name,
      species,
      breed: req.body.breed || req.body.breed_name || '',
      gender: (req.body.gender || 'UNKNOWN').toUpperCase(),
      ageYears: Number(req.body.ageYears || req.body.age || 0),
      weightKg: Number(req.body.weightKg || req.body.weight_kg || 0),
      healthStatus: req.body.healthStatus || req.body.health_status || 'NORMAL',
      medicalNotes: req.body.medicalNotes || req.body.medical_note || '',
      photoUrl: req.body.photoUrl || req.body.avatar || req.body.profile_image_url || null,
      doctorName,
      medicalRecordFileUrl,
      medicalRecords,
      status,
      isArchived,
      customerId,
    };
    const pet = new Pet(petData);
    await pet.save();
    res.status(201).json(pet);
  } catch (error) {
    next(error);
  }
};

export const resolvePet = async (paramId) => {
  if (!paramId) return null;
  const clean = String(paramId).trim();
  if (mongoose.Types.ObjectId.isValid(clean)) {
    const pet = await Pet.findById(clean);
    if (pet) return pet;
  }

  // Check if it's a slug with shortId: e.g. "luna-18d", "corgi-vang-792"
  const slugParts = clean.split('-');
  const shortId = slugParts.length > 1 ? slugParts[slugParts.length - 1] : null;
  const nameFromSlug = slugParts.length > 1 ? slugParts.slice(0, -1).join(' ') : clean;

  const conditions = [
    { name: new RegExp(`^${clean}$`, 'i') },
    { name: new RegExp(`^${clean.replace(/-/g, ' ')}$`, 'i') },
    { breed: new RegExp(`^${clean}$`, 'i') },
  ];

  if (nameFromSlug) {
    conditions.push({ name: new RegExp(`^${nameFromSlug}$`, 'i') });
  }

  let pet = await Pet.findOne({ $or: conditions });
  if (pet) return pet;

  // If shortId exists (e.g. 18d, 792), search pets and match ObjectId suffix
  if (shortId && /^[0-9a-fA-F]{3,8}$/.test(shortId)) {
    const allPets = await Pet.find({});
    const matched = allPets.find((p) => p._id.toString().toLowerCase().endsWith(shortId.toLowerCase()));
    if (matched) return matched;
  }

  return null;
};

export const getPetHandler = async (req, res, next) => {
  try {
    const pet = await resolvePet(req.params.id);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    res.json(pet);
  } catch (error) {
    next(error);
  }
};

export const updatePetHandler = async (req, res, next) => {
  try {
    const existingPet = await resolvePet(req.params.id);
    if (!existingPet) return res.status(404).json({ message: 'Pet not found' });

    let species = req.body.species || req.body.species_name;
    if (species) {
      species = String(species).toUpperCase();
      if (species.includes('CHÓ') || species.includes('CHO')) species = 'DOG';
      else if (species.includes('MÈO') || species.includes('MEO')) species = 'CAT';
      else if (!['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'].includes(species)) species = 'OTHER';
    }

    const updates = {
      ...(req.body.name || req.body.pet_name ? { name: req.body.name || req.body.pet_name } : {}),
      ...(species ? { species } : {}),
      ...(req.body.breed !== undefined || req.body.breed_name !== undefined ? { breed: req.body.breed || req.body.breed_name } : {}),
      ...(req.body.gender ? { gender: req.body.gender.toUpperCase() } : {}),
      ...(req.body.ageYears !== undefined || req.body.age !== undefined ? { ageYears: Number(req.body.ageYears || req.body.age || 0) } : {}),
      ...(req.body.weightKg !== undefined || req.body.weight_kg !== undefined ? { weightKg: Number(req.body.weightKg || req.body.weight_kg || 0) } : {}),
      ...(req.body.healthStatus || req.body.health_status ? { healthStatus: req.body.healthStatus || req.body.health_status } : {}),
      ...(req.body.medicalNotes !== undefined || req.body.medical_note !== undefined ? { medicalNotes: req.body.medicalNotes || req.body.medical_note } : {}),
      ...(req.body.photoUrl || req.body.avatar || req.body.profile_image_url ? { photoUrl: req.body.photoUrl || req.body.avatar || req.body.profile_image_url } : {}),
    };

    if (req.body.status !== undefined || req.body.isArchived !== undefined || req.body.archived !== undefined || req.body.isHidden !== undefined || req.body.is_hidden !== undefined) {
      const statusInfo = normalizePetStatus(
        req.body.status,
        req.body.isArchived !== undefined ? req.body.isArchived : req.body.archived,
        req.body.isHidden !== undefined ? req.body.isHidden : req.body.is_hidden
      );
      updates.status = statusInfo.status;
      updates.isArchived = statusInfo.isArchived;
    }

    const incomingDoctorName = req.body.doctorName || req.body.attendingDoctor || req.body.doctor || req.body.bacSi;
    if (incomingDoctorName !== undefined) {
      updates.doctorName = String(incomingDoctorName).trim();
    }

    const incomingFileUrl = req.body.medicalRecordFileUrl || req.body.fileUrl || req.body.medicalFile || req.body.recordFileUrl;
    if (incomingFileUrl !== undefined) {
      updates.medicalRecordFileUrl = incomingFileUrl || null;
    }

    if (Array.isArray(req.body.medicalRecords)) {
      updates.medicalRecords = req.body.medicalRecords.map((r) => ({
        doctorName: (r.doctorName || r.attendingDoctor || r.doctor || updates.doctorName || existingPet.doctorName || '').trim(),
        fileUrl: r.fileUrl || r.medicalRecordFileUrl || '',
        fileName: r.fileName || r.name || '',
        notes: r.notes || r.note || '',
        examinationDate: r.examinationDate ? new Date(r.examinationDate) : null,
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      }));
    } else if (Array.isArray(req.body.records)) {
      updates.medicalRecords = req.body.records.map((r) => ({
        doctorName: (r.doctorName || r.attendingDoctor || r.doctor || updates.doctorName || existingPet.doctorName || '').trim(),
        fileUrl: r.fileUrl || r.medicalRecordFileUrl || '',
        fileName: r.fileName || r.name || '',
        notes: r.notes || r.note || '',
        examinationDate: r.examinationDate ? new Date(r.examinationDate) : null,
        createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
      }));
    } else if (incomingFileUrl || incomingDoctorName) {
      const rec = {
        doctorName: updates.doctorName || existingPet.doctorName || '',
        fileUrl: updates.medicalRecordFileUrl || existingPet.medicalRecordFileUrl || '',
        fileName: req.body.fileName || (updates.medicalRecordFileUrl ? String(updates.medicalRecordFileUrl).split('/').pop() : ''),
        notes: req.body.medicalNotes || existingPet.medicalNotes || '',
        examinationDate: req.body.examinationDate ? new Date(req.body.examinationDate) : new Date(),
        createdAt: new Date(),
      };
      updates.medicalRecords = [...(existingPet.medicalRecords || []), rec];
    }

    const pet = await Pet.findByIdAndUpdate(existingPet._id, { $set: updates }, { new: true });
    res.json(pet);
  } catch (error) {
    next(error);
  }
};

export const updatePetStatusHandler = async (req, res, next) => {
  try {
    const existingPet = await resolvePet(req.params.id);
    if (!existingPet) return res.status(404).json({ message: 'Pet not found' });
    const { status, isArchived } = normalizePetStatus(
      req.body.status,
      req.body.isArchived !== undefined ? req.body.isArchived : req.body.archived,
      req.body.isHidden !== undefined ? req.body.isHidden : req.body.is_hidden
    );
    const pet = await Pet.findByIdAndUpdate(
      existingPet._id,
      { $set: { status, isArchived } },
      { new: true }
    );
    res.json(pet);
  } catch (error) {
    next(error);
  }
};

export const deletePetHandler = async (req, res, next) => {
  try {
    const existingPet = await resolvePet(req.params.id);
    if (!existingPet) return res.status(404).json({ message: 'Pet not found' });
    const permanent = req.query.permanent === 'true';
    let pet;
    if (permanent) {
      pet = await Pet.findByIdAndDelete(existingPet._id);
    } else {
      pet = await Pet.findByIdAndUpdate(
        existingPet._id,
        { $set: { isArchived: true, status: 'HIDDEN' } },
        { new: true }
      );
    }
    res.json({ success: true, message: permanent ? 'Pet deleted successfully' : 'Pet archived successfully', pet: pet || existingPet });
  } catch (error) {
    next(error);
  }
};

// Route definitions for /api/v1/pets
router.get('/', optionalAuth, listPetsHandler);
router.post('/', optionalAuth, createPetHandler);
router.get('/:id', optionalAuth, getPetHandler);
router.put('/:id', optionalAuth, updatePetHandler);
router.patch('/:id', optionalAuth, updatePetHandler);
router.patch('/:id/status', optionalAuth, updatePetStatusHandler);
router.put('/:id/status', optionalAuth, updatePetStatusHandler);
router.delete('/:id', optionalAuth, deletePetHandler);
router.use('/:petId/medical-records', medicalRecordRoutes);

export default router;

