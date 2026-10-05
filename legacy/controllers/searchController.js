import searchAPIService from '../services/searchAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleSearch = async (req, res) => {
  try {
    const query = {
      ...req.query,
      userId: req.user ? req.user.user_id : null
    };
    let data = await searchAPIService.unifiedSearch(query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleGetSuggestions = async (req, res) => {
  try {
    let data = await searchAPIService.getSearchSuggestions(req.query);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleSearch,
  handleGetSuggestions
};
