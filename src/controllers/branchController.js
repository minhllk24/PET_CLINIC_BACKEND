import branchAPIService from '../services/branchAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleGetAllBranches = async (req, res) => {
  try {
    let data = await branchAPIService.getAllBranches();
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleGetAllBranches
};
