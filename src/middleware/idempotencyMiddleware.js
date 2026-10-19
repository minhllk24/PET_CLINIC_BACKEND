import crypto from 'crypto';
import IdempotencyKey from '../modules/audit/models/IdempotencyKey';
import AppError from '../utils/AppError';
import { ErrorCodes } from '../shared/errorCodes';

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
};

export const idempotency = (operationId = '', { required = false } = {}) => {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) {
      if (required) {
        return next(new AppError(
          400,
          'Validation Error',
          ErrorCodes.IDEMPOTENCY_KEY_REQUIRED,
          'Idempotency-Key header is required'
        ));
      }
      return next();
    }
    if (typeof key !== 'string' || key.length > 200) {
      return next(new AppError(400, 'Validation Error', ErrorCodes.VALIDATION_ERROR, 'Invalid Idempotency-Key header'));
    }

    try {
      const actorScope = req.actor ? req.actor.id.toString() : `GUEST:${req.ip}`;
      const requestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(canonicalize(req.body || {})))
        .digest('hex');
      const filter = { actorScope, operationId, key };

      const existing = await IdempotencyKey.findOne(filter);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          return next(new AppError(
            409,
            'Conflict',
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            'Idempotency key has already been used with a different request payload'
          ));
        }
        if (existing.status === 'COMPLETED' && existing.responseStatus) {
          return res.status(existing.responseStatus).json(existing.responseBody);
        }
        return next(new AppError(409, 'Conflict', ErrorCodes.IDEMPOTENCY_IN_PROGRESS, 'An operation with this idempotency key is already in progress'));
      }

      let reservation;
      try {
        reservation = await IdempotencyKey.findOneAndUpdate(
          filter,
          {
            $setOnInsert: {
              ...filter,
              requestHash,
              status: 'PROCESSING',
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          },
          { upsert: true, new: true, includeResultMetadata: true }
        );
      } catch (error) {
        if (error.code !== 11000) throw error;
        const raced = await IdempotencyKey.findOne(filter);
        if (raced && raced.requestHash !== requestHash) {
          throw new AppError(409, 'Conflict', ErrorCodes.IDEMPOTENCY_KEY_REUSED, 'Idempotency key has already been used with a different request payload');
        }
        throw new AppError(409, 'Conflict', ErrorCodes.IDEMPOTENCY_IN_PROGRESS, 'An operation with this idempotency key is already in progress');
      }

      if (reservation && reservation.lastErrorObject && reservation.lastErrorObject.updatedExisting) {
        const raced = reservation.value;
        if (raced && raced.requestHash !== requestHash) {
          return next(new AppError(409, 'Conflict', ErrorCodes.IDEMPOTENCY_KEY_REUSED, 'Idempotency key has already been used with a different request payload'));
        }
        return next(new AppError(409, 'Conflict', ErrorCodes.IDEMPOTENCY_IN_PROGRESS, 'An operation with this idempotency key is already in progress'));
      }

      const originalJson = res.json.bind(res);
      res.json = (body) => {
        const persistence = res.statusCode < 500
          ? IdempotencyKey.findOneAndUpdate(
            filter,
            {
              $set: {
                status: 'COMPLETED',
                responseStatus: res.statusCode,
                responseBody: body,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
              }
            }
          )
          : IdempotencyKey.deleteOne(filter);

        Promise.resolve(persistence)
          .catch(() => null)
          .finally(() => originalJson(body));
        return res;
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
