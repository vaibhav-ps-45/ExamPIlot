import { Router } from 'express';
import { z } from 'zod';
import {
  FIELD_KEYS,
  createTrackerSchema,
  reorderColumnsSchema,
  saveTrackerViewSchema,
  switchLayoutSchema,
  trackerColumnInputSchema,
  updateTrackerSchema,
} from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './tracker.service.js';

const updateColumnSchema = z
  .object({
    label: z.string().trim().max(120).nullish(),
    width: z.number().int().min(40).max(1200).nullish(),
    visible: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });

export const trackerRouter = Router({ mergeParams: true });
trackerRouter.use(requireAuth);

trackerRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const trackers = await service.listTrackers(req.auth!.userId, req.params.assessmentId!);
    res.json({ trackers });
  }),
);

trackerRouter.post(
  '/',
  validate(createTrackerSchema),
  asyncHandler(async (req, res) => {
    const tracker = await service.createTracker(req.auth!.userId, req.params.assessmentId!, req.body);
    res.status(201).json({ tracker });
  }),
);

trackerRouter.get(
  '/:trackerId',
  asyncHandler(async (req, res) => {
    const tracker = await service.getTracker(req.auth!.userId, req.params.assessmentId!, req.params.trackerId!);
    res.json({ tracker });
  }),
);

trackerRouter.patch(
  '/:trackerId',
  validate(updateTrackerSchema),
  asyncHandler(async (req, res) => {
    const tracker = await service.updateTracker(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.trackerId!,
      req.body,
    );
    res.json({ tracker });
  }),
);

trackerRouter.post(
  '/:trackerId/layout',
  validate(switchLayoutSchema),
  asyncHandler(async (req, res) => {
    const result = await service.switchLayout(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.trackerId!,
      req.body,
    );
    res.json(result);
  }),
);

trackerRouter.delete(
  '/:trackerId',
  asyncHandler(async (req, res) => {
    await service.deleteTracker(req.auth!.userId, req.params.assessmentId!, req.params.trackerId!);
    res.status(204).send();
  }),
);

// ------------------------------ columns -------------------------------------

trackerRouter.post(
  '/:trackerId/columns',
  validate(trackerColumnInputSchema.partial({ visible: true })),
  asyncHandler(async (req, res) => {
    const tracker = await service.addColumn(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.trackerId!,
      req.body,
    );
    res.status(201).json({ tracker });
  }),
);

trackerRouter.patch(
  '/:trackerId/columns/:columnId',
  validate(updateColumnSchema),
  asyncHandler(async (req, res) => {
    const tracker = await service.updateColumn(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.trackerId!,
      req.params.columnId!,
      req.body,
    );
    res.json({ tracker });
  }),
);

trackerRouter.delete(
  '/:trackerId/columns/:columnId',
  asyncHandler(async (req, res) => {
    await service.deleteColumn(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.trackerId!,
      req.params.columnId!,
    );
    res.status(204).send();
  }),
);

trackerRouter.post(
  '/:trackerId/columns/reorder',
  validate(reorderColumnsSchema),
  asyncHandler(async (req, res) => {
    const tracker = await service.reorderColumns(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.trackerId!,
      req.body.orderedIds,
    );
    res.json({ tracker });
  }),
);

// ---------------------------- saved views -----------------------------------

trackerRouter.get(
  '/:trackerId/views',
  asyncHandler(async (req, res) => {
    const views = await service.listViews(req.auth!.userId, req.params.assessmentId!, req.params.trackerId!);
    res.json({ views });
  }),
);

trackerRouter.post(
  '/:trackerId/views',
  validate(saveTrackerViewSchema),
  asyncHandler(async (req, res) => {
    const view = await service.saveView(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.trackerId!,
      req.body,
    );
    res.status(201).json({ view });
  }),
);

trackerRouter.delete(
  '/:trackerId/views/:viewId',
  asyncHandler(async (req, res) => {
    await service.deleteView(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.trackerId!,
      req.params.viewId!,
    );
    res.status(204).send();
  }),
);

export const FIELD_KEY_VALUES = FIELD_KEYS;
