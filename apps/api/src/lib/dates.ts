import { addDays, addMonths, differenceInCalendarDays, startOfDay } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export { formatInTimeZone, fromZonedTime, toZonedTime };

/**
 * All date math is done against a calendar day in the ASSESSMENT's time zone,
 * not the server's. That keeps "days remaining" stable for a user travelling
 * or for a server running in UTC.
 */
export const startOfDayInZone = (instant: Date, timeZone: string): Date => {
  const zoned = toZonedTime(instant, timeZone);
  return fromZonedTime(startOfDay(zoned), timeZone);
};

export const todayInZone = (timeZone: string, now: Date = new Date()): Date =>
  startOfDayInZone(now, timeZone);

/**
 * Calendar-day difference (not elapsed hours) between two instants, evaluated
 * in `timeZone`. Positive means `target` is in the future.
 */
export const calendarDaysBetween = (from: Date, to: Date, timeZone: string): number =>
  differenceInCalendarDays(startOfDayInZone(to, timeZone), startOfDayInZone(from, timeZone));

export const daysUntil = (target: Date, timeZone: string, now: Date = new Date()): number =>
  calendarDaysBetween(now, target, timeZone);

export const addDaysInZone = (instant: Date, days: number, timeZone: string): Date => {
  const zoned = toZonedTime(instant, timeZone);
  return fromZonedTime(addDays(zoned, days), timeZone);
};

/** Same wall-clock time N calendar months later (clamped to month end), in the given zone. */
export const addMonthsInZone = (instant: Date, months: number, timeZone: string): Date => {
  const zoned = toZonedTime(instant, timeZone);
  return fromZonedTime(addMonths(zoned, months), timeZone);
};
