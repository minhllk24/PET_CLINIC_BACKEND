import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import GuestContact from './models/GuestContact';
import Customer from './models/Customer';
import User from '../../models/User';
import Order from '../order/models/Order';
import Appointment from '../booking/models/Appointment';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import config from '../../shared/config';

// In-memory OTP storage for guest lookup
// key: identifier (phone or email), value: { otp, expiresAt, attempts, lastRequestedAt }
const otpStore = new Map();

/**
 * Generate a 6-digit numeric OTP
 */
const generateOtp = () => {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
    return '123456';
  }
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Request an OTP for guest lookup
 */
export const requestGuestOtp = async ({ phone, email }) => {
  if (!phone && !email) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Either phone or email must be provided');
  }

  const identifier = (phone || email).trim().toLowerCase();
  const existing = otpStore.get(identifier);

  // Rate limit: 60s resend delay
  if (existing && Date.now() - existing.lastRequestedAt < 60000) {
    const waitSeconds = Math.ceil((60000 - (Date.now() - existing.lastRequestedAt)) / 1000);
    throw new AppError(429, 'RateLimitExceeded', 'RATE_LIMIT_EXCEEDED', `Please wait ${waitSeconds}s before requesting a new OTP`);
  }

  const otp = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

  otpStore.set(identifier, {
    otp,
    expiresAt,
    attempts: 0,
    lastRequestedAt: Date.now(),
    phone: phone ? phone.trim() : null,
    email: email ? email.trim().toLowerCase() : null,
  });

  return {
    message: 'OTP sent successfully',
    expiresIn: 300,
    otp: config.env !== 'production' ? otp : undefined,
  };
};

/**
 * Verify OTP for guest lookup and issue short-lived token
 */
export const verifyGuestOtp = async ({ phone, email, otp }) => {
  if (!otp) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'OTP is required');
  }
  if (!phone && !email) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Either phone or email must be provided');
  }

  const identifier = (phone || email).trim().toLowerCase();
  const record = otpStore.get(identifier);

  if (!record) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'No OTP request found for this contact. Please request a new OTP.');
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(identifier);
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'OTP has expired. Please request a new one.');
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    otpStore.delete(identifier);
    throw new AppError(429, 'TooManyRequests', 'RATE_LIMIT_EXCEEDED', 'Too many failed attempts. Please request a new OTP.');
  }

  if (record.otp !== otp.trim()) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'Invalid OTP code.');
  }

  // Clear OTP on successful verification
  otpStore.delete(identifier);

  // Find or create GuestContact
  const query = phone ? { phone: phone.trim() } : { email: email.trim().toLowerCase() };
  let guest = await GuestContact.findOne(query);

  if (!guest) {
    guest = new GuestContact({
      fullName: phone || email,
      phone: phone ? phone.trim() : undefined,
      email: email ? email.trim().toLowerCase() : undefined,
      activationStatus: 'NO_ACCOUNT',
    });
    await guest.save();
  }

  // Sign a guest lookup token (valid 15 mins)
  const tokenPayload = {
    guestContactId: guest._id.toString(),
    phone: guest.phone,
    email: guest.email,
    isGuest: true,
  };

  const token = jwt.sign(tokenPayload, config.jwt.accessSecret, { expiresIn: '15m' });

  return {
    token,
    expiresIn: 900,
    guestContactId: guest._id.toString(),
  };
};

/**
 * Verify a guest lookup token
 */
export const verifyGuestToken = (token) => {
  if (!token) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'Guest token required');
  }
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'Invalid or expired guest token');
  }
};

/**
 * Get guest transactions (orders & appointments)
 */
export const getGuestTransactions = async (guestTokenPayload) => {
  const { guestContactId, phone, email } = guestTokenPayload;
  const objectId = mongoose.Types.ObjectId.isValid(guestContactId)
    ? new mongoose.Types.ObjectId(guestContactId)
    : null;

  const orderQuery = {
    $or: [
      ...(objectId ? [{ guestContactId: objectId }] : []),
      ...(phone ? [{ 'contactSnapshot.phone': phone }] : []),
      ...(email ? [{ 'contactSnapshot.email': email }] : []),
    ],
  };

  const appointmentQuery = {
    $or: [
      ...(objectId ? [{ guestContactId: objectId }] : []),
      ...(phone ? [{ 'contactSnapshot.phone': phone }] : []),
      ...(email ? [{ 'contactSnapshot.email': email }] : []),
    ],
  };

  const [orders, appointments] = await Promise.all([
    Order.find(orderQuery).sort({ createdAt: -1 }),
    Appointment.find(appointmentQuery).sort({ scheduledStart: -1 }),
  ]);

  return { orders, appointments };
};

