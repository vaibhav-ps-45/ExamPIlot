import { z } from 'zod';
import {
  DISPLAY_DENSITIES,
  FIELD_KEYS,
  IMPLEMENTED_LAYOUTS,
  MAX_ATTEMPT_SLOTS,
  MIN_ATTEMPT_SLOTS,
  TRACKER_LAYOUTS,
} from '../constants.js';
import { hexColor, optionalString } from './common.js';

const layoutSchema = z.enum(TRACKER_LAYOUTS);
const densitySchema = z.enum(DISPLAY_DENSITIES);

export const trackerColumnInputSchema = z.object({
  fieldKey: z.enum(FIELD_KEYS),
  customFieldId: z.string().min(1).nullish().transform((v) => v ?? null),
  label: optionalString(120),
  width: z.number().int().min(40).max(1200).nullish().transform((v) => v ?? null),
  visible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  options: z.unknown().nullish(),
});
export type TrackerColumnInput = z.infer<typeof trackerColumnInputSchema>;

/**
 * Presentation-only configuration. Study items are never stored here; this
 * holds things like how many practice-attempt slots to render.
 */
export const trackerViewConfigSchema = z.object({
  attemptSlots: z.number().int().min(MIN_ATTEMPT_SLOTS).max(MAX_ATTEMPT_SLOTS).default(4),
  showCompleted: z.boolean().default(true),
  groupBySubject: z.boolean().default(false),
  notesBoardColumns: z.number().int().min(1).max(6).default(3),
});
export type TrackerViewConfig = z.infer<typeof trackerViewConfigSchema>;

export const DEFAULT_VIEW_CONFIG: TrackerViewConfig = {
  attemptSlots: 4,
  showCompleted: true,
  groupBySubject: false,
  notesBoardColumns: 3,
};

export const createTrackerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  layout: layoutSchema.default('TABLE'),
  accentColor: hexColor.nullish().transform((v) => v ?? null),
  density: densitySchema.default('COMFORTABLE'),
  viewConfig: trackerViewConfigSchema.partial().optional(),
  columns: z.array(trackerColumnInputSchema).max(64).optional(),
});
export type CreateTrackerInput = z.infer<typeof createTrackerSchema>;

export const updateTrackerSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    layout: layoutSchema.optional(),
    accentColor: hexColor.nullish(),
    density: densitySchema.optional(),
    isDefault: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    viewConfig: trackerViewConfigSchema.partial().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type UpdateTrackerInput = z.infer<typeof updateTrackerSchema>;

/**
 * Switching layout must be lossless. The server rejects fields the target
 * layout cannot display, so the client is told to keep or hide them rather
 * than silently dropping configuration.
 */
export const switchLayoutSchema = z.object({
  layout: layoutSchema.refine((l) => IMPLEMENTED_LAYOUTS.includes(l), {
    message: `Layout not implemented yet. Available: ${IMPLEMENTED_LAYOUTS.join(', ')}`,
  }),
  dropUnsupportedFields: z.boolean().default(false),
});
export type SwitchLayoutInput = z.infer<typeof switchLayoutSchema>;

export const reorderColumnsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(64),
});
export type ReorderColumnsInput = z.infer<typeof reorderColumnsSchema>;

export const trackerFilterSchema = z.object({
  subject: z.string().max(200).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  completed: z.coerce.boolean().optional(),
  bookmarked: z.coerce.boolean().optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  search: z.string().trim().max(200).optional(),
});
export type TrackerFilter = z.infer<typeof trackerFilterSchema>;

export const trackerSortSchema = z.object({
  field: z.enum(['NAME', 'DUE_DATE', 'PRIORITY', 'PLANNED_START', 'ESTIMATED_MINUTES', 'ACTUAL_MINUTES', 'SORT_ORDER']).default('SORT_ORDER'),
  direction: z.enum(['asc', 'desc']).default('asc'),
});
export type TrackerSort = z.infer<typeof trackerSortSchema>;

export const saveTrackerViewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  layout: layoutSchema.optional(),
  density: densitySchema.optional(),
  filters: trackerFilterSchema.optional(),
  sorts: trackerSortSchema.optional(),
  searchTerm: z.string().max(200).optional(),
  isDefault: z.boolean().default(false),
});
export type SaveTrackerViewInput = z.infer<typeof saveTrackerViewSchema>;
