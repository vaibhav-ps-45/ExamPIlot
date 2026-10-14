import { z } from 'zod';
import { optionalString } from './common.js';

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.string().max(50000).default(''),
  studyItemId: z.string().min(1).nullish().transform((v) => v ?? null),
  syllabusNodeId: z.string().min(1).nullish().transform((v) => v ?? null),
  pinned: z.boolean().default(false),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    body: z.string().max(50000).optional(),
    studyItemId: z.string().min(1).nullish(),
    syllabusNodeId: z.string().min(1).nullish(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const noteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: optionalString(200),
  studyItemId: z.string().min(1).optional(),
  pinned: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
export type NoteListQuery = z.infer<typeof noteListQuerySchema>;
