import { Router } from 'express';
import { z } from 'zod';
import { loginSchema, passwordSchema, registerSchema } from '@exampilot/shared';
import { requireAuth } from '../../middleware/auth.js';
import { authRateLimiter, apiRateLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './auth.controller.js';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate(registerSchema), controller.registerHandler);
authRouter.post('/login', authRateLimiter, validate(loginSchema), controller.loginHandler);
authRouter.post('/refresh', authRateLimiter, controller.refreshHandler);
authRouter.post('/logout', apiRateLimiter, controller.logoutHandler);
authRouter.get('/me', apiRateLimiter, requireAuth, controller.meHandler);
authRouter.post('/logout-all', apiRateLimiter, requireAuth, controller.logoutAllHandler);
authRouter.post(
  '/change-password',
  authRateLimiter,
  requireAuth,
  validate(changePasswordSchema),
  controller.changePasswordHandler,
);
