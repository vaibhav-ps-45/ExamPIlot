import { z } from 'zod';
import { CUSTOM_FIELD_TYPES, PRIORITIES } from '../constants.js';
import { isoDateTime, optionalIsoDateTime, optionalString } from './common.js';

const customValueInput = z.object({
  customFieldId: z.string().min(1),
  value: z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]).transform((v) =>
    v === null || v === undefined ? null : String(v),
  ),
});

const baseItem = {
  name: z.string().trim().min(1).max(300),
  description: optionalString(4000),
  subject: optionalString(200),
  topic: optionalString(200),
  subtopic: optionalString(200),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  plannedStartDate: optionalIsoDateTime,
  dueDate: optionalIsoDateTime,
  estimatedMinutes: z.number().int().min(0).max(60 * 24 * 30).nullish().transform((v) => v ?? null),
  syllabusNodeId: z.string().min(1).nullish().transform((v) => v ?? null),
  trackerId: z.string().min(1).nullish().transform((v) => v ?? null),
  metadata: z.record(z.unknown()).nullish().transform((v) => v ?? null),
};

export const createStudyItemSchema = z
  .object({
    ...baseItem,
    customValues: z.array(customValueInput).max(64).optional(),
  })
  .refine(
    (v) => !v.plannedStartDate || !v.dueDate || v.plannedStartDate.getTime() <= v.dueDate.getTime(),
    { message: 'Planned start must be on or before the due date', path: ['dueDate'] },
  );
export type CreateStudyItemInput = z.infer<typeof createStudyItemSchema>;

export const updateStudyItemSchema = z
  .object({
    name: baseItem.name.optional(),
    description: optionalString(4000),
    subject: optionalString(200),
    topic: optionalString(200),
    subtopic: optionalString(200),
    priority: z.enum(PRIORITIES).optional(),
    plannedStartDate: optionalIsoDateTime,
    dueDate: optionalIsoDateTime,
    estimatedMinutes: z.number().int().min(0).max(60 * 24 * 30).nullish(),
    syllabusNodeId: z.string().min(1).nullish(),
    trackerId: z.string().min(1).nullish(),
    completed: z.boolean().optional(),
    /// Only used together with `completed`. Defaults to "now" on the server.
    completedAt: optionalIsoDateTime,
    sortOrder: z.number().int().min(0).max(100000).optional(),
    metadata: z.record(z.unknown()).nullish(),
    customValues: z.array(customValueInput).max(64).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateStudyItemInput = z.infer<typeof updateStudyItemSchema>;

/**
 * Explicit, user-invoked reschedule. This is the ONLY way a planned date
 * changes, and it must carry both dates so the previous values can be kept in
 * the audit log.
 */
export const rescheduleStudyItemSchema = z
  .object({
    plannedStartDate: optionalIsoDateTime,
    dueDate: optionalIsoDateTime,
    reason: optionalString(500),
  })
  .refine((v) => v.plannedStartDate !== null || v.dueDate !== null, {
    message: 'Provide a new planned start date and/or due date',
  })
  .refine(
    (v) => !v.plannedStartDate || !v.dueDate || v.plannedStartDate.getTime() <= v.dueDate.getTime(),
    { message: 'Planned start must be on or before the due date', path: ['dueDate'] },
  );
export type RescheduleStudyItemInput = z.infer<typeof rescheduleStudyItemSchema>;

export const reorderStudyItemsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(2000),
});
export type ReorderStudyItemsInput = z.infer<typeof reorderStudyItemsSchema>;

export const studyItemListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(200).optional(),
  subject: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(200).optional(),
  priority: z.enum(PRIORITIES).optional(),
  completed: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  bookmarked: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  trackerId: z.string().min(1).optional(),
  sort: z.enum(['NAME', 'DUE_DATE', 'PRIORITY', 'PLANNED_START', 'ESTIMATED_MINUTES', 'ACTUAL_MINUTES', 'SORT_ORDER', 'CREATED_AT']).default('SORT_ORDER'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});
export type StudyItemListQuery = z.infer<typeof studyItemListQuerySchema>;

export const customFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Key must start with a letter and contain only letters, digits and underscores'),
  label: z.string().trim().min(1).max(120),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  required: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});
export type CustomFieldInput = z.infer<typeof customFieldSchema>;

export const updateCustomFieldSchema = customFieldSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;

/** Practice attempt payload. Slot index is bounded by the tracker config. */
const practiceAttemptBase = z.object({
    slotIndex: z.number().int().min(0).max(31).default(0),
    attemptedAt: isoDateTime,
    questionsAttempted: z.number().int().min(0).max(100000).nullish().transform((v) => v ?? null),
    questionsCorrect: z.number().int().min(0).max(100000).nullish().transform((v) => v ?? null),
    marksObtained: z.number().min(0).max(100000).nullish().transform((v) => v ?? null),
    maxMarks: z.number().min(0).max(100000).nullish().transform((v) => v ?? null),
    durationMinutes: z.number().int().min(0).max(60 * 24).nullish().transform((v) => v ?? null),
  notes: optionalString(2000),
});

export const practiceAttemptSchema = practiceAttemptBase
  .refine(
    (v) => v.questionsAttempted === null || v.questionsCorrect === null || v.questionsCorrect <= v.questionsAttempted,
    { message: 'Correct answers cannot exceed questions attempted', path: ['questionsCorrect'] },
  )
  .refine((v) => v.maxMarks === null || v.marksObtained === null || v.marksObtained <= v.maxMarks, {
    message: 'Marks obtained cannot exceed maximum marks',
    path: ['marksObtained'],
  });
export type PracticeAttemptInput = z.infer<typeof practiceAttemptSchema>;

/** Partial update of an attempt; the same cross-field rules are re-applied on merge. */
export const updatePracticeAttemptSchema = practiceAttemptBase.partial();
