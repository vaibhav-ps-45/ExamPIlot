import { Router } from 'express';
import {
  createStudyItemSchema,
  practiceAttemptSchema,
  reorderStudyItemsSchema,
  rescheduleStudyItemSchema,
  studyItemListQuerySchema,
  updatePracticeAttemptSchema,
  updateStudyItemSchema,
} from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './studyItem.service.js';

export const studyItemRouter = Router({ mergeParams: true });
studyItemRouter.use(requireAuth);

studyItemRouter.get(
  '/',
  validate(studyItemListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listStudyItems(req.auth!.userId, req.params.assessmentId!, req.query as never);
    res.json(result);
  }),
);

studyItemRouter.post(
  '/',
  validate(createStudyItemSchema),
  asyncHandler(async (req, res) => {
    const item = await service.createStudyItem(req.auth!.userId, req.params.assessmentId!, req.body);
    res.status(201).json({ item });
  }),
);

studyItemRouter.post(
  '/reorder',
  validate(reorderStudyItemsSchema),
  asyncHandler(async (req, res) => {
    await service.reorderStudyItems(req.auth!.userId, req.params.assessmentId!, req.body.orderedIds);
    res.status(204).send();
  }),
);

studyItemRouter.get(
  '/:itemId',
  asyncHandler(async (req, res) => {
    const item = await service.getStudyItem(req.auth!.userId, req.params.assessmentId!, req.params.itemId!);
    res.json({ item });
  }),
);

studyItemRouter.patch(
  '/:itemId',
  validate(updateStudyItemSchema),
  asyncHandler(async (req, res) => {
    const item = await service.updateStudyItem(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.itemId!,
      req.body,
    );
    res.json({ item });
  }),
);

// Explicit, user-invoked reschedule. Nothing calls this automatically.
studyItemRouter.post(
  '/:itemId/reschedule',
  validate(rescheduleStudyItemSchema),
  asyncHandler(async (req, res) => {
    const item = await service.rescheduleStudyItem(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.itemId!,
      req.body,
    );
    res.json({ item });
  }),
);

studyItemRouter.delete(
  '/:itemId',
  asyncHandler(async (req, res) => {
    await service.deleteStudyItem(req.auth!.userId, req.params.assessmentId!, req.params.itemId!);
    res.status(204).send();
  }),
);

// ------------------------------ attempts -----------------------------------

studyItemRouter.get(
  '/:itemId/attempts',
  asyncHandler(async (req, res) => {
    const attempts = await service.listAttempts(req.auth!.userId, req.params.assessmentId!, req.params.itemId!);
    res.json({ attempts });
  }),
);

studyItemRouter.post(
  '/:itemId/attempts',
  validate(practiceAttemptSchema),
  asyncHandler(async (req, res) => {
    const attempt = await service.createAttempt(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.itemId!,
      req.body,
    );
    res.status(201).json({ attempt });
  }),
);

studyItemRouter.patch(
  '/:itemId/attempts/:attemptId',
  validate(updatePracticeAttemptSchema),
  asyncHandler(async (req, res) => {
    const attempt = await service.updateAttempt(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.itemId!,
      req.params.attemptId!,
      req.body,
    );
    res.json({ attempt });
  }),
);

studyItemRouter.delete(
  '/:itemId/attempts/:attemptId',
  asyncHandler(async (req, res) => {
    await service.deleteAttempt(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.itemId!,
      req.params.attemptId!,
    );
    res.status(204).send();
  }),
);
