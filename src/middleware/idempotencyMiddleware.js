import crypto from 'crypto';
import IdempotencyKey from '../modules/audit/models/IdempotencyKey';
import AppError from '../utils/AppError';
import { ErrorCodes } from '../shared/errorCodes';

export const idempotency = (operationId = '') => {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) {
      return next();
    }

    try {
      const actorScope = req.actor ? req.actor.id.toString() : 'GLOBAL';
      const bodyString = JSON.stringify(req.body || {});
      const requestHash = crypto.createHash('sha256').update(bodyString).digest('hex');

      const existing = await IdempotencyKey.findOne({ actorScope, key });

      if (existing) {
        if (existing.requestHash !== requestHash) {
          return next(
            new AppError(
              409,
              'Conflict',
              ErrorCodes.IDEMPOTENCY_KEY_REUSED || 'IDEMPOTENCY_KEY_REUSED',
              'Idempotency key has already been used with a different request payload'
            )
          );
        }

        // Return cached response
        if (existing.responseStatus) {
          return res.status(existing.responseStatus).json(existing.responseBody);
        }
      }

      // Intercept res.json to capture response
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Asynchronously save response cache
        if (res.statusCode >= 200 && res.statusCode < 500) {
          IdempotencyKey.findOneAndUpdate(
            { actorScope, key },
            {
              actorScope,
              key,
              operationId,
              requestHash,
              responseStatus: res.statusCode,
              responseBody: body,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            },
            { upsert: true, new: true }
          ).catch((err) => {
            // Ignore background save errors to not break response
            console.error('Failed to save idempotency key cache:', err.message);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};
