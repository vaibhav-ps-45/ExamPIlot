import { describe, expect, it } from 'vitest';
import { groupByDay, monthGrid, shiftMonth } from './calendar-utils';

describe('calendar utils', () => {
  it('builds six Monday-first weeks', () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ key: '2026-09-28', inMonth: false });
    expect(grid[3]).toEqual({ key: '2026-10-01', inMonth: true });
    expect(grid.filter((cell) => cell.inMonth)).toHaveLength(31);
    expect(grid[41]!.key).toBe('2026-11-08');
  });

  it('handles a month that starts on Monday and leap years', () => {
    const grid = monthGrid(2024, 1); // 1 Feb 2024 is a Thursday; 29 days
    expect(grid.filter((cell) => cell.inMonth)).toHaveLength(29);
    const june = monthGrid(2026, 5); // 1 Jun 2026 is a Monday
    expect(june[0]).toEqual({ key: '2026-06-01', inMonth: true });
  });

  it('shifts months across year boundaries', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month0: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month0: 11 });
  });

  it('groups by day and skips items with no day', () => {
    const grouped = groupByDay(
      [{ id: 1, d: '2026-10-01' }, { id: 2, d: null }, { id: 3, d: '2026-10-01' }],
      (item) => item.d,
    );
    expect([...grouped.keys()]).toEqual(['2026-10-01']);
    expect(grouped.get('2026-10-01')!.map((item) => item.id)).toEqual([1, 3]);
  });
});
