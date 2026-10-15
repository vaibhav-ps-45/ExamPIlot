import { z } from 'zod';
import { REMINDER_RECURRENCES, REMINDER_STATUSES } from '../constants.js';
import { isoDateTime, optionalString, optionalStringPatch, timeZoneSchema } from './common.js';

/**
 * Reminders exist only because a user created them. Nothing in the API
 * generates a reminder as a side effect of another action.
 */
export const createReminderSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    message: optionalString(1000),
    /// The instant the reminder should fire. Preferred over localDateTime.
    remindAt: isoDateTime.optional(),
    /// Wall-clock intent; combined with timeZone when remindAt is absent.
    localDateTime: isoDateTime.optional(),
    timeZone: timeZoneSchema.optional(),
    advanceMinutes: z.number().int().min(0).max(60 * 24 * 14).nullish().transform((v) => v ?? null),
    recurrence: z.enum(REMINDER_RECURRENCES).default('NONE'),
    studyItemId: z.string().min(1).nullish().transform((v) => v ?? null),
    enabled: z.boolean().default(true),
  })
  .refine((v) => Boolean(v.remindAt) || Boolean(v.localDateTime), {
    message: 'Provide remindAt or localDateTime',
  });
export type CreateReminderInput = z.infer<typeof createReminderSchema>;

export const updateReminderSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    message: optionalStringPatch(1000),
    remindAt: isoDateTime.optional(),
    localDateTime: isoDateTime.nullish(),
    timeZone: timeZoneSchema.optional(),
    advanceMinutes: z.number().int().min(0).max(60 * 24 * 14).nullish(),
    recurrence: z.enum(REMINDER_RECURRENCES).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;

export const reminderActionSchema = z.object({
  action: z.enum(['snooze', 'dismiss', 'reset']),
  /// Required for snooze.
  snoozeMinutes: z.number().int().min(1).max(60 * 24 * 30).optional(),
});
export type ReminderActionInput = z.infer<typeof reminderActionSchema>;

export const reminderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(REMINDER_STATUSES).optional(),
  assessmentId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ReminderListQuery = z.infer<typeof reminderListQuerySchema>;
