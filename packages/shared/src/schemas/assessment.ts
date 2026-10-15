import { z } from 'zod';
import { ASSESSMENT_STATUSES } from '../constants.js';
import { hexColor, optionalIsoDateTime, optionalIsoDateTimePatch, optionalString, optionalStringPatch, timeZoneSchema } from './common.js';

/**
 * An assessment is the workspace root for everything else. `examDate` is
 * optional: the product explicitly supports assessments with no exam date
 * ("handle assessments without an exam date").
 */
const baseAssessment = {
  name: z.string().trim().min(1).max(200),
  category: optionalString(120),
  description: optionalString(2000),
  startDate: optionalIsoDateTime,
  examDate: optionalIsoDateTime,
  timeZone: timeZoneSchema,
  status: z.enum(ASSESSMENT_STATUSES).default('PLANNING'),
  accentColor: hexColor.nullish().transform((v) => v ?? null),
};

export const createAssessmentSchema = z
  .object(baseAssessment)
  .refine(
    (v) => !v.startDate || !v.examDate || v.startDate.getTime() <= v.examDate.getTime(),
    { message: 'Start date must be on or before the exam date', path: ['examDate'] },
  )
  .refine((v) => !v.examDate || v.examDate.getTime() > 0, {
    message: 'Invalid exam date',
    path: ['examDate'],
  });
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

/** Partial update. Date-range validation is repeated after merge on the server. */
export const updateAssessmentSchema = z
  .object({
    name: baseAssessment.name.optional(),
    category: optionalStringPatch(120),
    description: optionalStringPatch(2000),
    startDate: optionalIsoDateTimePatch,
    examDate: optionalIsoDateTimePatch,
    timeZone: timeZoneSchema.optional(),
    status: z.enum(ASSESSMENT_STATUSES).optional(),
    accentColor: hexColor.nullish(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

export const assessmentSchedulePreferenceSchema = z.object({
  preferredStudyDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  dailyTargetMinutes: z.number().int().min(0).max(24 * 60).nullish().transform((v) => v ?? null),
  trackScheduleAdherence: z.boolean().default(true),
});
export type AssessmentSchedulePreferenceInput = z.infer<typeof assessmentSchedulePreferenceSchema>;

export const assessmentListQuerySchema = z.object({
  status: z.enum(ASSESSMENT_STATUSES).optional(),
  includeArchived: z.coerce.boolean().default(false),
  search: z.string().trim().max(200).optional(),
});
export type AssessmentListQuery = z.infer<typeof assessmentListQuerySchema>;
