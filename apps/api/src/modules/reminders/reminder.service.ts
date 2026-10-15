import type { CreateReminderInput, ReminderActionInput, UpdateReminderInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { toSkipTake } from '../../lib/pagination.js';
import { addDaysInZone, addMonthsInZone, fromZonedTime, toZonedTime } from '../../lib/dates.js';
import { getAssessmentForUser } from '../assessments/assessment.service.js';
import { logger } from '../../lib/logger.js';

export interface ReminderView {
  id: string;
  assessmentId: string;
  studyItemId: string | null;
  title: string;
  message: string | null;
  remindAt: string;
  localDateTime: string | null;
  timeZone: string;
  advanceMinutes: number | null;
  recurrence: string;
  status: string;
  enabled: boolean;
  snoozedUntil: string | null;
  dismissedAt: string | null;
  lastFiredAt: string | null;
  createdAt: string;
  /** Derived: its notify time passed beyond the delivery window without being delivered. */
  isMissed: boolean;
  deliveries: Array<{ channel: string; status: string; scheduledFor: string; deliveredAt: string | null }>;
}

/**
 * How late a reminder may still be delivered. Past this it is MISSED: shown to
 * the user, never delivered late, never moved, never turned into a new reminder.
 */
export const MISSED_AFTER_MS = 30 * 60 * 1000;

export type ReminderRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface Schedulable {
  remindAt: Date;
  advanceMinutes: number | null;
  status: string;
  snoozedUntil: Date | null;
}

/**
 * The instant a reminder should actually notify. `remindAt` is the moment the
 * user cares about; an advance notice fires that many minutes earlier. A snooze
 * replaces the schedule until it ends, so it ignores the advance.
 */
export const notifyAtFor = (reminder: Schedulable): Date => {
  if (reminder.status === 'SNOOZED' && reminder.snoozedUntil) return reminder.snoozedUntil;
  return new Date(reminder.remindAt.getTime() - (reminder.advanceMinutes ?? 0) * 60_000);
};

/** FIRE: deliver now. WAIT: not yet. MISSED: too late to deliver. */
export const classifyReminder = (
  reminder: Schedulable,
  now: Date,
  missedAfterMs: number = MISSED_AFTER_MS,
): 'FIRE' | 'WAIT' | 'MISSED' => {
  const at = notifyAtFor(reminder).getTime();
  if (at > now.getTime()) return 'WAIT';
  return now.getTime() - at > missedAfterMs ? 'MISSED' : 'FIRE';
};

/** The occurrence a delivery is recorded against; a snooze is its own occurrence. */
export const occurrenceTimeFor = (reminder: Schedulable): Date =>
  reminder.status === 'SNOOZED' && reminder.snoozedUntil ? reminder.snoozedUntil : reminder.remindAt;

const stepRecurrence = (at: Date, recurrence: ReminderRecurrence, timeZone: string): Date => {
  switch (recurrence) {
    case 'DAILY':
      return addDaysInZone(at, 1, timeZone);
    case 'WEEKLY':
      return addDaysInZone(at, 7, timeZone);
    case 'MONTHLY':
      return addMonthsInZone(at, 1, timeZone);
    default:
      return at;
  }
};

/**
 * First occurrence of a recurring reminder whose notify time is still ahead of
 * (or within the delivery window of) `now`. Occurrences skipped in between are
 * not delivered: a restart after an outage must not burst stale notifications.
 */
export const nextOccurrence = (
  reminder: { remindAt: Date; advanceMinutes: number | null; recurrence: ReminderRecurrence; timeZone: string },
  now: Date,
  missedAfterMs: number = MISSED_AFTER_MS,
): Date => {
  let next = stepRecurrence(reminder.remindAt, reminder.recurrence, reminder.timeZone);
  for (let guard = 0; guard < 5000; guard += 1) {
    const notifyAt = next.getTime() - (reminder.advanceMinutes ?? 0) * 60_000;
    if (notifyAt >= now.getTime() - missedAfterMs && next.getTime() > reminder.remindAt.getTime()) return next;
    const after = stepRecurrence(next, reminder.recurrence, reminder.timeZone);
    if (after.getTime() <= next.getTime()) return next;
    next = after;
  }
  return next;
};

const REMINDER_SELECT = {
  id: true,
  assessmentId: true,
  studyItemId: true,
  title: true,
  message: true,
  remindAt: true,
  localDateTime: true,
  timeZone: true,
  advanceMinutes: true,
  recurrence: true,
  status: true,
  enabled: true,
  snoozedUntil: true,
  dismissedAt: true,
  lastFiredAt: true,
  createdAt: true,
  deliveries: {
    select: { channel: true, status: true, scheduledFor: true, deliveredAt: true },
    orderBy: { scheduledFor: 'desc' as const },
    take: 5,
  },
} as const;

const toView = (
  row: {
    id: string;
    assessmentId: string;
    studyItemId: string | null;
    title: string;
    message: string | null;
    remindAt: Date;
    localDateTime: Date | null;
    timeZone: string;
    advanceMinutes: number | null;
    recurrence: string;
    status: string;
    enabled: boolean;
    snoozedUntil: Date | null;
    dismissedAt: Date | null;
    lastFiredAt: Date | null;
    createdAt: Date;
    deliveries: Array<{ channel: string; status: string; scheduledFor: Date; deliveredAt: Date | null }>;
  },
  now: Date = new Date(),
): ReminderView => ({
  id: row.id,
  assessmentId: row.assessmentId,
  studyItemId: row.studyItemId,
  title: row.title,
  message: row.message,
  remindAt: row.remindAt.toISOString(),
  localDateTime: row.localDateTime?.toISOString() ?? null,
  timeZone: row.timeZone,
  advanceMinutes: row.advanceMinutes,
  recurrence: row.recurrence,
  status: row.status,
  enabled: row.enabled,
  snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
  dismissedAt: row.dismissedAt?.toISOString() ?? null,
  lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  // Display only. A missed reminder is NEVER auto-rescheduled or duplicated.
  isMissed:
    row.status === 'MISSED' ||
    (row.enabled &&
      (row.status === 'PENDING' || row.status === 'SNOOZED') &&
      !row.dismissedAt &&
      classifyReminder(
        {
          remindAt: row.remindAt,
          advanceMinutes: row.advanceMinutes,
          status: row.status,
          snoozedUntil: row.snoozedUntil,
        },
        now,
      ) === 'MISSED'),
  deliveries: row.deliveries.map((delivery) => ({
    channel: delivery.channel,
    status: delivery.status,
    scheduledFor: delivery.scheduledFor.toISOString(),
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
  })),
});

/**
 * Resolves the absolute instant a reminder should fire.
 *
 * If `remindAt` is given it is used as-is (an absolute instant). If only a
 * wall-clock `localDateTime` is given, it is interpreted in the reminder's time
 * zone, so "9am" stays 9am across a DST change.
 */
export const resolveRemindAt = (input: {
  remindAt?: Date;
  localDateTime?: Date | null;
  timeZone: string;
}): Date => {
  if (input.remindAt) return input.remindAt;
  if (input.localDateTime) {
    // The incoming value carries the wall-clock fields the user typed; rebuild
    // it as an instant in the target zone rather than trusting the offset.
    const wall = input.localDateTime;
    const asZoned = toZonedTime(wall, 'UTC');
    const zoned = new Date(
      Date.UTC(
        asZoned.getUTCFullYear(),
        asZoned.getUTCMonth(),
        asZoned.getUTCDate(),
        asZoned.getUTCHours(),
        asZoned.getUTCMinutes(),
        0,
        0,
      ),
    );
    return fromZonedTime(zoned, input.timeZone);
  }
  throw AppError.validation('A reminder needs a date and time');
};

export const listReminders = async (
  userId: string,
  query: {
    page: number;
    pageSize: number;
    status?: string;
    assessmentId?: string;
    from?: Date;
    to?: Date;
  },
) => {
  const { skip, take } = toSkipTake(query);

  const where = {
    userId,
    ...(query.assessmentId ? { assessmentId: query.assessmentId } : {}),
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.from || query.to
      ? {
          remindAt: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.reminder.findMany({ where, select: REMINDER_SELECT, orderBy: { remindAt: 'asc' }, skip, take }),
    prisma.reminder.count({ where }),
  ]);

  return { items: rows.map((row) => toView(row)), total, page: query.page, pageSize: query.pageSize };
};

/**
 * Creates a reminder. This is the ONLY place a reminder is ever created, and it
 * is only reachable from an explicit user request. Nothing else in the system
 * calls it — not imports, not deadline edits, not missed sessions.
 */
export const createReminder = async (
  userId: string,
  assessmentId: string,
  input: CreateReminderInput,
): Promise<ReminderView> => {
  const assessment = await getAssessmentForUser(userId, assessmentId);

  if (input.studyItemId) {
    const item = await prisma.studyItem.findUnique({
      where: { id: input.studyItemId },
      select: { assessmentId: true },
    });
    if (!item || item.assessmentId !== assessmentId) {
      throw AppError.validation('Study item does not belong to this assessment');
    }
  }

  const timeZone = input.timeZone ?? assessment.timeZone;
  const remindAt = resolveRemindAt({
    remindAt: input.remindAt,
    localDateTime: input.localDateTime ?? null,
    timeZone,
  });

  const row = await prisma.reminder.create({
    data: {
      userId,
      assessmentId,
      studyItemId: input.studyItemId,
      title: input.title,
      message: input.message,
      remindAt,
      localDateTime: input.localDateTime ?? null,
      timeZone,
      advanceMinutes: input.advanceMinutes,
      recurrence: input.recurrence,
      enabled: input.enabled,
    },
    select: REMINDER_SELECT,
  });

  return toView(row);
};

export const updateReminder = async (
  userId: string,
  reminderId: string,
  input: UpdateReminderInput,
): Promise<ReminderView> => {
  const current = await prisma.reminder.findUnique({
    where: { id: reminderId },
    select: { userId: true, timeZone: true, remindAt: true, localDateTime: true },
  });
  if (!current || current.userId !== userId) throw AppError.notFound('Reminder');

  const scheduleEdited =
    input.remindAt !== undefined ||
    Boolean(input.localDateTime) ||
    input.timeZone !== undefined ||
    input.recurrence !== undefined ||
    'advanceMinutes' in input;

  const timeZone = input.timeZone ?? current.timeZone;
  const nextRemindAt =
    input.remindAt ?? (input.localDateTime
      ? resolveRemindAt({ localDateTime: input.localDateTime, timeZone })
      : current.remindAt);

  const row = await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...('message' in input ? { message: input.message ?? null } : {}),
      remindAt: nextRemindAt,
      ...('localDateTime' in input ? { localDateTime: input.localDateTime ?? null } : {}),
      ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
      ...('advanceMinutes' in input ? { advanceMinutes: input.advanceMinutes ?? null } : {}),
      ...(input.recurrence !== undefined ? { recurrence: input.recurrence } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      // Only a change to WHEN it fires re-arms the reminder. Renaming it or
      // pausing it must not resurrect a delivered or dismissed one, because that
      // would send the same notification a second time.
      ...(scheduleEdited ? { status: 'PENDING', dismissedAt: null, snoozedUntil: null } : {}),
    },
    select: REMINDER_SELECT,
  });
  return toView(row);
};

