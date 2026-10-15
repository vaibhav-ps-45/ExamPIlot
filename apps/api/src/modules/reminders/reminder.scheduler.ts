import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import {
  expireMissedReminders,
  findDueReminders,
  markFired,
  occurrenceTimeFor,
  recordDelivery,
  type DueReminder,
} from './reminder.service.js';

/**
 * In-process reminder sweep.
 *
 * Guarantees, by design:
 * - it only DELIVERS reminders the user explicitly created and enabled;
 * - it never delivers late: a reminder whose time passed beyond the delivery
 *   window is marked MISSED (or, if recurring, skipped to its next occurrence)
 *   instead of being sent hours or days after the fact;
 * - it never creates a reminder, never creates a task, and never moves a date;
 * - a delivery is recorded under a unique (reminder, channel, occurrence) key,
 *   so a restart or a second instance cannot produce a duplicate notification.
 *
 * Limitation, stated plainly: an in-process timer only runs while the API
 * process is up. For reminders that must fire with the application closed, run
 * the API as a long-lived service (Docker/systemd) or call the sweep from an
 * external cron. Browser notifications additionally require the browser to be
 * open and permission granted.
 */
let timer: NodeJS.Timeout | null = null;
let running = false;

export const runSweep = async (
  now: Date = new Date(),
): Promise<{ delivered: number; skipped: number; missed: number }> => {
  if (running) return { delivered: 0, skipped: 0, missed: 0 };
  running = true;
  let delivered = 0;
  let skipped = 0;
  let missed = 0;

  try {
    // Expire first, so anything too old is never swept up as "due".
    missed = await expireMissedReminders(now);
    const due = await findDueReminders(now);

    for (const reminder of due) {
      const occurrence = occurrenceTimeFor(reminder);
      const first = await recordDelivery(reminder.id, reminder.userId, 'IN_APP', occurrence, 'DELIVERED');
      if (!first) {
        skipped += 1;
        continue;
      }
      // Browser channel is recorded as QUEUED-on-delivery-attempt: the browser
      // itself shows the notification when the user has granted permission.
      await recordDelivery(reminder.id, reminder.userId, 'BROWSER', occurrence, 'DELIVERED');
      await markFired(reminder, now);
      delivered += 1;
      logger.info('reminder delivered', { reminderId: reminder.id, userId: reminder.userId });
    }
  } catch (error) {
    logger.error('reminder sweep failed', { error: error instanceof Error ? error.message : String(error) });
  } finally {
    running = false;
  }

  return { delivered, skipped, missed };
};

export const startReminderScheduler = (): void => {
  if (timer) return;
  const intervalMs = env.REMINDER_SWEEP_INTERVAL_SECONDS * 1000;
  timer = setInterval(() => {
    void runSweep();
  }, intervalMs);
  timer.unref();
  // One immediate pass so a restart does not delay overdue reminders.
  void runSweep();
  logger.info('reminder scheduler started', { intervalSeconds: env.REMINDER_SWEEP_INTERVAL_SECONDS });
};

export const stopReminderScheduler = (): void => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};

export type { DueReminder };
