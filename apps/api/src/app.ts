import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env, isProduction } from './config/env.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { assessmentRouter } from './modules/assessments/assessment.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { analyticsRouter, assessmentAnalyticsRouter } from './modules/analytics/analytics.routes.js';
import { bookmarkRouter } from './modules/bookmarks/bookmark.routes.js';
import { customFieldRouter } from './modules/customFields/customField.routes.js';
import { mockTestRouter } from './modules/mockTests/mockTest.routes.js';
import { noteRouter } from './modules/notes/note.routes.js';
import { assessmentReminderRouter, reminderRouter } from './modules/reminders/reminder.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { sessionRouter } from './modules/sessions/session.routes.js';
import { studyItemRouter } from './modules/studyItems/studyItem.routes.js';
import { syllabusRouter } from './modules/syllabus/syllabus.routes.js';
import { trackerRouter } from './modules/trackers/tracker.routes.js';

export const createApp = (): Express => {
  const app = express();

  // Behind a proxy (Docker/nginx) the real client IP is in X-Forwarded-For;
  // trust exactly one hop so rate limiting keys on the client, not the proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin/curl requests have no Origin header; allow them.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  app.use('/api', apiRateLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/assessments', assessmentRouter);
  app.use('/api/assessments/:assessmentId/syllabus', syllabusRouter);
  app.use('/api/assessments/:assessmentId/items', studyItemRouter);
  app.use('/api/assessments/:assessmentId/sessions', sessionRouter);
  app.use('/api/assessments/:assessmentId/trackers', trackerRouter);
  app.use('/api/assessments/:assessmentId/notes', noteRouter);
  app.use('/api/assessments/:assessmentId/custom-fields', customFieldRouter);
  app.use('/api/bookmarks', bookmarkRouter);
  app.use('/api/reminders', reminderRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/assessments/:assessmentId/mock-tests', mockTestRouter);
  app.use('/api/assessments/:assessmentId/reminders', assessmentReminderRouter);
  app.use('/api/assessments/:assessmentId/analytics', assessmentAnalyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
