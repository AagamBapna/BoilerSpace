const RECURRENCE_TYPES = ['none', 'weekly', 'monthly'];
const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function normalizeDateInput(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  return str.slice(0, 10);
}

function toDateOnly(value) {
  const normalized = normalizeDateInput(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeRecurrence(input = {}) {
  const type = RECURRENCE_TYPES.includes(String(input.type || 'none')) ? String(input.type || 'none') : 'none';
  const intervalRaw = Number.parseInt(input.interval, 10);
  const interval = Number.isInteger(intervalRaw) && intervalRaw > 0 ? intervalRaw : 1;
  const endDate = normalizeDateInput(input.endDate);
  const recurrenceGroupId = input.recurrenceGroupId ? String(input.recurrenceGroupId) : null;
  const dayOfWeekRaw = input.dayOfWeek;
  let dayOfWeek = null;

  if (dayOfWeekRaw !== undefined && dayOfWeekRaw !== null && String(dayOfWeekRaw).trim() !== '') {
    const numericDay = Number.parseInt(dayOfWeekRaw, 10);
    if (Number.isInteger(numericDay) && numericDay >= 0 && numericDay <= 6) {
      dayOfWeek = numericDay;
    } else {
      const normalizedDay = String(dayOfWeekRaw).trim().toLowerCase();
      const dayIndex = WEEKDAY_NAMES.indexOf(normalizedDay);
      if (dayIndex >= 0) dayOfWeek = dayIndex;
    }
  }

  return {
    type,
    interval,
    endDate,
    recurrenceGroupId,
    dayOfWeek,
  };
}

function addRecurrenceInterval(date, type, interval) {
  const next = new Date(date.getTime());
  if (type === 'weekly') {
    next.setDate(next.getDate() + (7 * interval));
  } else if (type === 'monthly') {
    next.setMonth(next.getMonth() + interval);
  }
  return next;
}

function generateRecurringDates({ startDate, recurrence, maxInstances = 24 }) {
  const baseDate = toDateOnly(startDate);
  if (!baseDate) return [];

  const normalized = normalizeRecurrence(recurrence);
  if (normalized.type === 'none') {
    return [formatDateOnly(baseDate)];
  }

  const endDate = normalized.endDate ? toDateOnly(normalized.endDate) : null;
  const dates = [];
  let cursor = new Date(baseDate.getTime());
  let guard = 0;

  if (normalized.type === 'weekly') {
    const targetDayOfWeek = Number.isInteger(normalized.dayOfWeek) ? normalized.dayOfWeek : baseDate.getDay();
    const offset = (targetDayOfWeek - cursor.getDay() + 7) % 7;
    cursor.setDate(cursor.getDate() + offset);
  }

  while (guard < maxInstances) {
    if (endDate && cursor > endDate) {
      break;
    }
    dates.push(formatDateOnly(cursor));
    let next;
    if (normalized.type === 'weekly') {
      next = new Date(cursor.getTime());
      next.setDate(next.getDate() + 7 * normalized.interval);
    } else {
      next = addRecurrenceInterval(cursor, normalized.type, normalized.interval);
    }
    if (!next) {
      break;
    }
    cursor = next;
    guard += 1;
  }

  return dates;
}

function isRecurringSeries(event) {
  return Boolean(event?.recurrence?.type && event.recurrence.type !== 'none' && event.recurrence.recurrenceGroupId);
}

module.exports = {
  RECURRENCE_TYPES,
  normalizeDateInput,
  toDateOnly,
  formatDateOnly,
  normalizeRecurrence,
  generateRecurringDates,
  isRecurringSeries,
};