export const reminderAction = async (
  userId: string,
  reminderId: string,
  input: ReminderActionInput,
): Promise<ReminderView> => {
  const current = await prisma.reminder.findUnique({
    where: { id: reminderId },
    select: { userId: true, timeZone: true, remindAt: true },
  });
  if (!current || current.userId !== userId) throw AppError.notFound('Reminder');

  if (input.action === 'snooze') {
    const minutes = input.snoozeMinutes;
    if (!minutes) {
      throw AppError.validation('snoozeMinutes is required to snooze', [
        { path: 'snoozeMinutes', message: 'Required for snooze' },
      ]);
    }
    const until = new Date(Date.now() + minutes * 60 * 1000);
    const row = await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: 'SNOOZED',
        // The original time is kept for display and history; the snooze is its
        // own delivery occurrence. It never spawns a second reminder.
        snoozedUntil: until,
        dismissedAt: null,
      },
      select: REMINDER_SELECT,
    });
    return toView(row);
  }

  if (input.action === 'dismiss') {
    const row = await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: 'DISMISSED', dismissedAt: new Date() },
      select: REMINDER_SELECT,
    });
    return toView(row);
  }

  // reset: bring a dismissed or snoozed reminder back to pending as-is.
  const row = await prisma.reminder.update({
    where: { id: reminderId },
    data: { status: 'PENDING', dismissedAt: null, snoozedUntil: null },
    select: REMINDER_SELECT,
  });
  return toView(row);
};

