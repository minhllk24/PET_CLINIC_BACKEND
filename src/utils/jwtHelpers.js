import Jwt from 'jsonwebtoken';
require('dotenv').config();

export const generateAccessToken = (payload) => {
  return Jwt.sign(payload, process.env.JWT_ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (payload) => {
  return Jwt.sign(payload, process.env.JWT_REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
};

export const refreshNewTokenService = (token) => {
  try {
    const { iat, exp, ...rest } = Jwt.verify(token, process.env.JWT_REFRESH_TOKEN_SECRET);
    return generateAccessToken(rest);
  } catch (error) {
    return null;
  }
};
