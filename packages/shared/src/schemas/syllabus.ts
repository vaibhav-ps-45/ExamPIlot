import { z } from 'zod';
import { optionalString, optionalStringPatch } from './common.js';

export const createSyllabusNodeSchema = z.object({
  parentId: z.string().min(1).nullish().transform((v) => v ?? null),
  title: z.string().trim().min(1).max(300),
  description: optionalString(2000),
  weight: z.number().min(0).max(1000).nullish().transform((v) => v ?? null),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});
export type CreateSyllabusNodeInput = z.infer<typeof createSyllabusNodeSchema>;

export const updateSyllabusNodeSchema = z
  .object({
    parentId: z.string().min(1).nullish(),
    title: z.string().trim().min(1).max(300).optional(),
    description: optionalStringPatch(2000),
    weight: z.number().min(0).max(1000).nullish(),
    sortOrder: z.number().int().min(0).max(100000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateSyllabusNodeInput = z.infer<typeof updateSyllabusNodeSchema>;

export const reorderSyllabusSchema = z.object({
  parentId: z.string().min(1).nullish().transform((v) => v ?? null),
  orderedIds: z.array(z.string().min(1)).min(1).max(2000),
});
export type ReorderSyllabusInput = z.infer<typeof reorderSyllabusSchema>;

/**
 * Template import. Optional and explicitly user-triggered: importing a
 * syllabus never creates reminders, tasks or dates on its own.
 */
export const syllabusTemplateNodeSchema: z.ZodType<{
  title: string;
  description?: string | null;
  children?: unknown[];
}> = z.lazy(() =>
  z.object({
    title: z.string().trim().min(1).max(300),
    description: optionalString(2000),
    children: z.array(syllabusTemplateNodeSchema).max(500).optional(),
  }),
);

export const importSyllabusTemplateSchema = z.object({
  templateId: z.string().min(1).max(64),
  createStudyItems: z.boolean().default(false),
});
export type ImportSyllabusTemplateInput = z.infer<typeof importSyllabusTemplateSchema>;

export const syllabusTemplateSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  nodeCount: z.number().int(),
});
