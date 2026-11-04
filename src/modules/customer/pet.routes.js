import express from 'express';
import mongoose from 'mongoose';
import Pet from './models/Pet';
import Customer from './models/Customer';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';

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

export const listPetsHandler = async (req, res, next) => {
  try {
    const rawId = req.params.customerId || req.params.id || (req.actor ? req.actor.id : null);
    const targetCustomerIds = await resolveCustomerIds(rawId, req.actor);
    const filter = targetCustomerIds.length > 0 ? { customerId: { $in: targetCustomerIds } } : {};
    const pets = await Pet.find(filter).sort({ createdAt: -1 });
    res.json(pets);
  } catch (error) {
    next(error);
  }
};

export const createPetHandler = async (req, res, next) => {
  try {
    const rawId = req.params.customerId || req.params.id || (req.actor ? req.actor.id : null);
    let customerId = rawId;
    if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
      const customer = await Customer.findOne({
        $or: [{ _id: rawId }, { userId: rawId }]
      }).lean();
      if (customer) customerId = customer._id;
    }
    if (!customerId && req.actor) {
      const customer = await Customer.findOne({ userId: req.actor.id }).lean();
      if (customer) customerId = customer._id;
      else customerId = req.actor.id;
    }
    if (!customerId) {
      customerId = new mongoose.Types.ObjectId();
    }

    let species = String(req.body.species || req.body.species_name || 'DOG').toUpperCase();
    if (species.includes('CHÓ') || species.includes('CHO')) species = 'DOG';
    else if (species.includes('MÈO') || species.includes('MEO')) species = 'CAT';
    else if (!['DOG', 'CAT', 'BIRD', 'RABBIT', 'OTHER'].includes(species)) species = 'OTHER';

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
      customerId,
    };
    const pet = new Pet(petData);
    await pet.save();
    res.status(201).json(pet);
  } catch (error) {
    next(error);
  }
};

export const getPetHandler = async (req, res, next) => {
  try {
    const pet = await Pet.findById(req.params.id);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    res.json(pet);
  } catch (error) {
    next(error);
  }
};

export const updatePetHandler = async (req, res, next) => {
  try {
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
      ...(req.body.breed || req.body.breed_name !== undefined ? { breed: req.body.breed || req.body.breed_name } : {}),
      ...(req.body.gender ? { gender: req.body.gender.toUpperCase() } : {}),
      ...(req.body.ageYears !== undefined || req.body.age !== undefined ? { ageYears: Number(req.body.ageYears || req.body.age || 0) } : {}),
      ...(req.body.weightKg !== undefined || req.body.weight_kg !== undefined ? { weightKg: Number(req.body.weightKg || req.body.weight_kg || 0) } : {}),
      ...(req.body.healthStatus || req.body.health_status ? { healthStatus: req.body.healthStatus || req.body.health_status } : {}),
      ...(req.body.medicalNotes !== undefined || req.body.medical_note !== undefined ? { medicalNotes: req.body.medicalNotes || req.body.medical_note } : {}),
      ...(req.body.photoUrl || req.body.avatar || req.body.profile_image_url ? { photoUrl: req.body.photoUrl || req.body.avatar || req.body.profile_image_url } : {}),
    };

    const pet = await Pet.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    res.json(pet);
  } catch (error) {
    next(error);
  }
};

export const deletePetHandler = async (req, res, next) => {
  try {
    const pet = await Pet.findByIdAndDelete(req.params.id);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });
    res.json({ success: true, message: 'Pet deleted successfully' });
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
router.delete('/:id', optionalAuth, deletePetHandler);

export default router;

