import { z } from 'zod';

/** ISO-8601 string that also accepts a Date (for server-side reuse). */
export const isoDateTime = z
  .union([z.string().datetime({ offset: true }), z.string().datetime(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)));

export const optionalIsoDateTime = z
  .union([isoDateTime, z.null()])
  .optional()
  .transform((value) => value ?? null);

export const idSchema = z.string().min(1).max(64);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const nonEmptyString = (max = 500) => z.string().trim().min(1).max(max);
export const optionalString = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === undefined || v === '' ? null : v));

export const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex colour like #4f46e5');

/** IANA time-zone name, validated against the runtime's own tz database. */
export const timeZoneSchema = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Unknown IANA time zone' },
);

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const listResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  });

/**
 * PATCH-safe variants. The create helpers above turn a MISSING key into `null`,
 * which is right for create but destructive for a partial update: the server
 * decides what to change by checking which keys are present, so a PATCH that
 * only sets `completed` would also null the description, subject and dates.
 * These keep a missing key missing; an explicit '' or null still clears.
 */
export const optionalStringPatch = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const optionalIsoDateTimePatch = z.union([isoDateTime, z.null()]).optional();
