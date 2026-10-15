import type { Reminder, ReminderDelivery } from '@/lib/types';

/** A delivery older than this is history, not something to pop up now. */
export const FRESH_MS = 10 * 60 * 1000;

/** One notification per reminder occurrence, whichever tab or channel shows it. */
export const deliveryKey = (reminder: Reminder, delivery: ReminderDelivery): string =>
  `${reminder.id}|${delivery.scheduledFor}`;

export interface NewDelivery {
  key: string;
  reminder: Reminder;
  delivery: ReminderDelivery;
}

/**
 * Splits deliveries the user has not been shown yet into those worth showing
 * now (fresh) and everything unseen. Stale ones are only marked seen: a
 * reminder delivered hours ago while the app was closed is listed on the
 * Reminders page but never replayed as a pop-up.
 */
export const pickNewDeliveries = (
  reminders: Reminder[],
  seen: ReadonlySet<string>,
  now: number,
): { fresh: NewDelivery[]; unseenKeys: string[] } => {
  const fresh: NewDelivery[] = [];
  const unseenKeys: string[] = [];
  const counted = new Set<string>();

  for (const reminder of reminders) {
    for (const delivery of reminder.deliveries) {
      if (delivery.channel !== 'IN_APP' || delivery.status !== 'DELIVERED') continue;
      const key = deliveryKey(reminder, delivery);
      if (seen.has(key) || counted.has(key)) continue;
      counted.add(key);
      unseenKeys.push(key);
      const deliveredAt = delivery.deliveredAt ? Date.parse(delivery.deliveredAt) : NaN;
      if (Number.isFinite(deliveredAt) && now - deliveredAt <= FRESH_MS) {
        fresh.push({ key, reminder, delivery });
      }
    }
  }
  return { fresh, unseenKeys };
};
