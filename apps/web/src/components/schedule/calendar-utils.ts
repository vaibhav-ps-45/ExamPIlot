/**
 * Calendar maths on plain "yyyy-MM-dd" keys, done in UTC so the browser's own
 * time zone can never shift a day. Which instant a key means is decided by the
 * caller, using the assessment's zone.
 */

export interface DayCell {
  key: string;
  inMonth: boolean;
}

const pad = (value: number): string => String(value).padStart(2, '0');

export const toKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** Six Monday-first weeks covering the month, so the grid never changes height. */
export const monthGrid = (year: number, month0: number): DayCell[] => {
  const first = new Date(Date.UTC(year, month0, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(Date.UTC(year, month0, 1 - offset + index));
    return { key: toKey(date), inMonth: date.getUTCMonth() === month0 };
  });
};

export const shiftMonth = (year: number, month0: number, delta: number): { year: number; month0: number } => {
  const date = new Date(Date.UTC(year, month0 + delta, 1));
  return { year: date.getUTCFullYear(), month0: date.getUTCMonth() };
};

export const monthLabel = (year: number, month0: number): string =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month0, 1)));

export const parseKey = (key: string): { year: number; month0: number; day: number } => {
  const [year, month, day] = key.split('-').map(Number);
  return { year: year ?? 1970, month0: (month ?? 1) - 1, day: day ?? 1 };
};

export const dayLabel = (key: string): string => {
  const { year, month0, day } = parseKey(key);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month0, day)),
  );
};

/** Groups items by the day key produced by `keyOf`, keeping their input order. */
export const groupByDay = <T>(items: T[], keyOf: (item: T) => string | null): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
};
