import { z } from 'zod';
import { THEME_PREFERENCES } from '../constants.js';
import { timeZoneSchema } from './common.js';

export const updateSettingsSchema = z
  .object({
    theme: z.enum(THEME_PREFERENCES).optional(),
    defaultTimeZone: timeZoneSchema.optional(),
    browserNotificationsEnabled: z.boolean().optional(),
    inAppNotificationsEnabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No settings provided' });
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const settingsSchema = z.object({
  theme: z.enum(THEME_PREFERENCES),
  defaultTimeZone: z.string(),
  browserNotificationsEnabled: z.boolean(),
  inAppNotificationsEnabled: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;
