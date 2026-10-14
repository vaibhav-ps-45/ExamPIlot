import { Router } from 'express';
import {
  assessmentListQuerySchema,
  assessmentSchedulePreferenceSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
} from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './assessment.service.js';

export const assessmentRouter = Router();

assessmentRouter.use(requireAuth);

assessmentRouter.get(
  '/',
  validate(assessmentListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const items = await service.listAssessments(req.auth!.userId, req.query as never);
    res.json({ items, total: items.length });
  }),
);

assessmentRouter.post(
  '/',
  validate(createAssessmentSchema),
  asyncHandler(async (req, res) => {
    const assessment = await service.createAssessment(req.auth!.userId, req.body);
    res.status(201).json({ assessment });
  }),
);

assessmentRouter.get(
  '/:assessmentId',
  asyncHandler(async (req, res) => {
    const assessment = await service.getAssessment(req.auth!.userId, req.params.assessmentId!);
    res.json({ assessment });
  }),
);

assessmentRouter.patch(
  '/:assessmentId',
  validate(updateAssessmentSchema),
  asyncHandler(async (req, res) => {
    const assessment = await service.updateAssessment(req.auth!.userId, req.params.assessmentId!, req.body);
    res.json({ assessment });
  }),
);

assessmentRouter.delete(
  '/:assessmentId',
  asyncHandler(async (req, res) => {
    await service.deleteAssessment(req.auth!.userId, req.params.assessmentId!);
    res.status(204).send();
  }),
);

assessmentRouter.put(
  '/:assessmentId/schedule-preference',
  validate(assessmentSchedulePreferenceSchema),
  asyncHandler(async (req, res) => {
    const assessment = await service.updateSchedulePreference(
      req.auth!.userId,
      req.params.assessmentId!,
      req.body,
    );
    res.json({ assessment });
  }),
);