export const deleteReminder = async (userId: string, reminderId: string): Promise<void> => {
  const current = await prisma.reminder.findUnique({
    where: { id: reminderId },
    select: { userId: true },
  });
  if (!current || current.userId !== userId) throw AppError.notFound('Reminder');
  await prisma.reminder.delete({ where: { id: reminderId } });
};

export const toggleReminders = async (userId: string, enabled: boolean): Promise<number> => {
  const result = await prisma.reminder.updateMany({
    where: { userId, enabled: { not: enabled } },
    data: { enabled },
  });
  return result.count;
};

// ------------------------------ delivery ------------------------------------

/** The occurrence key is the reminder instant, so a retry cannot double-send. */
export const occurrenceKeyFor = (remindAt: Date): string => remindAt.toISOString();

export interface DueReminder {
  id: string;
  userId: string;
  assessmentId: string;
  title: string;
  message: string | null;
  remindAt: Date;
  timeZone: string;
  advanceMinutes: number | null;
  recurrence: ReminderRecurrence;
  status: string;
  snoozedUntil: Date | null;
}

const DUE_SELECT = {
  id: true,
  userId: true,
  assessmentId: true,
  title: true,
  message: true,
  remindAt: true,
  timeZone: true,
  advanceMinutes: true,
  recurrence: true,
  status: true,
  snoozedUntil: true,
} as const;

