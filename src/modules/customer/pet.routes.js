import express from 'express';
import mongoose from 'mongoose';
import Pet from './models/Pet';
import Customer from './models/Customer';
import Appointment from '../booking/models/Appointment';
import ServiceRecord from '../execution/models/ServiceRecord';
import StaffProfile from '../staff/models/StaffProfile';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import { optionalAuth } from '../../shared/authMiddleware';
import medicalRecordRoutes from './medicalRecord.routes';

const router = express.Router();

const CLINICAL_SUBROLES = new Set(['VETERINARIAN', 'NURSE', 'CARE_STAFF_GROOMER']);

const resolveStaffCandidateIds = async (actor) => {
  const actorId = (actor?.id || actor?._id)?.toString();
  if (!actorId) return [];
  const ids = [];
  if (mongoose.Types.ObjectId.isValid(actorId)) {
    ids.push(new mongoose.Types.ObjectId(actorId));
  }
  if (mongoose.connection.readyState === 1 || StaffProfile.findOne?._isMockFunction) {
    try {
      const profile = await StaffProfile.findOne({ userId: actorId }).select('_id').lean();
      if (profile?._id) ids.push(new mongoose.Types.ObjectId(profile._id));
    } catch {}
  }
  return ids;
};

const resolveActorCustomerObjectIds = async (actor) => {
  const actorId = (actor?.id || actor?._id)?.toString();
  const ids = [];
  if (actorId) ids.push(actorId);
  if (actorId && mongoose.Types.ObjectId.isValid(actorId) && (mongoose.connection.readyState === 1 || Customer.findOne?._isMockFunction)) {
    try {
      let custQ = Customer.findOne({ $or: [{ userId: actorId }, { _id: actorId }] });
      if (typeof custQ?.select === 'function') custQ = custQ.select('_id userId');
      if (typeof custQ?.lean === 'function') custQ = custQ.lean();
      const cust = await custQ;
      if (cust?._id) ids.push(cust._id.toString());
      if (cust?.userId) ids.push(cust.userId.toString());
    } catch {}
  }
  return [...new Set(ids)];
};

export const sanitizePetForActor = (pet, actor) => {
  if (!pet) return pet;
  const obj = typeof pet.toJSON === 'function' ? pet.toJSON() : { ...pet };
  if (actor && actor.systemRole === 'STAFF' && CLINICAL_SUBROLES.has(actor.staffSubRole)) {
    // Field-limited clinical view: omit direct customer contact/ownership identifiers if unnecessary
    return {
      id: obj.id || obj._id?.toString(),
      _id: obj._id,
      name: obj.name,
      species: obj.species,
      breed: obj.breed,
      gender: obj.gender,
      ageYears: obj.ageYears,
      weightKg: obj.weightKg,
      healthStatus: obj.healthStatus,
      medicalNotes: obj.medicalNotes,
      photoUrl: obj.photoUrl,
      doctorName: obj.doctorName,
      medicalRecordFileUrl: obj.medicalRecordFileUrl,
      medicalRecords: obj.medicalRecords || [],
      status: obj.status,
      isArchived: obj.isArchived,
    };
  }
  return obj;
};

export const assertPetAccess = async (pet, actor, mode = 'READ') => {
  if (!actor) {
    throw new AppError(401, 'Unauthenticated', ErrorCodes.UNAUTHENTICATED, 'Authentication required to access pet');
  }
  if (actor.systemRole === 'ADMIN') return;

  if (actor.systemRole === 'CUSTOMER') {
    const allowedIds = await resolveActorCustomerObjectIds(actor);
    const petCustId = (pet.customerId?._id || pet.customerId)?.toString();
    if (!petCustId || !allowedIds.includes(petCustId)) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to access this pet');
    }
    return;
  }

  if (actor.systemRole === 'MANAGER' || (actor.systemRole === 'STAFF' && actor.staffSubRole === 'RECEPTIONIST')) {
    const branchIds = (actor.authorizedBranchIds || actor.assignedBranchIds || [])
      .map((b) => (b?._id || b).toString())
      .filter((b) => mongoose.Types.ObjectId.isValid(b))
      .map((b) => new mongoose.Types.ObjectId(b));
    if (branchIds.length === 0) {
      throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Account has no assigned branches');
    }
    const [hasApt, hasSr] = await Promise.all([
      Appointment.exists({ petId: pet._id, branchId: { $in: branchIds } }),
      ServiceRecord.exists({ petId: pet._id, branchId: { $in: branchIds } }),
    ]);
    if (!hasApt && !hasSr) {
      throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Pet has no activity in your assigned branches');
    }
    return;
  }

  if (actor.systemRole === 'STAFF') {
    if (mode === 'DELETE') {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Clinical staff cannot delete pet profiles');
    }
    const staffIds = await resolveStaffCandidateIds(actor);
    if (staffIds.length === 0) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You are not assigned to this pet');
    }
    const [assignedApt, assignedSr] = await Promise.all([
      Appointment.exists({
        petId: pet._id,
        $or: [{ 'services.assignedStaffId': { $in: staffIds } }, { reviewerStaffId: { $in: staffIds } }],
      }),
      ServiceRecord.exists({ petId: pet._id, $or: [{ assignedStaffIds: { $in: staffIds } }, { staffId: { $in: staffIds } }] }),
    ]);
    if (!assignedApt && !assignedSr) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You are not assigned to any appointment or record for this pet');
    }
    return;
  }

  throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Unauthorized role for pet access');
};

