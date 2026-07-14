import { serializeBigInt } from './prismaHelpers';

export const sendResponse = (res, statusCode, em, ec, dt = '') => {
  return res.status(statusCode).json({
    EM: em,
    EC: ec,
    DT: serializeBigInt(dt),
  });
};