/**
 * Send / create activation invite
 */
export const sendActivationInvite = async ({ guestContactId, phone, email }) => {
  let guest;
  if (guestContactId && mongoose.Types.ObjectId.isValid(guestContactId)) {
    guest = await GuestContact.findById(guestContactId);
  } else if (phone || email) {
    const query = phone ? { phone: phone.trim() } : { email: email.trim().toLowerCase() };
    guest = await GuestContact.findOne(query);
  }

  if (!guest) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Guest contact not found');
  }

  if (guest.activationStatus === 'ACTIVATED') {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Account is already activated');
  }

  const activationToken = crypto.randomBytes(24).toString('hex');
  guest.activationStatus = 'PENDING_ACTIVATION';
  guest.activationToken = activationToken;
  guest.activationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  guest.activationInviteSentAt = new Date();
  await guest.save();

  return {
    message: 'Activation invite sent successfully',
    token: activationToken,
    activationStatus: guest.activationStatus,
    expiresAt: guest.activationExpiresAt,
  };
};

/**
 * Complete activation, create User + Customer, link all transactions
 */
export const completeActivation = async ({ token, password, acceptTerms, fullName }) => {
  if (acceptTerms !== true) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'You must accept the terms and conditions');
  }

  if (!password || typeof password !== 'string') {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Password is required');
  }

  // Password requirements: 8+ chars, at least 1 uppercase, at least 1 number
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError(
      400,
      'ValidationError',
      ErrorCodes.VALIDATION_ERROR,
      'Password must be at least 8 characters long and contain at least one uppercase letter and one number'
    );
  }

  if (!token) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Activation token is required');
  }

  const guest = await GuestContact.findOne({ activationToken: token });
  if (!guest) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Invalid or expired activation token');
  }

  if (guest.activationStatus === 'ACTIVATED') {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'Account has already been activated');
  }

  if (guest.activationExpiresAt && new Date() > guest.activationExpiresAt) {
    throw new AppError(410, 'Gone', 'TOKEN_EXPIRED', 'Activation token has expired');
  }

  // Check if User already exists with this phone or email
  const existingUser = await User.findOne({
    $or: [
      ...(guest.phone ? [{ phone: guest.phone }] : []),
      ...(guest.email ? [{ email: guest.email }] : []),
    ],
  });

  if (existingUser) {
    throw new AppError(409, 'Conflict', ErrorCodes.CONFLICT, 'An account already exists with this phone or email');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const resolvedName = fullName || guest.fullName || 'Valued Customer';

    const newUser = new User({
      phone: guest.phone || undefined,
      email: guest.email || undefined,
      username: guest.phone || guest.email || `guest_${guest._id.toString().slice(-6)}`,
      fullName: resolvedName,
      passwordHash,
      systemRole: 'CUSTOMER',
      accountStatus: 'ACTIVE',
      activatedAt: new Date(),
    });
    await newUser.save({ session });

    const newCustomer = new Customer({
      userId: newUser._id,
      activationStatus: 'ACTIVATED',
      accountStatus: 'ACTIVE',
      contactPhone: guest.phone,
      contactEmail: guest.email,
      phoneVerifiedAt: guest.phone ? new Date() : null,
      emailVerifiedAt: guest.email ? new Date() : null,
    });
    await newCustomer.save({ session });

    // Link guest transactions
    const [orderRes, aptRes] = await Promise.all([
      Order.updateMany(
        { guestContactId: guest._id },
        { $set: { customerId: newUser._id } },
        { session }
      ),
      Appointment.updateMany(
        { guestContactId: guest._id },
        { $set: { customerId: newCustomer._id } },
        { session }
      ),
    ]);

    // Update guest contact status
    guest.activationStatus = 'ACTIVATED';
    guest.userId = newUser._id;
    guest.customerId = newCustomer._id;
    guest.activationCompletedAt = new Date();
    guest.activationToken = null;
    await guest.save({ session });

    await session.commitTransaction();

    const accessToken = jwt.sign(
      {
        id: newUser._id.toString(),
        systemRole: newUser.systemRole,
        staffSubRole: null,
        assignedBranchIds: [],
        authorizedBranchIds: [],
      },
      config.jwt.accessSecret,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { id: newUser._id.toString() },
      config.jwt.refreshSecret,
      { expiresIn: '7d' }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: newUser._id.toString(),
        fullName: newUser.fullName,
        email: newUser.email || null,
        phone: newUser.phone || null,
        systemRole: newUser.systemRole,
        staffSubRole: null,
        accountStatus: newUser.accountStatus,
        activationStatus: 'ACTIVATED',
        lastLogin: null,
        branchScope: [],
      },
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
};
