import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import GuestContact from './models/GuestContact';
import Customer from './models/Customer';
import User from '../../models/User';
import OtpChallenge from '../../models/OtpChallenge';
import Order from '../order/models/Order';
import Appointment from '../booking/models/Appointment';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';
import config from '../../shared/config';
import { generateOtpCode, hashOtp, verifyOtp } from '../../utils/otpHelpers';
import { sendGuestOtpEmail, sendActivationInviteEmail } from '../../utils/emailHelpers';
import { recordAuditLog } from '../../utils/auditLogger';

// In-memory store fallback for offline test environments
const mockChallengeStore = new Map();

const findActiveChallenge = async (query) => {
  if (mongoose.connection.readyState === 1) {
    return OtpChallenge.findOne(query).sort({ createdAt: -1 });
  }
  for (const [id, c] of mockChallengeStore.entries()) {
    let match = true;
    if (query._id && id !== query._id.toString()) match = false;
    if (query.identifier && c.identifier !== query.identifier) match = false;
    if (query.purpose && c.purpose !== query.purpose) match = false;
    if (match) return c;
  }
  return null;
};

const saveNewChallenge = async ({ identifier, otpHash, purpose, expiresAt }) => {
  if (mongoose.connection.readyState === 1) {
    await OtpChallenge.deleteMany({ identifier, purpose });
    return OtpChallenge.create({
      identifier,
      otpHash,
      purpose,
      attemptCount: 0,
      expiresAt,
      lastSentAt: new Date(),
    });
  }
  for (const [id, c] of mockChallengeStore.entries()) {
    if (c.identifier === identifier && c.purpose === purpose) {
      mockChallengeStore.delete(id);
    }
  }
  const id = new mongoose.Types.ObjectId().toString();
  const c = {
    _id: id,
    identifier,
    otpHash,
    purpose,
    attemptCount: 0,
    expiresAt,
    lastSentAt: new Date(),
    createdAt: new Date(),
    save: async function () {
      mockChallengeStore.set(id, this);
    },
  };
  mockChallengeStore.set(id, c);
  return c;
};

const removeChallenge = async (challengeId) => {
  if (mongoose.connection.readyState === 1) {
    return OtpChallenge.deleteOne({ _id: challengeId });
  }
  mockChallengeStore.delete(challengeId ? challengeId.toString() : '');
};

/**
 * Request an OTP for guest lookup
 * Uses MongoDB OtpChallenge with TTL and 60s cooldown
 */
export const requestGuestOtp = async ({ phone, email }) => {
  if (!phone && !email) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'Either phone or email must be provided');
  }

  const identifier = (phone || email).trim().toLowerCase();

  // Rate limit: 60s cooldown check
  const existing = await findActiveChallenge({
    identifier,
    purpose: 'GUEST_LOOKUP',
  });

  if (existing) {
    const elapsed = Date.now() - new Date(existing.lastSentAt || existing.createdAt).getTime();
    if (elapsed < 60000) {
      const waitSeconds = Math.ceil((60000 - elapsed) / 1000);
      throw new AppError(429, 'RateLimitExceeded', 'RATE_LIMIT_EXCEEDED', `Please wait ${waitSeconds}s before requesting a new OTP`);
    }
  }

  const otp = (config.env === 'test' || config.env === 'development') ? '123456' : generateOtpCode();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  const challenge = await saveNewChallenge({
    identifier,
    otpHash,
    purpose: 'GUEST_LOOKUP',
    expiresAt,
  });

  // Attempt real email send if email was provided
  const targetEmail = email ? email.trim().toLowerCase() : (identifier.includes('@') ? identifier : null);
  if (targetEmail) {
    sendGuestOtpEmail(targetEmail, otp).catch((err) => {
      console.warn('Non-blocking: Failed to dispatch guest OTP email', err?.message);
    });
  }

  return {
    message: 'OTP sent successfully',
    challengeId: challenge._id.toString(),
    expiresIn: 300,
    otp: config.env !== 'production' ? otp : undefined,
    debugOtp: config.env !== 'production' ? otp : undefined,
  };
};

/**
 * Verify OTP for guest lookup and issue short-lived token
 */
