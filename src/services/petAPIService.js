import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';
import path from 'path';
import fs from 'fs';

const saveBase64Image = (base64Str) => {
  if (!base64Str || !base64Str.startsWith('data:image/')) return base64Str;
  try {
    const matches = base64Str.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64Str;
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');
    const fileName = `pet-${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    const uploadDir = path.join(__dirname, '../../public/uploads/pets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return `/uploads/pets/${fileName}`;
  } catch (error) {
    console.error('Error saving base64 image:', error);
    return base64Str;
  }
};

const findOrCreateBreed = async (speciesId, breedIdOrName) => {
  if (!breedIdOrName) return null;
  const parsedId = toBigIntId(breedIdOrName);
  if (parsedId) return parsedId;
  const breedName = String(breedIdOrName).trim();
  if (!breedName) return null;
  const existingBreed = await prisma.petBreed.findFirst({
    where: {
      breed_name: breedName,
      species_id: speciesId
    }
  });
  if (existingBreed) return existingBreed.breed_id;
  const newBreed = await prisma.petBreed.create({
    data: {
      breed_name: breedName,
      species_id: speciesId
    }
  });
  return newBreed.breed_id;
};

const calculateAgeText = (birthDate, dbAge) => {
  if (!birthDate) return dbAge || 'Chưa rõ';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return dbAge || 'Chưa rõ';
  const now = new Date();
  
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years > 0) {
    if (months > 0) {
      return `${years} tuổi ${months} tháng`;
    }
    return `${years} tuổi`;
  } else if (months > 0) {
    return `${months} tháng`;
  } else {
    return 'Dưới 1 tháng';
  }
};

const formatPetData = (pet) => {
  if (!pet) return null;
  const formatted = { ...pet };
  if (formatted.birth_date) {
    if (formatted.birth_date instanceof Date) {
      formatted.birth_date = formatted.birth_date.toISOString().split('T')[0];
    } else if (typeof formatted.birth_date === 'string') {
      formatted.birth_date = formatted.birth_date.split('T')[0];
    }
  }
  formatted.age_text = calculateAgeText(pet.birth_date, pet.age);
  return formatted;
};

const getMyPets = async (userIdStr, query = {}) => {
  try {
    const userId = toBigIntId(userIdStr);
    if (!userId) return { EM: 'Invalid user ID', EC: 1, DT: '' };

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const healthStatus = query.health_status;
    const validHealthStatuses = ['healthy', 'treating', 'need_recheck', 'unknown'];
    if (healthStatus && !validHealthStatuses.includes(healthStatus)) {
      return { EM: 'Invalid health_status', EC: 1, DT: '' };
    }

    const sortFields = {
      created_at: 'created_at',
      pet_name: 'pet_name'
    };
    const sortBy = sortFields[query.sort_by] || 'created_at';
    const sortOrder = query.sort_order === 'asc' ? 'asc' : 'desc';
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 100);

    const where = {
      owner_user_id: userId,
      status: 'active',
      ...(search ? { pet_name: { contains: search } } : {}),
      ...(healthStatus ? { health_status: healthStatus } : {})
    };

    const [pets, total] = await prisma.$transaction([
      prisma.pet.findMany({
        where,
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
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.pet.count({ where })
    ]);

    const formattedPets = pets.map(pet => {
      const formatted = formatPetData(pet);
      return {
        ...formatted,
        latest_exam_date: pet.medical_records.length > 0 ? pet.medical_records[0].visit_date : null,
        medical_records: undefined
      };
    });

    return {
      EM: 'Get my pets successful',
      EC: 0,
      DT: {
        pets: formattedPets,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    };
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

    const formattedPet = formatPetData(pet);
    return { EM: 'Get pet successful', EC: 0, DT: formattedPet };
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
      return { EM: 'Thiếu tên thú cưng hoặc chủng loại', EC: 1, DT: '' };
    }

    const trimmedName = String(data.pet_name).trim();
    if (trimmedName.length < 2) {
      return { EM: 'Tên thú cưng phải có ít nhất 2 ký tự', EC: 1, DT: '' };
    }
    if (trimmedName.length > 50) {
      return { EM: 'Tên thú cưng không được quá 50 ký tự', EC: 1, DT: '' };
    }

    // Validate gender
    const validGenders = ['male', 'female', 'unknown'];
    if (data.gender && !validGenders.includes(data.gender)) {
      return { EM: 'Giới tính thú cưng không hợp lệ (chỉ chấp nhận: male, female, unknown)', EC: 1, DT: '' };
    }

    // Validate health_status
    const validHealthStatuses = ['healthy', 'treating', 'need_recheck', 'unknown'];
    if (data.health_status && !validHealthStatuses.includes(data.health_status)) {
      return { EM: 'Trạng thái sức khỏe không hợp lệ (chỉ chấp nhận: healthy, treating, need_recheck, unknown)', EC: 1, DT: '' };
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
    const breedId = await findOrCreateBreed(speciesId, data.breed_id);

    // Convert age to string if provided
    let ageStr = null;
    if (data.age !== undefined && data.age !== null && data.age !== '') {
      ageStr = String(data.age);
    }

    // Dynamic breed mapping already validates connection via findOrCreateBreed
    
    const newPet = await prisma.pet.create({
      data: {
        owner_user_id: userId,
        pet_name: trimmedName,
        species_id: speciesId,
        breed_id: breedId,
        gender: data.gender || 'unknown',
        birth_date: data.birth_date ? new Date(data.birth_date) : null,
        age: ageStr,
        weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
        health_status: data.health_status || 'unknown',
        medical_note: data.medical_note || null,
        profile_image_url: data.profile_image_url ? saveBase64Image(data.profile_image_url) : null,
      }
    });

    if (data.profile_image_url) {
      await prisma.petImage.create({
        data: {
          pet_id: newPet.pet_id,
          image_url: newPet.profile_image_url,
          is_primary: true
        }
      });
    }

    const formattedPet = formatPetData(newPet);
    return { EM: 'Create pet successful', EC: 0, DT: formattedPet };
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

    // Validate pet_name if provided
    if (data.pet_name !== undefined) {
      const trimmedName = String(data.pet_name).trim();
      if (trimmedName.length < 2) {
        return { EM: 'Tên thú cưng phải có ít nhất 2 ký tự', EC: 1, DT: '' };
      }
      if (trimmedName.length > 50) {
        return { EM: 'Tên thú cưng không được quá 50 ký tự', EC: 1, DT: '' };
      }
    }

    // Validate gender if provided
    const validGenders = ['male', 'female', 'unknown'];
    if (data.gender && !validGenders.includes(data.gender)) {
      return { EM: 'Giới tính thú cưng không hợp lệ (chỉ chấp nhận: male, female, unknown)', EC: 1, DT: '' };
    }

    // Validate health_status if provided
    const validHealthStatuses = ['healthy', 'treating', 'need_recheck', 'unknown'];
    if (data.health_status && !validHealthStatuses.includes(data.health_status)) {
      return { EM: 'Trạng thái sức khỏe không hợp lệ (chỉ chấp nhận: healthy, treating, need_recheck, unknown)', EC: 1, DT: '' };
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
    let breedId = null;
    if (data.breed_id !== undefined) {
      breedId = await findOrCreateBreed(effectiveSpeciesId, data.breed_id);
    } else {
      breedId = existingPet.breed_id;
    }

    const updateData = {};
    if (data.pet_name) updateData.pet_name = data.pet_name.trim();
    if (data.species_id) updateData.species_id = toBigIntId(data.species_id);
    if (data.breed_id !== undefined) updateData.breed_id = breedId;
    if (data.gender) updateData.gender = data.gender;
    if (data.birth_date) updateData.birth_date = new Date(data.birth_date);
    if (data.age !== undefined) {
      updateData.age = (data.age !== null && data.age !== '') ? String(data.age) : null;
    }
    if (data.weight_kg) updateData.weight_kg = parseFloat(data.weight_kg);
    if (data.health_status) updateData.health_status = data.health_status;
    if (data.medical_note !== undefined) updateData.medical_note = data.medical_note;
    if (data.profile_image_url !== undefined) {
      updateData.profile_image_url = data.profile_image_url ? saveBase64Image(data.profile_image_url) : null;
    }
    if (data.status && currentUser.role_code === 'ADMIN') updateData.status = data.status;

    const updatedPet = await prisma.pet.update({
      where: { pet_id: petId },
      data: updateData
    });

    if (data.profile_image_url !== undefined) {
      await prisma.petImage.updateMany({
        where: { pet_id: petId, is_primary: true },
        data: { is_primary: false }
      });

      if (updateData.profile_image_url) {
        await prisma.petImage.create({
          data: {
            pet_id: petId,
            image_url: updateData.profile_image_url,
            is_primary: true
          }
        });
      }
    }

    const formattedPet = formatPetData(updatedPet);
    return { EM: 'Update pet successful', EC: 0, DT: formattedPet };
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
