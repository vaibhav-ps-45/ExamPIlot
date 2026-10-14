import { Router } from 'express';
import { createMockTestSchema, mockTestListQuerySchema, updateMockTestSchema } from '@exampilot/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import * as service from './mockTest.service.js';

export const mockTestRouter = Router({ mergeParams: true });
mockTestRouter.use(requireAuth);

mockTestRouter.get(
  '/',
  validate(mockTestListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await service.listMockTests(req.auth!.userId, req.params.assessmentId!, req.query as never);
    res.json(result);
  }),
);

mockTestRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const summary = await service.mockTestSummary(req.auth!.userId, req.params.assessmentId!);
    res.json({ summary });
  }),
);

mockTestRouter.post(
  '/',
  validate(createMockTestSchema),
  asyncHandler(async (req, res) => {
    const test = await service.createMockTest(req.auth!.userId, req.params.assessmentId!, req.body);
    res.status(201).json({ mockTest: test });
  }),
);

mockTestRouter.get(
  '/:testId',
  asyncHandler(async (req, res) => {
    const test = await service.getMockTest(req.auth!.userId, req.params.assessmentId!, req.params.testId!);
    res.json({ mockTest: test });
  }),
);

mockTestRouter.patch(
  '/:testId',
  validate(updateMockTestSchema),
  asyncHandler(async (req, res) => {
    const test = await service.updateMockTest(
      req.auth!.userId,
      req.params.assessmentId!,
      req.params.testId!,
      req.body,
    );
    res.json({ mockTest: test });
  }),
);

mockTestRouter.delete(
  '/:testId',
  asyncHandler(async (req, res) => {
    await service.deleteMockTest(req.auth!.userId, req.params.assessmentId!, req.params.testId!);
    res.status(204).send();
  }),
);