export const verifyGuestOtp = async ({ phone, email, otp, challengeId }) => {
  if (!otp) {
    throw new AppError(400, 'ValidationError', ErrorCodes.VALIDATION_ERROR, 'OTP is required');
  }

  let challenge = null;
  if (challengeId && mongoose.Types.ObjectId.isValid(challengeId)) {
    challenge = await findActiveChallenge({ _id: challengeId, purpose: 'GUEST_LOOKUP' });
  }

  if (!challenge && (phone || email)) {
    const identifier = (phone || email).trim().toLowerCase();
    challenge = await findActiveChallenge({ identifier, purpose: 'GUEST_LOOKUP' });
  }

  if (!challenge) {
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'No OTP request found for this contact. Please request a new OTP.');
  }

  if (new Date() > challenge.expiresAt) {
    await removeChallenge(challenge._id);
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'OTP has expired. Please request a new one.');
  }

  challenge.attemptCount = (challenge.attemptCount || 0) + 1;
  if (challenge.attemptCount > 5) {
    await removeChallenge(challenge._id);
    throw new AppError(429, 'TooManyRequests', 'RATE_LIMIT_EXCEEDED', 'Too many failed attempts. Please request a new OTP.');
  }

  const isValid = verifyOtp(otp.trim(), challenge.otpHash);
  if (!isValid) {
    await challenge.save();
    throw new AppError(401, 'Unauthorized', ErrorCodes.AUTHENTICATION_ERROR, 'Invalid OTP code.');
  }

  // Clear challenge on success
  await removeChallenge(challenge._id);

  // Record audit log
  recordAuditLog({
    action: 'OTP_VERIFIED',
    target: { type: 'OtpChallenge', id: challenge._id },
    metadata: { identifier: challenge.identifier, purpose: 'GUEST_LOOKUP' },
  }).catch(() => {});

  // Find or create GuestContact
  const rawContact = phone || email || challenge.identifier;
  const isEmail = rawContact.includes('@');
  const contactPhone = phone ? phone.trim() : (!isEmail ? rawContact.trim() : undefined);
  const contactEmail = email ? email.trim().toLowerCase() : (isEmail ? rawContact.trim().toLowerCase() : undefined);

  const query = contactPhone ? { phone: contactPhone } : { email: contactEmail };
  let guest = await GuestContact.findOne(query);

  if (!guest) {
    guest = new GuestContact({
      fullName: contactPhone || contactEmail,
      phone: contactPhone,
      email: contactEmail,
      activationStatus: 'NO_ACCOUNT',
    });
  }

  if (contactPhone) guest.phoneVerifiedAt = new Date();
  if (contactEmail) guest.emailVerifiedAt = new Date();
  await guest.save();

  // Sign a guest lookup token (valid 15 mins)
  const tokenPayload = {
    guestContactId: guest._id.toString(),
    phone: guest.phone,
    email: guest.email,
    phoneVerified: !!guest.phoneVerifiedAt,
    emailVerified: !!guest.emailVerifiedAt,
    isGuest: true,
  };

  const token = jwt.sign(tokenPayload, config.jwt.accessSecret, { expiresIn: '15m' });

  return {
    lookupToken: token,
    token, // backward compatibility
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

  // Send email if contact email exists
  if (guest.email) {
    sendActivationInviteEmail(guest.email, activationToken, guest.fullName).catch((err) => {
      console.warn('Non-blocking: Failed to dispatch activation invite email', err?.message);
    });
  }

  const responseData = {
    success: true,
    message: 'Activation invite sent successfully',
    activationStatus: guest.activationStatus,
    expiresAt: guest.activationExpiresAt,
  };

  // P0-03: Never expose raw activationToken in production. Retained in test/dev for integration verification
  if (process.env.NODE_ENV !== 'production') {
    responseData.token = activationToken;
  }

  return responseData;
};

/**
 * Complete activation, create User + Customer, link all transactions
 * Strict rule: only link guest transactions after phone/email has been verified
 */
export const completeActivation = async ({ token, otp, password, acceptTerms, fullName }) => {
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

  // Link transactions only after phone/email has been verified
  const orderOrConditions = [{ guestContactId: guest._id }];
  const appointmentOrConditions = [{ guestContactId: guest._id }];

  // Verified contact linking
  const isPhoneVerified = !!guest.phoneVerifiedAt;
  const isEmailVerified = !!guest.emailVerifiedAt || !!guest.activationToken; // Token sent to email proves ownership

  if (isPhoneVerified && guest.phone) {
    orderOrConditions.push({ 'contactSnapshot.phone': guest.phone });
    appointmentOrConditions.push({ 'contactSnapshot.phone': guest.phone });
  }

  if (isEmailVerified && guest.email) {
    orderOrConditions.push({ 'contactSnapshot.email': guest.email });
    appointmentOrConditions.push({ 'contactSnapshot.email': guest.email });
  }

  // Discover activity branches from all matching orders & appointments
  const [matchingOrders, matchingAppointments] = await Promise.all([
    Order.find({ $or: orderOrConditions }).select('fulfillmentBranchId'),
    Appointment.find({ $or: appointmentOrConditions }).select('branchId'),
  ]);

  const branchSet = new Set();
  matchingOrders.forEach((o) => {
    if (o.fulfillmentBranchId) branchSet.add(o.fulfillmentBranchId.toString());
  });
  matchingAppointments.forEach((a) => {
    if (a.branchId) branchSet.add(a.branchId.toString());
  });
  const activityBranchIds = Array.from(branchSet).map((b) => new mongoose.Types.ObjectId(b));

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
      phoneVerifiedAt: isPhoneVerified ? (guest.phoneVerifiedAt || new Date()) : null,
      emailVerifiedAt: isEmailVerified ? (guest.emailVerifiedAt || new Date()) : null,
      activityBranchIds,
    });
    await newCustomer.save({ session });

    // Link transactions to Customer (store User._id for consistency across authorization checks)
    await Promise.all([
      Order.updateMany(
        { $or: orderOrConditions },
        { $set: { customerId: newUser._id } },
        { session }
      ),
      Appointment.updateMany(
        { $or: appointmentOrConditions },
        { $set: { customerId: newUser._id } },
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

    // Record central audit log
    recordAuditLog({
      actor: { userId: newUser._id, systemRole: 'CUSTOMER' },
      action: 'ACCOUNT_ACTIVATED',
      target: { type: 'Customer', id: newCustomer._id },
      metadata: {
        source: 'GUEST_ACTIVATION',
        linkedOrdersCount: matchingOrders.length,
        linkedAppointmentsCount: matchingAppointments.length,
        activityBranchIdsCount: activityBranchIds.length,
      },
    }).catch(() => {});

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
