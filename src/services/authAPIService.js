import prisma from '../configs/prisma';
import { hashPassword, comparePassword } from '../utils/passwordHelpers';
import { generateAccessToken, generateRefreshToken, refreshNewTokenService } from '../utils/jwtHelpers';

const registerNewUser = async (rawUserData) => {
  try {
    // Check email or phone exist
    if (rawUserData.email) {
      const isExist = await prisma.user.findFirst({ where: { email: rawUserData.email } });
      if (isExist) return { EM: 'Email is already exist', EC: 2, DT: '' };
    }
    
    if (rawUserData.phone) {
      const isExist = await prisma.user.findFirst({ where: { phone: rawUserData.phone } });
      if (isExist) return { EM: 'Phone is already exist', EC: 2, DT: '' };
    }

    // Get CUSTOMER role
    let customerRole = await prisma.role.findUnique({ where: { role_code: 'CUSTOMER' } });
    if (!customerRole) {
      customerRole = await prisma.role.create({
        data: { role_code: 'CUSTOMER', role_name: 'Customer' }
      });
    }

    const hashed_password = hashPassword(rawUserData.password);

    // Create user
    await prisma.user.create({
      data: {
        role_id: customerRole.role_id,
        full_name: rawUserData.full_name || 'Anonymous',
        email: rawUserData.email || null,
        phone: rawUserData.phone || null,
        password_hash: hashed_password
      }
    });

    return { EM: 'Register successful', EC: 0, DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const loginUser = async (loginData) => {
  try {
    const { login_id, password } = loginData;
    
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: login_id },
          { phone: login_id }
        ]
      },
      include: { role: true }
    });

    if (!user) {
      return { EM: 'Email/Phone or Password incorrect', EC: 1, DT: '' };
    }

    const isCorrectPassword = comparePassword(password, user.password_hash);
    if (!isCorrectPassword) {
      return { EM: 'Email/Phone or Password incorrect', EC: 1, DT: '' };
    }

    // Prepare payload
    const payload = {
      user_id: user.user_id.toString(),
      role_code: user.role.role_code,
      email: user.email,
      full_name: user.full_name
    };

    const access_token = generateAccessToken(payload);
    const refresh_token = generateRefreshToken(payload);

    return {
      EM: 'Login successful',
      EC: 0,
      DT: {
        access_token,
        refresh_token,
        user: payload
      }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const refreshNewToken = async (refreshToken) => {
  try {
    const newAccessToken = refreshNewTokenService(refreshToken);
    if (!newAccessToken) {
      return { EM: 'Refresh token is invalid or expired', EC: -999, DT: '' };
    }
    return {
      EM: 'Refresh token successfully',
      EC: 0,
      DT: { access_token: newAccessToken }
    };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  registerNewUser,
  loginUser,
  refreshNewToken
};
