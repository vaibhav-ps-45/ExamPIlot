import type { Request, Response } from 'express';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@exampilot/shared';
import { env, isProduction } from '../../config/env.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AppError } from '../../lib/errors.js';
import * as authService from './auth.service.js';

export const REFRESH_COOKIE = 'exampilot_refresh';

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/api/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

const sessionContext = (req: Request) => ({
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
});

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as RegisterInput;
  const result = await authService.register(input, sessionContext(req));
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as LoginInput;
  const result = await authService.login(input, sessionContext(req));
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  res.json({ user: result.user, accessToken: result.accessToken });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw AppError.unauthenticated('No refresh token provided');
  const result = await authService.refresh(token, sessionContext(req));
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  res.json({ user: result.user, accessToken: result.accessToken });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.status(204).send();
});

export const logoutAllHandler = asyncHandler(async (req: Request, res: Response) => {
  const count = await authService.logoutAllSessions(req.auth!.userId);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.json({ revokedSessions: count });
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.auth!.userId);
  res.json({ user });
});

export const changePasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await authService.changePassword(req.auth!.userId, currentPassword, newPassword);
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  res.status(204).send();
});

export const registerBodySchema = registerSchema;
export const loginBodySchema = loginSchema;
