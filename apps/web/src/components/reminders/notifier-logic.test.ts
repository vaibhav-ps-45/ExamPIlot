import { describe, expect, it } from 'vitest';
import type { Reminder } from '@/lib/types';
import { deliveryKey, FRESH_MS, pickNewDeliveries } from './notifier-logic';

const NOW = Date.parse('2026-10-20T10:00:00.000Z');

const reminder = (id: string, deliveries: Reminder['deliveries']): Reminder => ({
  id,
  assessmentId: 'a',
  studyItemId: null,
  title: `Reminder ${id}`,
  message: null,
  remindAt: '2026-10-20T09:59:00.000Z',
  localDateTime: null,
  timeZone: 'UTC',
  advanceMinutes: null,
  recurrence: 'NONE',
  status: 'DELIVERED',
  enabled: true,
  snoozedUntil: null,
  dismissedAt: null,
  lastFiredAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  isMissed: false,
  deliveries,
});

const delivered = (scheduledFor: string, deliveredAt: string, channel: 'IN_APP' | 'BROWSER' = 'IN_APP') => ({
  channel,
  status: 'DELIVERED' as const,
  scheduledFor,
  deliveredAt,
});

describe('pickNewDeliveries', () => {
  it('shows a fresh delivery once and then treats it as seen', () => {
    const r = reminder('1', [delivered('2026-10-20T09:59:00.000Z', '2026-10-20T09:59:30.000Z')]);
    const first = pickNewDeliveries([r], new Set(), NOW);
    expect(first.fresh).toHaveLength(1);

    const second = pickNewDeliveries([r], new Set(first.unseenKeys), NOW);
    expect(second.fresh).toHaveLength(0);
    expect(second.unseenKeys).toHaveLength(0);
  });

  it('does not replay stale deliveries as pop-ups, but still marks them seen', () => {
    const r = reminder('1', [delivered('2026-10-19T09:00:00.000Z', new Date(NOW - FRESH_MS - 1000).toISOString())]);
    const result = pickNewDeliveries([r], new Set(), NOW);
    expect(result.fresh).toHaveLength(0);
    expect(result.unseenKeys).toEqual([deliveryKey(r, r.deliveries[0]!)]);
  });

  it('counts one occurrence once even though it has an in-app and a browser record', () => {
    const r = reminder('1', [
      delivered('2026-10-20T09:59:00.000Z', '2026-10-20T09:59:30.000Z', 'IN_APP'),
      delivered('2026-10-20T09:59:00.000Z', '2026-10-20T09:59:30.000Z', 'BROWSER'),
    ]);
    expect(pickNewDeliveries([r], new Set(), NOW).fresh).toHaveLength(1);
  });

  it('treats a snooze as a separate occurrence', () => {
    const r = reminder('1', [
      delivered('2026-10-20T09:50:00.000Z', '2026-10-20T09:50:10.000Z'),
      delivered('2026-10-20T09:58:00.000Z', '2026-10-20T09:58:10.000Z'),
    ]);
    expect(pickNewDeliveries([r], new Set(), NOW).fresh).toHaveLength(2);
  });

  it('ignores failed deliveries', () => {
    const r = reminder('1', [{ channel: 'IN_APP', status: 'FAILED', scheduledFor: '2026-10-20T09:59:00.000Z', deliveredAt: null }]);
    expect(pickNewDeliveries([r], new Set(), NOW).unseenKeys).toHaveLength(0);
  });
});
