import { Router } from 'express';
import {
  createStudySessionSchema,
  studySessionListQuerySchema,
  updateStudySessionSchema,
} from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './session.service.js';

export const sessionRouter = Router({ mergeParams: true });
sessionRouter.use(requireAuth);

sessionRouter.get(
  '/',
  validate(studySessionListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listSessions(req.auth!.userId, req.params.assessmentId!, req.query as never);
    res.json(result);
  }),
);

sessionRouter.post(
  '/',
  validate(createStudySessionSchema),
  asyncHandler(async (req, res) => {
    const session = await service.createSession(req.auth!.userId, req.params.assessmentId!, req.body);
    res.status(201).json({ session });
  }),
);

sessionRouter.patch(
  '/:sessionId',
  validate(updateStudySessionSchema),
  asyncHandler(async (req, res) => {
    const session = await service.updateSession(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.sessionId!,
      req.body,
    );
    res.json({ session });
  }),
);

sessionRouter.delete(
  '/:sessionId',
  asyncHandler(async (req, res) => {
    await service.deleteSession(req.auth!.userId, req.params.assessmentId!, req.params.sessionId!);
    res.status(204).send();
  }),
);
