import prisma from '../configs/prisma';
import { toBigIntId } from '../utils/prismaHelpers';

// --- RESCUE STATIONS & POSTS ---
const getStations = async () => {
  try {
    const stations = await prisma.rescueStation.findMany({
      where: { status: 'active' }
    });
    return { EM: 'Get stations successful', EC: 0, DT: stations };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getRescuePosts = async () => {
  try {
    const posts = await prisma.rescuePost.findMany({
      where: { status: 'published' },
      orderBy: { created_at: 'desc' }
    });
    return { EM: 'Get rescue posts successful', EC: 0, DT: posts };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

// --- ADOPTION ---
const getAdoptionPets = async () => {
  try {
    const pets = await prisma.adoptionPet.findMany({
      where: { status: 'available' },
      include: {
        images: true
      },
      orderBy: { created_at: 'desc' }
    });
    return { EM: 'Get adoption pets successful', EC: 0, DT: pets };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const createAdoptionRequest = async (userIdStr, data) => {
  try {
    const userId = toBigIntId(userIdStr);
    const adoptionPetId = toBigIntId(data.adoption_pet_id);

    if (!adoptionPetId) return { EM: 'Missing adoption_pet_id', EC: 1, DT: '' };

    const pet = await prisma.adoptionPet.findUnique({ where: { adoption_pet_id: adoptionPetId } });
    if (!pet || pet.status !== 'available') {
      return { EM: 'Pet is not available for adoption', EC: -1, DT: '' };
    }

    // Rule: User only allowed max 3 pending requests
    const pendingRequests = await prisma.adoptionRequest.count({
      where: { user_id: userId, status: 'pending' }
    });

    if (pendingRequests >= 3) {
      return { EM: 'You can only have maximum 3 pending requests', EC: -1, DT: '' };
    }

    // Rule: Cannot send 2 pending requests for the same pet
    const existingReq = await prisma.adoptionRequest.findFirst({
      where: { user_id: userId, adoption_pet_id: adoptionPetId, status: 'pending' }
    });

    if (existingReq) {
      return { EM: 'You already sent a request for this pet', EC: -1, DT: '' };
    }

    const newReq = await prisma.adoptionRequest.create({
      data: {
        adoption_pet_id: adoptionPetId,
        user_id: userId,
        full_name: data.full_name,
        address: data.address,
        reason: data.reason,
        housing_info: data.housing_info || null,
        experience: data.experience || null,
        status: 'pending'
      }
    });

    return { EM: 'Create adoption request successful', EC: 0, DT: newReq };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const getMyAdoptionRequests = async (userIdStr) => {
  try {
    const userId = toBigIntId(userIdStr);
    const requests = await prisma.adoptionRequest.findMany({
      where: { user_id: userId },
      include: { adoption_pet: { include: { images: true } } },
      orderBy: { created_at: 'desc' }
    });
    return { EM: 'Get requests successful', EC: 0, DT: requests };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const updateAdoptionRequestStatus = async (id, status) => {
  try {
    const reqId = toBigIntId(id);
    if (!reqId) return { EM: 'Invalid request ID', EC: 1, DT: '' };

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) return { EM: 'Invalid status', EC: 1, DT: '' };

    const adoptionReq = await prisma.adoptionRequest.findUnique({ where: { adoption_request_id: reqId } });
    if (!adoptionReq) return { EM: 'Request not found', EC: -1, DT: '' };

    const result = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.adoptionRequest.update({
        where: { adoption_request_id: reqId },
        data: { status }
      });

      if (status === 'approved') {
        await tx.adoptionPet.update({
          where: { adoption_pet_id: adoptionReq.adoption_pet_id },
          data: { status: 'adopted' }
        });

        // Reject other pending requests for this pet
        await tx.adoptionRequest.updateMany({
          where: { adoption_pet_id: adoptionReq.adoption_pet_id, status: 'pending' },
          data: { status: 'rejected' }
        });
      }

      return updatedReq;
    });

    return { EM: 'Update status successful', EC: 0, DT: result };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  getStations,
  getRescuePosts,
  getAdoptionPets,
  createAdoptionRequest,
  getMyAdoptionRequests,
  updateAdoptionRequestStatus
};
