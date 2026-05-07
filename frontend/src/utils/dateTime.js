export function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatDateParts(year, month, day) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatMonthParts(year, month) {
  return `${year}-${pad(month)}`;
}

export function formatTimeParts(hour, minute) {
  return `${pad(hour)}:${pad(minute)}`;
}

export function formatDisplayTime(value, format = '24h', locale = 'en-IN') {
  if (!value) {
    return '';
  }
  const parsed = parseTimeValue(value);
  if (format === '12h') {
    return new Date(2000, 0, 1, parsed.hour, parsed.minute).toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return formatTimeParts(parsed.hour, parsed.minute);
}

export function parseDateValue(value) {
  const now = new Date();
  const [yearRaw, monthRaw, dayRaw] = String(value || '').split('-');
  const year = Number(yearRaw) || now.getFullYear();
  const month = Number(monthRaw) || now.getMonth() + 1;
  const day = Number(dayRaw) || now.getDate();
  return { year, month, day };
}

export function parseMonthValue(value) {
  const now = new Date();
  const [yearRaw, monthRaw] = String(value || '').split('-');
  const year = Number(yearRaw) || now.getFullYear();
  const month = Number(monthRaw) || now.getMonth() + 1;
  return { year, month };
}

export function parseTimeValue(value) {
  const now = new Date();
  const [hourRaw, minuteRaw] = String(value || '').split(':');
  const hour = Number(hourRaw) >= 0 ? Number(hourRaw) : now.getHours();
  const minute = Number(minuteRaw) >= 0 ? Number(minuteRaw) : now.getMinutes();
  return { hour, minute };
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function toDateKey(date) {
  return formatDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function monthLabel(year, month, locale = 'en-IN') {
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}

export function formatDisplayDate(value, locale = 'en-IN') {
  if (!value) {
    return '';
  }
  const parsed = parseDateValue(value);
  return new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDisplayMonth(value, locale = 'en-IN') {
  if (!value) {
    return '';
  }
  const parsed = parseMonthValue(value);
  return monthLabel(parsed.year, parsed.month, locale);
}

export function compareIsoDate(left, right) {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return -1;
  }
  if (!right) {
    return 1;
  }
  return left.localeCompare(right);
}
