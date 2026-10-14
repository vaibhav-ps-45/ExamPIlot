import type { CreateReminderInput, ReminderActionInput, UpdateReminderInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { toSkipTake } from '../../lib/pagination.js';
import { addDaysInZone, fromZonedTime, toZonedTime } from '../../lib/dates.js';
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
  /** Derived: true when the reminder is pending but its time has passed. */
  isMissed: boolean;
  deliveries: Array<{ channel: string; status: string; scheduledFor: string; deliveredAt: string | null }>;
}

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
    row.enabled &&
    row.status === 'PENDING' &&
    row.remindAt.getTime() < now.getTime() &&
    !row.dismissedAt,
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
      // Editing a reminder returns it to pending; the user's own action, not automation.
      status: 'PENDING',
      dismissedAt: null,
      snoozedUntil: null,
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
        snoozedUntil: until,
        remindAt: until,
        // A snooze is a user action; it never spawns a second reminder.
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
  recurrence: string;
}

/**
 * Finds reminders that are due and not yet delivered for this occurrence.
 * Read-only: it does not change any task or date.
 */
export const findDueReminders = async (now: Date = new Date(), limit = 100): Promise<DueReminder[]> => {
  return prisma.reminder.findMany({
    where: {
      enabled: true,
      status: { in: ['PENDING', 'SNOOZED'] },
      remindAt: { lte: now },
      OR: [
        { lastFiredAt: null },
        { lastFiredAt: { lt: now } },
      ],
    },
    select: {
      id: true,
      userId: true,
      assessmentId: true,
      title: true,
      message: true,
      remindAt: true,
      timeZone: true,
      advanceMinutes: true,
      recurrence: true,
    },
    orderBy: { remindAt: 'asc' },
    take: limit,
  });
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
 * Advances a recurring reminder to its next occurrence. A NON-recurring
 * reminder is simply marked delivered. In both cases the associated study item
 * is left exactly as the user set it.
 */
export const markFired = async (reminder: DueReminder, now: Date = new Date()): Promise<void> => {
  if (reminder.recurrence === 'NONE') {
    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'DELIVERED', lastFiredAt: now },
    });
    return;
  }

  const next = (() => {
    switch (reminder.recurrence) {
      case 'DAILY':
        return addDaysInZone(reminder.remindAt, 1, reminder.timeZone);
      case 'WEEKLY':
        return addDaysInZone(reminder.remindAt, 7, reminder.timeZone);
      case 'MONTHLY':
        return addDaysInZone(reminder.remindAt, 30, reminder.timeZone);
      default:
        return reminder.remindAt;
    }
  })();

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { remindAt: next, status: 'PENDING', lastFiredAt: now },
  });
};
