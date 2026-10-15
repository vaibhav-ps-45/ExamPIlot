import { Router } from 'express';
import {
  createReminderSchema,
  reminderActionSchema,
  reminderListQuerySchema,
  updateReminderSchema,
} from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './reminder.service.js';

export const reminderRouter = Router();
reminderRouter.use(requireAuth);

reminderRouter.get(
  '/',
  validate(reminderListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listReminders(req.auth!.userId, req.query as never);
    res.json(result);
  }),
);

/**
 * Kill switch: turns every reminder off. There is deliberately no bulk "turn on":
 * it could re-enable reminders the user had switched off one by one, which would
 * be an automatic opt-in. Reminders are re-enabled individually, by the user.
 */
reminderRouter.post(
  '/disable-all',
  asyncHandler(async (req, res) => {
    const updated = await service.toggleReminders(req.auth!.userId, false);
    res.json({ updated });
  }),
);

reminderRouter.patch(
  '/:reminderId',
  validate(updateReminderSchema),
  asyncHandler(async (req, res) => {
    const reminder = await service.updateReminder(req.auth!.userId, req.params.reminderId!, req.body);
    res.json({ reminder });
  }),
);

reminderRouter.post(
  '/:reminderId/action',
  validate(reminderActionSchema),
  asyncHandler(async (req, res) => {
    const reminder = await service.reminderAction(req.auth!.userId, req.params.reminderId!, req.body);
    res.json({ reminder });
  }),
);

reminderRouter.delete(
  '/:reminderId',
  asyncHandler(async (req, res) => {
    await service.deleteReminder(req.auth!.userId, req.params.reminderId!);
    res.status(204).send();
  }),
);

/** Nested under an assessment for creation, so ownership is unambiguous. */
export const assessmentReminderRouter = Router({ mergeParams: true });
assessmentReminderRouter.use(requireAuth);

assessmentReminderRouter.get(
  '/',
  validate(reminderListQuerySchema.omit({ assessmentId: true }), 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, unknown>;
    const result = await service.listReminders(req.auth!.userId, {
      ...(query as { page: number; pageSize: number; status?: string; from?: Date; to?: Date }),
      assessmentId: req.params.assessmentId!,
    });
    res.json(result);
  }),
);

assessmentReminderRouter.post(
  '/',
  validate(createReminderSchema),
  asyncHandler(async (req, res) => {
    const reminder = await service.createReminder(req.auth!.userId, req.params.assessmentId!, req.body);
    res.status(201).json({ reminder });
  }),
);

assessmentReminderRouter.patch(
  '/reminders-enabled',
  asyncHandler(async (req, res) => {
    const enabled = req.body?.enabled === true;
    const count = await service.toggleReminders(req.auth!.userId, enabled);
    res.json({ updated: count, enabled });
  }),
);
