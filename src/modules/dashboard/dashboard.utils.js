import AppError from '../../utils/AppError.js';

export const DASHBOARD_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const VN_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const MAX_DASHBOARD_RANGE_DAYS = 366;

export const ORDER_STATUS_CATALOG = [
  { code: 'PENDING', label: 'Chờ xác nhận', tone: 'amber', group: 'ACTIVE' },
  { code: 'CONFIRMED', label: 'Đã xác nhận', tone: 'blue', group: 'ACTIVE' },
  { code: 'PROCESSING', label: 'Đang xử lý', tone: 'indigo', group: 'ACTIVE' },
  { code: 'SHIPPED', label: 'Đang giao', tone: 'teal', group: 'IN_TRANSIT' },
  { code: 'COMPLETED', label: 'Hoàn thành', tone: 'green', group: 'TERMINAL_SUCCESS' },
  { code: 'CANCELLED', label: 'Đã hủy', tone: 'red', group: 'TERMINAL_CANCELLED' },
];

export const APPOINTMENT_STATUS_CATALOG = [
  { code: 'PENDING_PAYMENT', label: 'Chờ thanh toán', tone: 'amber', group: 'ACTIVE' },
  { code: 'PENDING_CONFIRMATION', label: 'Chờ xác nhận', tone: 'amber', group: 'ACTIVE' },
  { code: 'CONFIRMED', label: 'Đã xác nhận', tone: 'blue', group: 'ACTIVE' },
  { code: 'IN_PROGRESS', label: 'Đang thực hiện', tone: 'indigo', group: 'ACTIVE' },
  { code: 'COMPLETED', label: 'Hoàn tất', tone: 'green', group: 'TERMINAL_SUCCESS' },
  { code: 'CANCELLED', label: 'Đã hủy', tone: 'red', group: 'TERMINAL_CANCELLED' },
  { code: 'NO_SHOW', label: 'Vắng mặt', tone: 'slate', group: 'TERMINAL_CANCELLED' },
];

export const PAYMENT_STATUS_CATALOG = [
  { code: 'PENDING', label: 'Chờ thanh toán', scope: 'TRANSACTION' },
  { code: 'PAID', label: 'Đã thanh toán', scope: 'TRANSACTION' },
  { code: 'FAILED', label: 'Thanh toán thất bại', scope: 'TRANSACTION' },
  { code: 'CANCELLED', label: 'Đã hủy giao dịch', scope: 'TRANSACTION' },
  { code: 'EXPIRED', label: 'Hết hạn thanh toán', scope: 'TRANSACTION' },
  { code: 'REFUND_PENDING', label: 'Chờ hoàn tiền', scope: 'REFUND' },
  { code: 'REFUNDED', label: 'Đã hoàn tiền', scope: 'REFUND' },
];

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SUPPORTED_PRESETS = new Set(['today', '7d', '30d', 'this_week', 'this_month', 'this_year']);

export const formatVnDate = (date = new Date()) =>
  new Date(date.getTime() + VN_UTC_OFFSET_MS).toISOString().slice(0, 10);

export const parseStrictVnDate = (ymd, fieldName = 'date') => {
  if (typeof ymd !== 'string' || !YMD_REGEX.test(ymd.trim())) {
    throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', `${fieldName} must be in YYYY-MM-DD format`);
  }
  const clean = ymd.trim();
  const [y, m, d] = clean.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', `${fieldName} is not a valid calendar date`);
  }
  return clean;
};

export const shiftVnDate = (ymd, deltaDays) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
};

export const vnDateDiffInclusive = (fromYmd, toYmd) =>
  Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / MS_PER_DAY) + 1;

export const toUtcStartOfVnDay = (ymd) => new Date(`${ymd}T00:00:00.000+07:00`);

export const toUtcExclusiveEndOfVnDay = (ymd) => new Date(toUtcStartOfVnDay(ymd).getTime() + MS_PER_DAY);

export const determineGranularity = (days) => {
  if (days <= 1) return 'hour';
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
};

