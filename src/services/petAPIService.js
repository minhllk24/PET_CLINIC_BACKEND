import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

const getMyPets = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const pets = await prisma.pet.findMany({
      where: {
        owner_user_id: userId,
        status: 'active'
      },
      include: {
        species: true,
        breed: true,
        pet_images: { where: { is_primary: true } },
        medical_records: {
          orderBy: { visit_date: 'desc' },
          take: 1,
          select: { visit_date: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Format latest_exam_date
    const formattedPets = pets.map(pet => ({
      ...pet,
      latest_exam_date: pet.medical_records.length > 0 ? pet.medical_records[0].visit_date : null,
      medical_records: undefined // hide raw array
    }));

    return { EM: 'Get my pets successful', EC: 0, DT: formattedPets };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getPetById = async (id, currentUser) => {
  try {
    const petId = toBigIntId(id);
    if (!petId) return { EM: 'Invalid pet ID', EC: 1, DT: '' };

    const pet = await prisma.pet.findUnique({
      where: { pet_id: petId },
      include: {
        species: true,
        breed: true,
        pet_images: true
      }
    });

    if (!pet) return { EM: 'Pet not found', EC: -1, DT: '' };

    // Check permission
    if (currentUser.role_code !== 'ADMIN' && currentUser.user_id !== pet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    return { EM: 'Get pet successful', EC: 0, DT: pet };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createPet = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    if (!data.pet_name || !data.species_id) {
      return { EM: 'Missing pet_name or species_id', EC: 1, DT: '' };
    }

    const speciesId = toBigIntId(data.species_id);
    const breedId = data.breed_id ? toBigIntId(data.breed_id) : null;

    const newPet = await prisma.pet.create({
      data: {
        owner_user_id: userId,
        pet_name: data.pet_name,
        species_id: speciesId,
        breed_id: breedId,
        gender: data.gender || 'unknown',
        birth_date: data.birth_date ? new Date(data.birth_date) : null,
        weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
        profile_image_url: data.profile_image_url || null,
        health_status: data.health_status || 'unknown',
        medical_note: data.medical_note || null,
      }
    });

    return { EM: 'Create pet successful', EC: 0, DT: newPet };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updatePet = async (id, data, currentUser) => {
  try {
    const petId = toBigIntId(id);
    if (!petId) return { EM: 'Invalid pet ID', EC: 1, DT: '' };

    const existingPet = await prisma.pet.findUnique({ where: { pet_id: petId } });
    if (!existingPet) return { EM: 'Pet not found', EC: -1, DT: '' };

    if (currentUser.role_code !== 'ADMIN' && currentUser.user_id !== existingPet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    const updateData = {};
    if (data.pet_name) updateData.pet_name = data.pet_name;
    if (data.species_id) updateData.species_id = toBigIntId(data.species_id);
    if (data.breed_id) updateData.breed_id = toBigIntId(data.breed_id);
    if (data.gender) updateData.gender = data.gender;
    if (data.birth_date) updateData.birth_date = new Date(data.birth_date);
    if (data.weight_kg) updateData.weight_kg = parseFloat(data.weight_kg);
    if (data.profile_image_url) updateData.profile_image_url = data.profile_image_url;
    if (data.health_status) updateData.health_status = data.health_status;
    if (data.medical_note !== undefined) updateData.medical_note = data.medical_note;
    if (data.status && currentUser.role_code === 'ADMIN') updateData.status = data.status;

    const updatedPet = await prisma.pet.update({
      where: { pet_id: petId },
      data: updateData
    });

    return { EM: 'Update pet successful', EC: 0, DT: updatedPet };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const deletePet = async (id, currentUser) => {
  try {
    const petId = toBigIntId(id);
    if (!petId) return { EM: 'Invalid pet ID', EC: 1, DT: '' };

    const existingPet = await prisma.pet.findUnique({ where: { pet_id: petId } });
    if (!existingPet) return { EM: 'Pet not found', EC: -1, DT: '' };

    if (currentUser.role_code !== 'ADMIN' && currentUser.user_id !== existingPet.owner_user_id.toString()) {
      return { EM: 'Permission denied', EC: -1, DT: '' };
    }

    // Soft delete
    await prisma.pet.update({
      where: { pet_id: petId },
      data: { status: 'deleted' }
    });

    return { EM: 'Delete pet successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getSpecies = async () => {
  try {
    const species = await prisma.petSpecies.findMany({
      where: { status: 'active' }
    });
    return { EM: 'Get species successful', EC: 0, DT: species };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getBreedsBySpecies = async (speciesIdStr) => {
  try {
    const speciesId = toBigIntId(speciesIdStr);
    if (!speciesId) return { EM: 'Invalid species ID', EC: 1, DT: '' };

    const breeds = await prisma.petBreed.findMany({
      where: { species_id: speciesId }
    });
    return { EM: 'Get breeds successful', EC: 0, DT: breeds };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getMyPets,
  getPetById,
  createPet,
  updatePet,
  deletePet,
  getSpecies,
  getBreedsBySpecies
};
