import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

const extractBearer = (header: string | undefined): string | null => {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

/**
 * Verifies the access token AND that its session is still alive. Checking the
 * session row means a revoked/logged-out session cannot be used until the
 * access token would have expired on its own.
 */
export const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = extractBearer(req.headers.authorization);
    if (!token) throw AppError.unauthenticated();

    const payload = verifyAccessToken(token);

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthenticated('Session is no longer valid');
    }
    if (session.userId !== payload.sub) {
      // Defensive: a token whose subject does not match its session is forged.
      throw AppError.unauthenticated('Session mismatch');
    }

    req.auth = { userId: payload.sub, sessionId: session.id, payload };
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Guard for routes that must only run for the authenticated owner. */
export const assertOwnership = (resourceUserId: string | null | undefined, userId: string): void => {
  if (!resourceUserId || resourceUserId !== userId) {
    // 404 rather than 403: do not confirm the existence of another user's row.
    throw AppError.notFound();
  }
};
