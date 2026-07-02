export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function parseDisplayDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/** `YYYY-MM-DD HH:mm` in Vietnam time — used in default test run names. */
export function formatRunNameTimestamp(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** `YYYY-MM-DD HH:mm:ss` in Vietnam time for UI timestamps. */
export function formatVietnamDateTime(value: unknown, fallback = '-'): string {
  const date = parseDisplayDate(value);
  if (!date) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    return String(value);
  }

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

/** `YYYY-MM-DD` in Vietnam time. */
export function formatVietnamDate(value: unknown, fallback = '-'): string {
  const date = parseDisplayDate(value);
  if (!date) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    return String(value);
  }

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Short localized date label in Vietnam time, e.g. `01 thg 7, 2026`. */
export function formatVietnamDateLabel(value: unknown, fallback = '-'): string {
  const date = parseDisplayDate(value);
  if (!date) {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    return String(value);
  }

  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Calendar day key `YYYY-MM-DD` in Vietnam time — for charts and grouping. */
export function toVietnamDateKey(value: unknown): string | null {
  const date = parseDisplayDate(value);
  if (!date) {
    return null;
  }

  return formatVietnamDate(date);
}

/** Shift a `YYYY-MM-DD` key by calendar days (interpreted at UTC noon to avoid DST edge cases). */
export function shiftVietnamDateKey(dateKey: string, deltaDays: number): string {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
  return formatVietnamDate(shifted);
}
