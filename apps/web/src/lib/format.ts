import { formatInTimeZone } from 'date-fns-tz';

/**
 * All display formatting takes the ASSESSMENT's time zone, not the browser's.
 * A user checking their plan while travelling still sees the dates they planned
 * against. Every call site passes the zone explicitly, so nothing silently falls
 * back to the machine's locale.
 */

export const formatDate = (iso: string | null, timeZone: string, pattern = 'd MMM yyyy'): string => {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), timeZone, pattern);
};

export const formatDateTime = (iso: string | null, timeZone: string): string => {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), timeZone, 'd MMM yyyy, HH:mm');
};

export const formatTime = (iso: string | null, timeZone: string): string => {
  if (!iso) return '—';
  return formatInTimeZone(new Date(iso), timeZone, 'HH:mm');
};

/** Turns minutes into a compact human duration: 90 -> "1h 30m". */
export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
};

export const formatPercent = (value: number | null | undefined, digits = 1): string => {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(digits)}%`;
};

/**
 * Days remaining, phrased the way a student reads it. Negative values are shown
 * as "N days ago" rather than as a negative number.
 */
export const formatDaysRemaining = (days: number | null): string => {
  if (days === null) return 'No exam date set';
  if (days === 0) return 'Exam is today';
  if (days === 1) return '1 day to go';
  if (days === -1) return 'Exam was yesterday';
  if (days < 0) return `Exam was ${Math.abs(days)} days ago`;
  return `${days} days to go`;
};

/** Converts an ISO instant to the value a datetime-local input expects. */
export const toDateTimeLocalValue = (iso: string | null, timeZone: string): string => {
  if (!iso) return '';
  return formatInTimeZone(new Date(iso), timeZone, "yyyy-MM-dd'T'HH:mm");
};

export const toDateInputValue = (iso: string | null, timeZone: string): string => {
  if (!iso) return '';
  return formatInTimeZone(new Date(iso), timeZone, 'yyyy-MM-dd');
};

/** Offset of a zone from UTC at a given instant, in minutes. */
export const zoneOffsetMinutes = (instant: Date, timeZone: string): number => {
  const formatted = formatInTimeZone(instant, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
  const asUtc = Date.parse(`${formatted}Z`);
  return (asUtc - instant.getTime()) / 60_000;
};

/**
 * Interprets a datetime-local value as a wall-clock time in the given zone and
 * returns the corresponding instant. This is the inverse of the formatter above,
 * and it is why a reminder set for 09:00 stays 09:00 across a DST shift.
 */
export const fromZonedInputValue = (value: string, timeZone: string): string | null => {
  if (!value) return null;
  const [datePart, timePart = '00:00'] = value.split('T');
  if (!datePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if (!year || !month || !day) return null;

  // Build the wall-clock fields as if they were UTC, then ask what instant that
  // wall clock corresponds to in the target zone.
  const asUtc = Date.UTC(year, month - 1, day, hour ?? 0, minute ?? 0, 0, 0);
  const offset = zoneOffsetMinutes(new Date(asUtc), timeZone);
  return new Date(asUtc - offset * 60_000).toISOString();
};

export const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

/** Relative label for a due date, used in list rows. */
export const dueLabel = (days: number | null): string => {
  if (days === null) return 'No due date';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
};
