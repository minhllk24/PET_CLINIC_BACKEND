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

const handleVerifyRegisterOtp = async (req, res) => {
  try {
    const { login_id, otp_code } = req.body;
    if (!login_id || !otp_code) {
      return sendResponse(res, 400, 'Missing email/phone or OTP', 1);
    }

    let data = await authAPIService.verifyRegisterOtp(login_id, otp_code);
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
    
    // Inject ip_address and user_agent for session tracking
    req.body.ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    req.body.user_agent = req.headers['user-agent'];

    let data = await authAPIService.loginUser(req.body);
    
    // Set refresh token in HttpOnly cookie if login successful
    if (data && data.DT && data.DT.refresh_token) {
      const isRememberMe = req.body.remember_me === true;
      const sessionExpiryDays = isRememberMe ? 30 : 1;
      const isProduction = process.env.NODE_ENV === 'production';

      res.cookie('refresh_token', data.DT.refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'None' : 'Lax',
        maxAge: sessionExpiryDays * 24 * 60 * 60 * 1000
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
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax'
    });
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

const handleForgotPassword = async (req, res) => {
  try {
    if (!req.body.email) {
      return sendResponse(res, 400, 'Missing email', 1);
    }

    let data = await authAPIService.forgotPassword(req.body.email);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleVerifyOtp = async (req, res) => {
  try {
    const { email, otp_code } = req.body;
    if (!email || !otp_code) {
      return sendResponse(res, 400, 'Missing email or otp_code', 1);
    }

    let data = await authAPIService.verifyOtp(email, otp_code);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleResetPassword = async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;
    if (!reset_token || !new_password) {
      return sendResponse(res, 400, 'Missing reset_token or new_password', 1);
    }
    if (new_password.length < 8) {
      return sendResponse(res, 400, 'Password must be at least 8 characters long', 1);
    }

    let data = await authAPIService.resetPassword(reset_token, new_password);
    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

const handleChangePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return sendResponse(res, 400, 'Missing password', 1);
    }
    
    // req.user from verifyToken middleware
    const userId = req.user.user_id;

    let data = await authAPIService.changePassword(userId, old_password, new_password);

    // If change password successful, clear refresh token cookie (logout from current device too)
    if (data.EC === 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'None' : 'Lax'
      });
    }

    return sendResponse(res, 200, data.EM, data.EC, data.DT);
  } catch (error) {
    console.error(error);
    return sendResponse(res, 500, 'Internal server error', -2);
  }
};

module.exports = {
  handleRegister,
  handleVerifyRegisterOtp,
  handleLogin,
  handleLogout,
  handleRefreshToken,
  handleForgotPassword,
  handleVerifyOtp,
  handleResetPassword,
  handleChangePassword
};
