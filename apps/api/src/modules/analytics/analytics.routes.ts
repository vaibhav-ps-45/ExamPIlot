import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import * as service from './analytics.service.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const overview = await service.globalOverview(req.auth!.userId);
    res.json(overview);
  }),
);

/** Nested under an assessment. */
export const assessmentAnalyticsRouter = Router({ mergeParams: true });
assessmentAnalyticsRouter.use(requireAuth);

assessmentAnalyticsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const analytics = await service.assessmentAnalytics(req.auth!.userId, req.params.assessmentId!);
    res.json({ analytics });
  }),
);
