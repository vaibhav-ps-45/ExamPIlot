import { Router } from 'express';
import { z } from 'zod';
import { timeZoneSchema, updateSettingsSchema } from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './settings.service.js';

const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    timeZone: timeZoneSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await service.getSettings(req.auth!.userId);
    res.json({ settings });
  }),
);

settingsRouter.patch(
  '/',
  validate(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const settings = await service.updateSettings(req.auth!.userId, req.body);
    res.json({ settings });
  }),
);

settingsRouter.patch(
  '/profile',
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await service.updateProfile(req.auth!.userId, req.body);
    res.json({ user });
  }),
);

settingsRouter.get(
  '/sessions',
  asyncHandler(async (req, res) => {
    const sessions = await service.listSessions(req.auth!.userId, req.auth!.sessionId);
    res.json({ sessions });
  }),
);

settingsRouter.delete(
  '/sessions/:sessionId',
  asyncHandler(async (req, res) => {
    await service.revokeSession(req.auth!.userId, req.params.sessionId!);
    res.status(204).send();
  }),
);
