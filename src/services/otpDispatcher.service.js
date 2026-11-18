import User from '../models/User.js';
import { sendSmsBrandname, normalizePhoneNumber } from './smsBrandname.service.js';
import { sendOtpEmail } from '../utils/emailHelpers.js';
import mongoose from 'mongoose';

/**
 * Mask phone number for display: 0987654321 -> 098***4321
 */
export const maskPhone = (rawPhone = '') => {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits || digits.length < 7) return rawPhone;
  return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
};

/**
 * Mask email for display: thainamnguyen444@gmail.com -> th***44@gmail.com
 */
export const maskEmail = (rawEmail = '') => {
  const email = String(rawEmail || '').trim();
  if (!email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 3) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-2)}@${domain}`;
};

/**
 * Dispatch OTP across dual channels: SMS BrandName (DRPETSHOUSE) + Email OTP
 */
export const dispatchDualChannelOtp = async ({
  identifier = '',
  phone = '',
  email = '',
  otp = '',
  purpose = 'OTP_VERIFICATION',
  fullName = '',
} = {}) => {
  let targetPhone = phone ? String(phone).trim() : '';
  let targetEmail = email ? String(email).trim().toLowerCase() : '';

  // Infer from identifier if not explicitly split
  const cleanId = String(identifier || '').trim();
  if (cleanId) {
    if (cleanId.includes('@')) {
      if (!targetEmail) targetEmail = cleanId.toLowerCase();
    } else {
      if (!targetPhone) targetPhone = cleanId;
    }
  }

  // Cross-reference DB to find paired contact info if one is missing
  if (mongoose.connection.readyState === 1) {
    try {
      if (!targetEmail && targetPhone) {
        const { local } = normalizePhoneNumber(targetPhone);
        const existingUser = await User.findOne({
          $or: [{ phone: targetPhone }, { phone: local }],
        }).lean();
        if (existingUser?.email) {
          targetEmail = existingUser.email.toLowerCase();
          if (!fullName && existingUser.fullName) fullName = existingUser.fullName;
        }
      } else if (!targetPhone && targetEmail) {
        const existingUser = await User.findOne({ email: targetEmail }).lean();
        if (existingUser?.phone) {
          targetPhone = existingUser.phone;
          if (!fullName && existingUser.fullName) fullName = existingUser.fullName;
        }
      }
    } catch (err) {
      console.warn('[OTP DISPATCHER] Cross-reference lookup warning:', err.message);
    }
  }

  const dispatchedChannels = [];
  let smsResult = null;
  let emailSent = false;

  // 1. Dispatch SMS BrandName (DRPETSHOUSE) if phone available
  if (targetPhone) {
    try {
      smsResult = await sendSmsBrandname({
        phone: targetPhone,
        otp,
        purpose,
      });
      if (smsResult?.success) {
        dispatchedChannels.push('SMS_BRANDNAME');
      }
    } catch (smsErr) {
      console.error('[OTP DISPATCHER] SMS BrandName dispatch error:', smsErr.message);
    }
  }

  // 2. Dispatch Email OTP with Dr. Pet's House branding if email available
  if (targetEmail) {
    try {
      emailSent = await sendOtpEmail(targetEmail, otp, purpose, fullName);
      if (emailSent) {
        dispatchedChannels.push('EMAIL');
      }
    } catch (mailErr) {
      console.warn('[OTP DISPATCHER] Email dispatch warning:', mailErr.message);
    }
  }

  return {
    success: dispatchedChannels.length > 0 || Boolean(smsResult),
    brandName: smsResult?.brandName || 'DRPETSHOUSE',
    channels: dispatchedChannels,
    sentTo: {
      phone: targetPhone ? maskPhone(targetPhone) : null,
      rawPhone: targetPhone || null,
      email: targetEmail ? maskEmail(targetEmail) : null,
      rawEmail: targetEmail || null,
    },
    smsStatus: smsResult?.status || (targetPhone ? 'SENT' : 'SKIPPED'),
    emailStatus: emailSent ? 'SENT' : (targetEmail ? 'FAILED' : 'SKIPPED'),
    debugOtp: otp,
  };
};

export default {
  dispatchDualChannelOtp,
  maskPhone,
  maskEmail,
};
