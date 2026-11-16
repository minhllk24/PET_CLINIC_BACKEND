import mongoose from 'mongoose';
import { formatVnDate } from '../modules/dashboard/dashboard.utils';

/**
 * Return compact YYYYMMDD string in Asia/Ho_Chi_Minh (+07:00) timezone.
 */
export const formatCompactVnDate = (date = new Date()) =>
  formatVnDate(new Date(date)).replace(/-/g, '');

/**
 * Generate a clean, standardized sequential document code (`PREFIX-YYYYMMDD-XXXX`)
 * in Asia/Ho_Chi_Minh (+07:00) timezone without embedding statuses or test tags.
 */
export const generateUniqueDocumentCode = async (
  Model,
  prefix,
  { session = null, date = new Date() } = {}
) => {
  const cleanPrefix = String(prefix || 'DOC').trim().toUpperCase();
  const ymd = formatCompactVnDate(date);
  const fullPrefix = `${cleanPrefix}-${ymd}-`;

  if (Model && (mongoose.connection.readyState === 1 || Model.findOne?._isMockFunction)) {
    try {
      const latestDoc = await Model.findOne({ code: new RegExp(`^${fullPrefix}\\d{4}$`) })
        .session(session || undefined)
        .sort({ code: -1 })
        .select('code')
        .lean();

      let seq = 1;
      if (latestDoc?.code) {
        const parts = latestDoc.code.split('-');
        const num = parseInt(parts[2], 10);
        if (!Number.isNaN(num)) {
          seq = num + 1;
        }
      }

      for (let i = 0; i < 50; i += 1) {
        const candidate = `${fullPrefix}${String(seq + i).padStart(4, '0')}`;
        const exists = await Model.findOne({ code: candidate })
          .session(session || undefined)
          .select('_id')
          .lean();
        if (!exists) {
          return candidate;
        }
      }
    } catch {
      // Fallback to bounded 4-digit random code in the same canonical format
    }
  }

  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${fullPrefix}${String(rand)}`;
};

