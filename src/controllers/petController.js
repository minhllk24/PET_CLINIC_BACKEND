import petAPIService from '../services/petAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetMyPets = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await petAPIService.getMyPets(userId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetDetailPet = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await petAPIService.getPetById(id, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleCreatePet = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let data = await petAPIService.createPet(userId, req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleUpdatePet = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await petAPIService.updatePet(id, req.body, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleDeletePet = async (req, res) => {
  try {
    const id = req.params.id;
    let data = await petAPIService.deletePet(id, req.user);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetSpecies = async (req, res) => {
  try {
    let data = await petAPIService.getSpecies();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetBreeds = async (req, res) => {
  try {
    const speciesId = req.query.species_id;
    if (!speciesId) {
      return sendResponse(res, 400, 'Missing species_id query param', 1);
    }
    let data = await petAPIService.getBreedsBySpecies(speciesId);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetMyPets,
  handleGetDetailPet,
  handleCreatePet,
  handleUpdatePet,
  handleDeletePet,
  handleGetSpecies,
  handleGetBreeds
};
