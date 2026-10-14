import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env.js';

/**
 * Rate limiters. Disabled under test so suites are not flaky, and expressed in
 * minutes in the environment for readability.
 */
const build = (windowMinutes: number, max: number, message: string) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: isTest ? 100000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    // Identify by user when known, otherwise by IP. Trust-proxy is set in app.ts.
    keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'unknown',
    message: { error: { code: 'RATE_LIMITED', message } },
  });

export const authRateLimiter = build(
  env.AUTH_RATE_LIMIT_WINDOW_MINUTES,
  env.AUTH_RATE_LIMIT_MAX,
  'Too many authentication attempts. Please try again later.',
);

export const apiRateLimiter = build(
  env.API_RATE_LIMIT_WINDOW_MINUTES,
  env.API_RATE_LIMIT_MAX,
  'Too many requests. Please slow down.',
);
