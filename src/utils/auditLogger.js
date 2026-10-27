import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog';
import { logger } from '../shared/logger';

/**
 * Record an audit log entry in MongoDB
 * @param {Object} params
 * @param {Object} [params.actor] - { userId, systemRole, ipAddress }
 * @param {string} params.action - AUDIT_ACTIONS enum value
 * @param {Object} [params.target] - { type, id }
 * @param {Object} [params.metadata] - Extra context
 * @param {string} [params.correlationId] - Correlation ID
 * @returns {Promise<Object|null>} Saved audit log or null if failed
 */
export const recordAuditLog = async ({
  actor = {},
  action,
  target = {},
  metadata = {},
  correlationId = null,
}) => {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }
  try {
    const entry = await AuditLog.create({
      actor: {
        userId: actor.userId || null,
        systemRole: actor.systemRole || 'ANONYMOUS',
        ipAddress: actor.ipAddress || '',
      },
      action,
      target: {
        type: target.type || null,
        id: target.id || null,
      },
      metadata,
      correlationId,
      createdAt: new Date(),
    });
    return entry;
  } catch (error) {
    logger.error({ err: error, action, correlationId }, 'Failed to record audit log entry');
    return null;
  }
};

export default {
  recordAuditLog,
};
