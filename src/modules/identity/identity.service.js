import User from './models/User';
import Customer from '../customer/models/Customer';
import AppError from '../../utils/AppError';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../../shared/config';

const generateTokens = (user) => {
  const payload = {
    id: user._id,
    systemRole: user.systemRole,
    staffSubRole: user.staffSubRole || null,
    assignedBranchIds: user.assignedBranchIds || [],
    authorizedBranchIds: user.authorizedBranchIds || []
  };

  const accessToken = jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: user._id }, config.jwt.refreshSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken, expiresIn: 900 };
};

export const login = async ({ username, password }) => {
  // username can be email or phone
  const user = await User.findOne({ $or: [{ email: username }, { phone: username }] });
  
  if (!user || user.accountStatus !== 'ACTIVE') {
    throw new AppError(401, 'Unauthenticated', 'INVALID_CREDENTIALS', 'Invalid credentials or account blocked');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    user.failedLoginCount += 1;
    await user.save();
    throw new AppError(401, 'Unauthenticated', 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  user.failedLoginCount = 0;
  user.lastLogin = new Date();
  await user.save();

  return generateTokens(user);
};

export const refresh = async ({ refreshToken }) => {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    const user = await User.findById(decoded.id);
    if (!user || user.accountStatus !== 'ACTIVE') {
      throw new Error('Invalid user');
    }
    return generateTokens(user);
  } catch (error) {
    throw new AppError(401, 'Unauthenticated', 'INVALID_TOKEN', 'Invalid or expired refresh token');
  }
};

export const logout = async (userId) => {
  // Since we are not saving refresh tokens in DB for this skeleton, we just return.
  // In a real app with RefreshSession rotation, we'd delete the session here.
  return true;
};

export const register = async (data) => {
  const existingUser = await User.findOne({ $or: [{ email: data.email }, { phone: data.phone }] });
  if (existingUser) {
    throw new AppError(409, 'Conflict', 'USER_EXISTS', 'Email or phone already registered');
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  
  const user = new User({
    systemRole: 'CUSTOMER',
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    passwordHash
  });
  
  await user.save();

  const customer = new Customer({
    userId: user._id,
    activationStatus: 'ACTIVATED',
    contactEmail: data.email,
    contactPhone: data.phone
  });
  
  await customer.save();

  return generateTokens(user);
};

export const forgotPassword = async (data) => {
  // Generate OTP and send email/sms
  // return 202 without revealing user existence
  return true;
};

export const resetPassword = async (data) => {
  // Verify OTP and reset password
  return true;
};

export const resendOtp = async (data) => {
  // Resend OTP
  return true;
};

export const getMe = async (userId) => {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw new AppError(404, 'NotFound', 'USER_NOT_FOUND', 'User not found');
  
  let customerDetails = null;
  if (user.systemRole === 'CUSTOMER') {
    customerDetails = await Customer.findOne({ userId: user._id });
  }

  return { user, customerDetails };
};
