import { z } from 'zod';
import { BOOKMARK_LABELS, BOOKMARK_TARGET_TYPES } from '../constants.js';
import { optionalString, optionalStringPatch } from './common.js';

/**
 * A bookmark references exactly one target. The API verifies that the target
 * exists, belongs to the caller, and matches `targetType`.
 */
export const createBookmarkSchema = z
  .object({
    targetType: z.enum(BOOKMARK_TARGET_TYPES),
    studyItemId: z.string().min(1).nullish(),
    syllabusNodeId: z.string().min(1).nullish(),
    noteId: z.string().min(1).nullish(),
    mockTestId: z.string().min(1).nullish(),
    label: z.enum(BOOKMARK_LABELS).default('IMPORTANT'),
    customLabel: optionalString(80),
    reason: optionalString(500),
  })
  .superRefine((v, ctx) => {
    const provided = [v.studyItemId, v.syllabusNodeId, v.noteId, v.mockTestId].filter(Boolean);
    if (provided.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Exactly one bookmark target is required' });
      return;
    }
    const expected: Record<string, boolean> = {
      STUDY_ITEM: Boolean(v.studyItemId),
      SYLLABUS_TOPIC: Boolean(v.syllabusNodeId),
      NOTE: Boolean(v.noteId),
      MOCK_TEST: Boolean(v.mockTestId),
    };
    if (!expected[v.targetType]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Target does not match targetType ${v.targetType}` });
    }
    if (v.label === 'CUSTOM' && !v.customLabel) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A custom label is required when label is CUSTOM', path: ['customLabel'] });
    }
  });
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;

export const updateBookmarkSchema = z
  .object({
    label: z.enum(BOOKMARK_LABELS).optional(),
    customLabel: optionalStringPatch(80),
    reason: optionalStringPatch(500),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateBookmarkInput = z.infer<typeof updateBookmarkSchema>;

export const bookmarkListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  assessmentId: z.string().min(1).optional(),
  subject: z.string().max(200).optional(),
  targetType: z.enum(BOOKMARK_TARGET_TYPES).optional(),
  label: z.enum(BOOKMARK_LABELS).optional(),
});
export type BookmarkListQuery = z.infer<typeof bookmarkListQuerySchema>;