/** Longest advance notice the API accepts (14 days), so candidate selection can be bounded. */
const MAX_ADVANCE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Enabled reminders whose notify time is now and still inside the delivery
 * window. Read-only: it does not change any task or date. Reminders past the
 * window are handled by expireMissedReminders, never delivered late.
 */
export const findDueReminders = async (now: Date = new Date(), limit = 100): Promise<DueReminder[]> => {
  const candidates = (await prisma.reminder.findMany({
    where: {
      enabled: true,
      status: { in: ['PENDING', 'SNOOZED'] },
      OR: [
        { remindAt: { lte: new Date(now.getTime() + MAX_ADVANCE_MS) } },
        { snoozedUntil: { lte: now } },
      ],
    },
    select: DUE_SELECT,
    orderBy: { remindAt: 'asc' },
    take: limit * 5,
  })) as DueReminder[];
  return candidates.filter((reminder) => classifyReminder(reminder, now) === 'FIRE').slice(0, limit);
};

/**
 * Handles reminders that were not delivered in time (server down, user away).
 * A one-off reminder becomes MISSED and stays visible so the user decides what
 * to do. A recurring one skips to its next upcoming occurrence, because the
 * user asked for that recurrence. Nothing is delivered late, nothing is
 * duplicated and no task or date is touched.
 */
export const expireMissedReminders = async (now: Date = new Date(), limit = 200): Promise<number> => {
  const candidates = (await prisma.reminder.findMany({
    where: {
      enabled: true,
      status: { in: ['PENDING', 'SNOOZED'] },
      OR: [{ remindAt: { lt: now } }, { snoozedUntil: { lt: now } }],
    },
    select: DUE_SELECT,
    orderBy: { remindAt: 'asc' },
    take: limit,
  })) as DueReminder[];

  let handled = 0;
  for (const reminder of candidates) {
    if (classifyReminder(reminder, now) !== 'MISSED') continue;
    if (reminder.recurrence === 'NONE') {
      await prisma.reminder.update({ where: { id: reminder.id }, data: { status: 'MISSED' } });
    } else {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { remindAt: nextOccurrence(reminder, now), status: 'PENDING', snoozedUntil: null },
      });
    }
    handled += 1;
  }
  return handled;
};

/**
 * Records a delivery attempt exactly once per (reminder, channel, occurrence).
 * The unique constraint is the duplicate guard: a racing sweep loses the insert
 * and does not send twice.
 */
export const recordDelivery = async (
  reminderId: string,
  userId: string,
  channel: 'IN_APP' | 'BROWSER',
  scheduledFor: Date,
  status: 'DELIVERED' | 'FAILED',
  error?: string,
): Promise<boolean> => {
  try {
    await prisma.notificationDelivery.create({
      data: {
        reminderId,
        userId,
        channel,
        occurrenceKey: occurrenceKeyFor(scheduledFor),
        scheduledFor,
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : null,
        error: error ?? null,
      },
    });
    return true;
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      return false; // already delivered for this occurrence
    }
    logger.error('failed to record notification delivery', { reminderId, error: String(err) });
    return false;
  }
};

/**
 * After delivery: a one-off reminder is marked delivered; a recurring one moves
 * to its next upcoming occurrence. The associated study item is left exactly as
 * the user set it.
 */
export const markFired = async (reminder: DueReminder, now: Date = new Date()): Promise<void> => {
  if (reminder.recurrence === 'NONE') {
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'DELIVERED', lastFiredAt: now, snoozedUntil: null },
    });
    return;
  }
  await prisma.reminder.update({
    where: { id: reminder.id },
    data: {
      // Snoozing a recurring reminder delays one notification; the series keeps its own schedule.
      remindAt: reminder.status === 'SNOOZED' && reminder.remindAt.getTime() > now.getTime()
        ? reminder.remindAt
        : nextOccurrence(reminder, now),
      status: 'PENDING',
      snoozedUntil: null,
      lastFiredAt: now,
    },
  });
};