export const resolveVnDateRange = ({ from, to, preset, timezone, now = new Date() } = {}) => {
  if (timezone && timezone !== DASHBOARD_TIMEZONE) {
    throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', `Unsupported timezone: ${timezone}. Only ${DASHBOARD_TIMEZONE} is supported`);
  }

  const hasFrom = from !== undefined && from !== null && String(from).trim() !== '';
  const hasTo = to !== undefined && to !== null && String(to).trim() !== '';

  if (hasFrom !== hasTo) {
    throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', 'Both from and to query parameters must be provided together');
  }

  let fromStr;
  let toStr;

  if (hasFrom && hasTo) {
    fromStr = parseStrictVnDate(String(from), 'from');
    toStr = parseStrictVnDate(String(to), 'to');
    if (fromStr > toStr) {
      throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', 'from date must be before or equal to to date');
    }
  } else {
    const cleanPreset = preset ? String(preset).trim() : '30d';
    if (!SUPPORTED_PRESETS.has(cleanPreset)) {
      throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', `Unsupported preset: ${cleanPreset}`);
    }
    const todayStr = formatVnDate(now);
    toStr = todayStr;
    if (cleanPreset === 'today') {
      fromStr = todayStr;
    } else if (cleanPreset === '7d') {
      fromStr = shiftVnDate(todayStr, -6);
    } else if (cleanPreset === '30d') {
      fromStr = shiftVnDate(todayStr, -29);
    } else if (cleanPreset === 'this_week') {
      const vnDayIndex = new Date(Date.parse(`${todayStr}T00:00:00Z`)).getUTCDay(); // 0=Sun..6=Sat
      const daysSinceMonday = vnDayIndex === 0 ? 6 : vnDayIndex - 1;
      fromStr = shiftVnDate(todayStr, -daysSinceMonday);
    } else if (cleanPreset === 'this_month') {
      fromStr = `${todayStr.slice(0, 8)}01`;
    } else if (cleanPreset === 'this_year') {
      fromStr = `${todayStr.slice(0, 5)}01-01`;
    }
  }

  const days = vnDateDiffInclusive(fromStr, toStr);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DASHBOARD_RANGE_DAYS) {
    throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', `Date range must be between 1 and ${MAX_DASHBOARD_RANGE_DAYS} days`);
  }

  const startUtc = toUtcStartOfVnDay(fromStr);
  const endExclusiveUtc = toUtcExclusiveEndOfVnDay(toStr);

  const previousTo = shiftVnDate(fromStr, -1);
  const previousFrom = shiftVnDate(previousTo, -(days - 1));
  const prevStartUtc = toUtcStartOfVnDay(previousFrom);
  const prevEndExclusiveUtc = startUtc;

  return {
    from: fromStr,
    to: toStr,
    previousFrom,
    previousTo,
    days,
    granularity: determineGranularity(days),
    timezone: DASHBOARD_TIMEZONE,
    startUtc,
    endExclusiveUtc,
    prevStartUtc,
    prevEndExclusiveUtc,
  };
};

export const generateBucketKeys = (fromStr, toStr, granularity) => {
  const keys = [];
  if (granularity === 'hour') {
    for (let h = 0; h < 24; h++) {
      keys.push(`${fromStr}T${String(h).padStart(2, '0')}:00:00+07:00`);
    }
    return keys;
  }

  const days = vnDateDiffInclusive(fromStr, toStr);
  if (granularity === 'day') {
    for (let i = 0; i < days; i++) {
      keys.push(shiftVnDate(fromStr, i));
    }
    return keys;
  }

  if (granularity === 'week') {
    for (let i = 0; i < days; i += 7) {
      keys.push(shiftVnDate(fromStr, i));
    }
    return keys;
  }

  // Month granularity
  const seen = new Set();
  for (let i = 0; i < days; i++) {
    const monthKey = `${shiftVnDate(fromStr, i).slice(0, 7)}-01`;
    if (!seen.has(monthKey)) {
      seen.add(monthKey);
      keys.push(monthKey);
    }
  }
  return keys;
};

export const mapRawTimeKeyToBucket = (rawKey, fromStr, granularity) => {
  if (!rawKey) return null;
  if (granularity === 'hour' || granularity === 'day') {
    return rawKey;
  }
  if (granularity === 'month') {
    return `${rawKey.slice(0, 7)}-01`;
  }
  // week granularity: rawKey is YYYY-MM-DD in VN calendar
  const dayOffset = vnDateDiffInclusive(fromStr, rawKey) - 1;
  if (dayOffset < 0) return fromStr;
  return shiftVnDate(fromStr, Math.floor(dayOffset / 7) * 7);
};

export const computeKpiComparison = (current, previous) => {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  const delta = cur - prev;
  const changePercent = prev > 0 ? Number(((delta / prev) * 100).toFixed(2)) : null;
  return { current: cur, previous: prev, delta, changePercent };
};

export const normalizeNonNegativeZero = (value) => (Object.is(value, -0) || value === 0 ? 0 : value);

/**
 * Parses optional date bounds for list clickthrough filtering (/orders, /appointments).
 * Calendar YYYY-MM-DD strings use VN (+07:00) half-open bounds [start, nextDayStart).
 */
export const buildOptionalVnDateFilter = (rawFrom, rawTo) => {
  const hasFrom = rawFrom !== undefined && rawFrom !== null && String(rawFrom).trim() !== '';
  const hasTo = rawTo !== undefined && rawTo !== null && String(rawTo).trim() !== '';
  if (!hasFrom && !hasTo) return null;

  const range = {};
  if (hasFrom) {
    const s = String(rawFrom).trim();
    if (YMD_REGEX.test(s)) {
      range.$gte = toUtcStartOfVnDay(parseStrictVnDate(s, 'from'));
    } else {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) {
        throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', 'Invalid start date format');
      }
      range.$gte = d;
    }
  }

  if (hasTo) {
    const s = String(rawTo).trim();
    if (YMD_REGEX.test(s)) {
      range.$lt = toUtcExclusiveEndOfVnDay(parseStrictVnDate(s, 'to'));
    } else {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) {
        throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', 'Invalid end date format');
      }
      range.$lte = d;
    }
  }

  return range;
};
