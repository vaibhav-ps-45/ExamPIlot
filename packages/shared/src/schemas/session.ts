import { z } from 'zod';
import { isoDateTime, optionalString } from './common.js';

/**
 * A study session. Either provide start+end (duration is derived) or provide
 * `manualMinutes` alone. The API rejects both at once so the same minutes can
 * never be counted twice.
 */
export const createStudySessionSchema = z
  .object({
    studyItemId: z.string().min(1).nullish().transform((v) => v ?? null),
    startedAt: isoDateTime.optional(),
    endedAt: isoDateTime.optional(),
    manualMinutes: z.number().int().min(1).max(60 * 24 * 7).nullish().transform((v) => v ?? null),
    notes: optionalString(2000),
  })
  .refine((v) => v.manualMinutes === null || (!v.startedAt && !v.endedAt), {
    message: 'Provide either a start/end pair or manualMinutes, not both',
    path: ['manualMinutes'],
  })
  .refine((v) => !v.manualMinutes || v.manualMinutes > 0, { message: 'manualMinutes must be positive' })
  .refine((v) => (v.startedAt ? Boolean(v.endedAt) : !v.endedAt), {
    message: 'endedAt requires startedAt',
    path: ['endedAt'],
  })
  .refine((v) => !v.startedAt || !v.endedAt || v.endedAt.getTime() > v.startedAt.getTime(), {
    message: 'Session end must be after its start',
    path: ['endedAt'],
  })
  .refine((v) => Boolean(v.manualMinutes) || Boolean(v.startedAt), {
    message: 'Provide a start/end pair or manualMinutes',
  });
export type CreateStudySessionInput = z.infer<typeof createStudySessionSchema>;

export const updateStudySessionSchema = z
  .object({
    startedAt: isoDateTime.nullish(),
    endedAt: isoDateTime.nullish(),
    manualMinutes: z.number().int().min(1).max(60 * 24 * 7).nullish(),
    notes: optionalString(2000),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;

export const studySessionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  studyItemId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type StudySessionListQuery = z.infer<typeof studySessionListQuerySchema>;
