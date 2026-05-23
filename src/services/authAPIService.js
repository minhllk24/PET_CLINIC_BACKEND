import prisma from '../configs/prisma';
import { hashPassword, comparePassword } from '../utils/passwordHelpers';
import { generateAccessToken, generateRefreshToken, refreshNewTokenService } from '../utils/jwtHelpers';
import { sendOtpEmail } from '../utils/emailHelpers';
import { generateOtpCode, generateResetToken, verifyResetToken } from '../utils/otpHelpers';

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

const forgotPassword = async (email) => {
  try {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return { EC: 2, EM: 'Email này chưa được đăng ký. Vui lòng tạo tài khoản mới.', DT: '' };
    }

    // Check if there is an OTP recently created that hasn't expired the resend timer
    const recentOtp = await prisma.otpCode.findFirst({
      where: {
        email,
        purpose: 'forgot_password',
        resend_available_at: { gt: new Date() }
      }
    });

    if (recentOtp) {
      const waitTime = Math.ceil((recentOtp.resend_available_at - new Date()) / 1000);
      return { EC: 1, EM: `Vui lòng chờ ${waitTime}s để gửi lại mã OTP`, DT: '' };
    }

    const otpCode = generateOtpCode();
    
    // Save OTP to db
    await prisma.otpCode.create({
      data: {
        user_id: user.user_id,
        email: user.email,
        otp_code: otpCode,
        purpose: 'forgot_password',
        expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        resend_available_at: new Date(Date.now() + 60 * 1000), // 60 seconds
      }
    });

    // Send email
    const isSent = await sendOtpEmail(email, otpCode);
    if (!isSent) {
      return { EC: -1, EM: 'Không thể gửi email OTP, vui lòng thử lại sau', DT: '' };
    }

    return { EC: 0, EM: 'Mã OTP đã được gửi đến email của bạn', DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const verifyOtp = async (email, otpCode) => {
  try {
    // Find the latest valid OTP
    const validOtp = await prisma.otpCode.findFirst({
      where: {
        email,
        purpose: 'forgot_password',
        used_at: null,
      },
      orderBy: { created_at: 'desc' }
    });

    if (!validOtp) {
      return { EC: 1, EM: 'Không tìm thấy yêu cầu khôi phục mật khẩu hoặc OTP đã bị hủy', DT: '' };
    }

    if (new Date() > validOtp.expires_at) {
      return { EC: 1, EM: 'Mã OTP đã hết hạn', DT: '' };
    }

    if (validOtp.otp_code !== otpCode) {
      // Increase attempt count
      const updatedOtp = await prisma.otpCode.update({
        where: { otp_id: validOtp.otp_id },
        data: { attempt_count: validOtp.attempt_count + 1 }
      });

      if (updatedOtp.attempt_count >= 5) {
        // Lock OTP
        await prisma.otpCode.update({
          where: { otp_id: validOtp.otp_id },
          data: { used_at: new Date() }
        });
        return { EC: 1, EM: 'Mã OTP đã bị khóa do nhập sai quá nhiều lần', DT: '' };
      }
      return { EC: 1, EM: 'Mã OTP không chính xác', DT: '' };
    }

    // Mark as used
    await prisma.otpCode.update({
      where: { otp_id: validOtp.otp_id },
      data: { used_at: new Date() }
    });

    // Generate reset token
    const reset_token = generateResetToken({
      user_id: validOtp.user_id.toString(),
      email: validOtp.email,
      purpose: 'reset_password'
    });

    return { EC: 0, EM: 'Xác thực OTP thành công', DT: { reset_token } };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

const resetPassword = async (resetToken, newPassword) => {
  try {
    const decoded = verifyResetToken(resetToken);
    if (!decoded) {
      return { EC: -999, EM: 'Token không hợp lệ hoặc đã hết hạn', DT: '' };
    }

    const hashed_password = hashPassword(newPassword);

    await prisma.user.update({
      where: { user_id: BigInt(decoded.user_id) },
      data: { password_hash: hashed_password }
    });

    return { EC: 0, EM: 'Mật khẩu đã được cập nhật thành công', DT: '' };
  } catch (error) {
    console.error(error);
    return { EM: 'Something went wrong', EC: -2, DT: '' };
  }
};

module.exports = {
  registerNewUser,
  loginUser,
  refreshNewToken,
  forgotPassword,
  verifyOtp,
  resetPassword
};