const parseAndValidatePetInputs = (body = {}, { isUpdate = false } = {}) => {
  const rawName = body.name !== undefined ? body.name : body.pet_name;
  if (!isUpdate && (!rawName || !String(rawName).trim())) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Pet name is required');
  }
  if (isUpdate && rawName !== undefined && !String(rawName).trim()) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Pet name cannot be empty');
  }

  const rawSpecies = body.species !== undefined ? body.species : body.species_name;
  if (!isUpdate && (!rawSpecies || !String(rawSpecies).trim())) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Pet species is required');
  }
  if (isUpdate && rawSpecies !== undefined && !String(rawSpecies).trim()) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Pet species cannot be empty');
  }

  let normalizedSpecies;
  if (rawSpecies !== undefined) {
    const s = String(rawSpecies).trim().toUpperCase();
    if (s.includes('CHÓ') || s.includes('CHO')) normalizedSpecies = 'DOG';
    else if (s.includes('MÈO') || s.includes('MEO')) normalizedSpecies = 'CAT';
    else if (['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'].includes(s)) normalizedSpecies = s;
    else normalizedSpecies = 'OTHER';
  }

  const hasWeight = body.weightKg !== undefined || body.weight_kg !== undefined;
  let parsedWeight;
  if (hasWeight) {
    const rawW = body.weightKg !== undefined ? body.weightKg : body.weight_kg;
    if (rawW === null || rawW === '') {
      parsedWeight = null;
    } else {
      const numW = Number(rawW);
      if (!Number.isFinite(numW) || numW <= 0) {
        throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'weightKg must be greater than 0');
      }
      parsedWeight = numW;
    }
  }

  const hasAge = body.ageYears !== undefined || body.age !== undefined || body.ageMonths !== undefined;
  let parsedAge;
  if (hasAge) {
    if (body.ageYears !== undefined || body.age !== undefined) {
      const rawA = body.ageYears !== undefined ? body.ageYears : body.age;
      const numA = rawA === null || rawA === '' ? 0 : Number(rawA);
      if (!Number.isFinite(numA) || numA < 0) {
        throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'ageYears cannot be negative');
      }
      parsedAge = numA;
    } else if (body.ageMonths !== undefined) {
      const rawM = body.ageMonths;
      const numM = rawM === null || rawM === '' ? 0 : Number(rawM);
      if (!Number.isFinite(numM) || numM < 0) {
        throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'ageMonths cannot be negative');
      }
      parsedAge = Number((numM / 12).toFixed(2));
    }
  }

  return {
    name: rawName !== undefined ? String(rawName).trim() : undefined,
    species: normalizedSpecies,
    weightKg: parsedWeight,
    hasWeight,
    ageYears: parsedAge,
    hasAge,
  };
};

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
    if (!req.actor) {
      throw new AppError(401, 'Unauthenticated', ErrorCodes.UNAUTHENTICATED, 'Authentication required to list pets');
    }

    const requestedCustomerId = req.params.customerId || req.params.id || req.query.customerId || null;
    const filter = {};

    if (req.actor.systemRole === 'CUSTOMER') {
      const ownIds = await resolveActorCustomerObjectIds(req.actor);
      if (requestedCustomerId) {
        const targetIds = await resolveCustomerIds(requestedCustomerId, req.actor);
        const overlaps = targetIds.some((id) => ownIds.includes(id));
        if (!overlaps) {
          throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You cannot list pets belonging to another customer');
        }
      }
      filter.customerId = { $in: ownIds };
    } else if (req.actor.systemRole === 'STAFF' && CLINICAL_SUBROLES.has(req.actor.staffSubRole)) {
      const staffIds = await resolveStaffCandidateIds(req.actor);
      if (staffIds.length === 0) {
        return res.json([]);
      }
      const [apts, srs] = await Promise.all([
        Appointment.find({
          $or: [{ 'services.assignedStaffId': { $in: staffIds } }, { reviewerStaffId: { $in: staffIds } }],
        }).select('petId').lean(),
        ServiceRecord.find({
          $or: [{ assignedStaffIds: { $in: staffIds } }, { staffId: { $in: staffIds } }],
        }).select('petId').lean(),
      ]);
      const assignedPetIds = [...new Set([...apts, ...srs].map((d) => d.petId?.toString()).filter(Boolean))];
      if (assignedPetIds.length === 0) return res.json([]);
      filter._id = { $in: assignedPetIds };
    } else if (req.actor.systemRole === 'MANAGER' || (req.actor.systemRole === 'STAFF' && req.actor.staffSubRole === 'RECEPTIONIST')) {
      const branchIds = (req.actor.authorizedBranchIds || req.actor.assignedBranchIds || [])
        .map((b) => (b?._id || b).toString())
        .filter((b) => mongoose.Types.ObjectId.isValid(b))
        .map((b) => new mongoose.Types.ObjectId(b));
      if (branchIds.length === 0) {
        throw new AppError(403, 'Forbidden', ErrorCodes.BRANCH_SCOPE_ERROR, 'Account has no assigned branches');
      }
      if (requestedCustomerId) {
        const targetIds = await resolveCustomerIds(requestedCustomerId, req.actor);
        filter.customerId = { $in: targetIds };
      } else {
        const [apts, srs] = await Promise.all([
          Appointment.find({ branchId: { $in: branchIds } }).select('petId').lean(),
          ServiceRecord.find({ branchId: { $in: branchIds } }).select('petId').lean(),
        ]);
        const branchPetIds = [...new Set([...apts, ...srs].map((d) => d.petId?.toString()).filter(Boolean))];
        if (branchPetIds.length === 0) return res.json([]);
        filter._id = { $in: branchPetIds };
      }
    } else if (req.actor.systemRole === 'ADMIN') {
      if (requestedCustomerId) {
        const targetIds = await resolveCustomerIds(requestedCustomerId, req.actor);
        if (targetIds.length > 0) filter.customerId = { $in: targetIds };
      }
    } else {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'Unauthorized role for pet listing');
    }

    // Archiving & Status filter
    const statusQuery = req.query.status ? String(req.query.status).trim().toUpperCase() : null;
    if (statusQuery === 'HIDDEN' || statusQuery === 'ẨN') {
      filter.$or = [{ status: 'HIDDEN' }, { isArchived: true }];
    } else if (req.query.isArchived === 'true' || req.query.archived === 'true') {
      filter.isArchived = true;
    } else if (statusQuery === 'ACTIVE' || statusQuery === 'HOẠT ĐỘNG') {
      filter.status = 'ACTIVE';
      filter.isArchived = { $ne: true };
    } else if (statusQuery !== 'ALL' && req.query.includeArchived !== 'true') {
      filter.isArchived = { $ne: true };
      filter.status = { $ne: 'HIDDEN' };
    }

    const pets = await Pet.find(filter).sort({ createdAt: -1 });
    res.json(pets.map((p) => sanitizePetForActor(p, req.actor)));
  } catch (error) {
    next(error);
  }
};

