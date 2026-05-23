import authAPIService from '../services/authAPIService';
import { sendResponse } from '../utils/responseHelpers';

const handleRegister = async (req, res) => {
  try {
    if (!req.body.email && !req.body.phone) {
      return sendResponse(res, 400, 'Missing email or phone', 1);
    }
    if (!req.body.password) {
      return sendResponse(res, 400, 'Missing password', 1);
    }
    
    let data = await authAPIService.registerNewUser(req.body);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleLogin = async (req, res) => {
  try {
    if (!req.body.login_id || !req.body.password) {
      return sendResponse(res, 400, 'Missing credentials', 1);
    }
    
    let data = await authAPIService.loginUser(req.body);
    
    // Set refresh token in HttpOnly cookie if login successful
    if (data && data.DT && data.DT.refresh_token) {
      res.cookie('refresh_token', data.DT.refresh_token, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }

    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleLogout = async (req, res) => {
  try {
    res.clearCookie('refresh_token');
    return sendResponse(res, 200, 'Logout successful', 0);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleRefreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) {
      return sendResponse(res, 401, 'No refresh token found', -999);
    }

    let data = await authAPIService.refreshNewToken(refreshToken);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleRegister,
  handleLogin,
  handleLogout,
  handleRefreshToken
};
