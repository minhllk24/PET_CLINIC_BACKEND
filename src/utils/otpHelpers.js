import Jwt from 'jsonwebtoken';
require('dotenv').config();

export const generateOtpCode = () => {
  // Generate a 6-digit random code
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generateResetToken = (payload) => {
  // Expires in 5 minutes to match the flow
  return Jwt.sign(payload, process.env.JWT_ACCESS_TOKEN_SECRET, { expiresIn: '5m' });
};

export const verifyResetToken = (token) => {
  try {
    const decoded = Jwt.verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    if (decoded.purpose !== 'reset_password') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};