export const createPetHandler = async (req, res, next) => {
  try {
    if (!req.actor) {
      throw new AppError(401, 'Unauthenticated', ErrorCodes.UNAUTHENTICATED, 'Authentication required to create pet');
    }
    if (!['CUSTOMER', 'ADMIN', 'MANAGER'].includes(req.actor.systemRole) && !(req.actor.systemRole === 'STAFF' && req.actor.staffSubRole === 'RECEPTIONIST')) {
      throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You do not have permission to create pet profiles');
    }

    const validated = parseAndValidatePetInputs(req.body, { isUpdate: false });
    const rawTargetId = req.params.customerId || req.params.id || req.body?.customerId || null;

    if (req.actor.systemRole === 'CUSTOMER' && rawTargetId) {
      const ownIds = await resolveActorCustomerObjectIds(req.actor);
      const targetIds = await resolveCustomerIds(rawTargetId, req.actor);
      if (!targetIds.some((id) => ownIds.includes(id))) {
        throw new AppError(403, 'Forbidden', ErrorCodes.AUTHORIZATION_ERROR, 'You cannot create a pet for another customer');
      }
    }

    const rawId = rawTargetId || req.actor.id;
    let customerId = null;
    if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
      const customer = await Customer.findOne({
        $or: [{ _id: rawId }, { userId: rawId }]
      }).lean();
      if (customer) customerId = customer._id;
      else if (req.actor.systemRole !== 'CUSTOMER') customerId = new mongoose.Types.ObjectId(rawId);
    }
    if (!customerId && req.actor.id && mongoose.Types.ObjectId.isValid(req.actor.id)) {
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
      throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Valid customer owner is required');
    }

    const { status, isArchived } = normalizePetStatus(
      req.body.status,
      req.body.isArchived !== undefined ? req.body.isArchived : req.body.archived
    );
    const { doctorName, medicalRecordFileUrl, medicalRecords } = parseMedicalRecords(req.body);

    const petData = {
      name: validated.name,
      species: validated.species,
      breed: req.body.breed || req.body.breed_name || '',
      gender: (req.body.gender || 'UNKNOWN').toUpperCase(),
      ageYears: validated.hasAge ? validated.ageYears : 0,
      ...(validated.hasWeight ? { weightKg: validated.weightKg } : {}),
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
  if (mongoose.Types.ObjectId.isValid(paramId)) {
    const pet = await Pet.findById(paramId);
    if (pet) return pet;
  }
  const clean = String(paramId).trim();
  const searchName = clean.replace(/-/g, ' ');
  return await Pet.findOne({
    $or: [
      { name: new RegExp(`^${clean}$`, 'i') },
      { name: new RegExp(`^${searchName}$`, 'i') },
      { breed: new RegExp(`^${clean}$`, 'i') },
    ]
  });
};

export const getPetHandler = async (req, res, next) => {
  try {
    const pet = await resolvePet(req.params.id);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    await assertPetAccess(pet, req.actor, 'READ');
    res.json(sanitizePetForActor(pet, req.actor));
  } catch (error) {
    next(error);
  }
};

export const updatePetHandler = async (req, res, next) => {
  try {
    const existingPet = await resolvePet(req.params.id);
    if (!existingPet) return res.status(404).json({ message: 'Pet not found' });
    await assertPetAccess(existingPet, req.actor, 'WRITE');

    const validated = parseAndValidatePetInputs(req.body, { isUpdate: true });

    const updates = {
      ...(validated.name !== undefined ? { name: validated.name } : {}),
      ...(validated.species ? { species: validated.species } : {}),
      ...(req.body.breed !== undefined || req.body.breed_name !== undefined ? { breed: req.body.breed || req.body.breed_name } : {}),
      ...(req.body.gender ? { gender: req.body.gender.toUpperCase() } : {}),
      ...(validated.hasAge ? { ageYears: validated.ageYears } : {}),
      ...(validated.hasWeight ? { weightKg: validated.weightKg } : {}),
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

    const pet = await Pet.findByIdAndUpdate(existingPet._id, { $set: updates }, { new: true, runValidators: true });
    res.json(sanitizePetForActor(pet, req.actor));
  } catch (error) {
    next(error);
  }
};

export const updatePetStatusHandler = async (req, res, next) => {
  try {
    const existingPet = await resolvePet(req.params.id);
    if (!existingPet) return res.status(404).json({ message: 'Pet not found' });
    await assertPetAccess(existingPet, req.actor, 'WRITE');
    const { status, isArchived } = normalizePetStatus(
      req.body.status,
      req.body.isArchived !== undefined ? req.body.isArchived : req.body.archived,
      req.body.isHidden !== undefined ? req.body.isHidden : req.body.is_hidden
    );
    const pet = await Pet.findByIdAndUpdate(
      existingPet._id,
      { $set: { status, isArchived } },
      { new: true, runValidators: true }
    );
    res.json(sanitizePetForActor(pet, req.actor));
  } catch (error) {
    next(error);
  }
};

export const deletePetHandler = async (req, res, next) => {
  try {
    const existingPet = await resolvePet(req.params.id);
    if (!existingPet) return res.status(404).json({ message: 'Pet not found' });
    await assertPetAccess(existingPet, req.actor, 'DELETE');
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

