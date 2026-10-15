import { z } from 'zod';
import { isoDateTime, optionalString, optionalStringPatch } from './common.js';

export const mockTestSectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  totalMarks: z.number().min(0).max(100000),
  marksObtained: z.number().min(0).max(100000),
  notes: optionalString(500),
});

export const createMockTestSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    takenOn: isoDateTime,
    totalMarks: z.number().min(0).max(100000),
    marksObtained: z.number().min(0).max(100000),
    durationMinutes: z.number().int().min(0).max(60 * 24).nullish().transform((v) => v ?? null),
    sections: z.array(mockTestSectionSchema).max(30).nullish().transform((v) => v ?? null),
    notes: optionalString(4000),
    reviewed: z.boolean().default(false),
  })
  .refine((v) => v.marksObtained <= v.totalMarks, {
    message: 'Marks obtained cannot exceed total marks',
    path: ['marksObtained'],
  })
  .refine(
    (v) => !v.sections || v.sections.every((s) => s.marksObtained <= s.totalMarks),
    { message: 'A section cannot score more than its total marks', path: ['sections'] },
  );
export type CreateMockTestInput = z.infer<typeof createMockTestSchema>;

export const updateMockTestSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    takenOn: isoDateTime.optional(),
    totalMarks: z.number().min(0).max(100000).optional(),
    marksObtained: z.number().min(0).max(100000).optional(),
    durationMinutes: z.number().int().min(0).max(60 * 24).nullish(),
    sections: z.array(mockTestSectionSchema).max(30).nullish(),
    notes: optionalStringPatch(4000),
    reviewed: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateMockTestInput = z.infer<typeof updateMockTestSchema>;

export const mockTestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type MockTestListQuery = z.infer<typeof mockTestListQuerySchema>;
