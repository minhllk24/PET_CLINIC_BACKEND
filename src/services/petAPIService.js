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

    if (!pet) return { EM: 'Hồ sơ thú cưng không tồn tại', EC: -1, DT: '', statusCode: 404 };

    // Check permission
    if (currentUser.role_code !== 'ADMIN' && currentUser.user_id !== pet.owner_user_id.toString()) {
      return { EM: 'Bạn không có quyền truy cập hồ sơ này', EC: -1, DT: '', statusCode: 403 };
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

    // Validate weight_kg
    if (data.weight_kg !== undefined && data.weight_kg !== null && data.weight_kg !== '') {
      const weight = parseFloat(data.weight_kg);
      if (isNaN(weight) || weight <= 0) {
        return { EM: 'Cân nặng phải là số dương', EC: 1, DT: '' };
      }
      if (weight > 200) {
        return { EM: 'Cân nặng không hợp lệ (tối đa 200kg)', EC: 1, DT: '' };
      }
    }

    // Validate birth_date
    if (data.birth_date) {
      const birthDate = new Date(data.birth_date);
      if (isNaN(birthDate.getTime())) {
        return { EM: 'Ngày sinh không hợp lệ', EC: 1, DT: '' };
      }
      if (birthDate > new Date()) {
        return { EM: 'Ngày sinh không được lớn hơn ngày hiện tại', EC: 1, DT: '' };
      }
    }

    const speciesId = toBigIntId(data.species_id);
    const breedId = data.breed_id ? toBigIntId(data.breed_id) : null;

    // Convert age to string if provided
    let ageStr = null;
    if (data.age !== undefined && data.age !== null && data.age !== '') {
      ageStr = String(data.age);
    }

    // Validate breed belongs to species
    if (breedId && speciesId) {
      const breed = await prisma.petBreed.findFirst({
        where: {
          breed_id: breedId,
          species_id: speciesId
        }
      });
      if (!breed) {
        return { EM: 'Giống loài không phù hợp với loài đã chọn', EC: 1, DT: '' };
      }
    }

    const newPet = await prisma.pet.create({
      data: {
        owner_user_id: userId,
        pet_name: data.pet_name,
        species_id: speciesId,
        breed_id: breedId,
        gender: data.gender || 'unknown',
        birth_date: data.birth_date ? new Date(data.birth_date) : null,
        age: ageStr,
        weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
        health_status: data.health_status || 'unknown',
        medical_note: data.medical_note || null,
      }
    });

    if (data.profile_image_url) {
      await prisma.petImage.create({
        data: {
          pet_id: newPet.pet_id,
          image_url: data.profile_image_url,
          is_primary: true
        }
      });
    }

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
    if (!existingPet) return { EM: 'Hồ sơ thú cưng không tồn tại', EC: -1, DT: '', statusCode: 404 };

    if (currentUser.role_code !== 'ADMIN' && currentUser.user_id !== existingPet.owner_user_id.toString()) {
      return { EM: 'Bạn không có quyền truy cập hoặc cập nhật hồ sơ này', EC: -1, DT: '', statusCode: 403 };
    }

    // Validate weight_kg
    if (data.weight_kg !== undefined && data.weight_kg !== null && data.weight_kg !== '') {
      const weight = parseFloat(data.weight_kg);
      if (isNaN(weight) || weight <= 0) {
        return { EM: 'Cân nặng phải là số dương', EC: 1, DT: '' };
      }
      if (weight > 200) {
        return { EM: 'Cân nặng không hợp lệ (tối đa 200kg)', EC: 1, DT: '' };
      }
    }

    // Validate birth_date
    if (data.birth_date) {
      const birthDate = new Date(data.birth_date);
      if (isNaN(birthDate.getTime())) {
        return { EM: 'Ngày sinh không hợp lệ', EC: 1, DT: '' };
      }
      if (birthDate > new Date()) {
        return { EM: 'Ngày sinh không được lớn hơn ngày hiện tại', EC: 1, DT: '' };
      }
    }

    // Validate breed belongs to species
    const effectiveSpeciesId = data.species_id ? toBigIntId(data.species_id) : existingPet.species_id;
    const effectiveBreedId = data.breed_id !== undefined 
      ? (data.breed_id ? toBigIntId(data.breed_id) : null) 
      : existingPet.breed_id;

    if (effectiveBreedId && effectiveSpeciesId) {
      const breed = await prisma.petBreed.findFirst({
        where: {
          breed_id: effectiveBreedId,
          species_id: effectiveSpeciesId
        }
      });
      if (!breed) {
        return { EM: 'Giống loài không phù hợp với loài đã chọn', EC: 1, DT: '' };
      }
    }

    const updateData = {};
    if (data.pet_name) updateData.pet_name = data.pet_name;
    if (data.species_id) updateData.species_id = toBigIntId(data.species_id);
    if (data.breed_id !== undefined) updateData.breed_id = data.breed_id ? toBigIntId(data.breed_id) : null;
    if (data.gender) updateData.gender = data.gender;
    if (data.birth_date) updateData.birth_date = new Date(data.birth_date);
    if (data.age !== undefined) {
      updateData.age = (data.age !== null && data.age !== '') ? String(data.age) : null;
    }
    if (data.weight_kg) updateData.weight_kg = parseFloat(data.weight_kg);
    if (data.health_status) updateData.health_status = data.health_status;
    if (data.medical_note !== undefined) updateData.medical_note = data.medical_note;
    if (data.status && currentUser.role_code === 'ADMIN') updateData.status = data.status;

    const updatedPet = await prisma.pet.update({
      where: { pet_id: petId },
      data: updateData
    });

    if (data.profile_image_url) {
      // Set all existing images to is_primary: false
      await prisma.petImage.updateMany({
        where: { pet_id: petId, is_primary: true },
        data: { is_primary: false }
      });
      // Create new primary image
      await prisma.petImage.create({
        data: {
          pet_id: petId,
          image_url: data.profile_image_url,
          is_primary: true
        }
      });
    }

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
    if (!existingPet) return { EM: 'Hồ sơ thú cưng không tồn tại', EC: -1, DT: '', statusCode: 404 };

    if (currentUser.role_code !== 'ADMIN' && currentUser.user_id !== existingPet.owner_user_id.toString()) {
      return { EM: 'Bạn không có quyền truy cập hoặc xóa hồ sơ này', EC: -1, DT: '', statusCode: 403 };
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
