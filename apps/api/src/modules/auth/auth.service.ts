import bcrypt from 'bcryptjs';
import type { LoginInput, RegisterInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from '../../lib/tokens.js';
import { logger } from '../../lib/logger.js';

const BCRYPT_ROUNDS = 12;

export interface SessionContext {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    timeZone: string;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const toPublicUser = (user: {
  id: string;
  email: string;
  displayName: string;
  timeZone: string;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  timeZone: user.timeZone,
  createdAt: user.createdAt.toISOString(),
});

/**
 * Creates a session row and returns the raw refresh token. Only the HMAC of
 * the token is persisted.
 */
const issueSession = async (
  user: { id: string; email: string; displayName: string; timeZone: string; createdAt: Date },
  context: SessionContext,
): Promise<AuthResult> => {
  const refreshToken = generateRefreshToken();
  const expiresAt = refreshTokenExpiry();

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      userAgent: context.userAgent?.slice(0, 300) ?? null,
      ipAddress: context.ipAddress?.slice(0, 60) ?? null,
      expiresAt,
    },
    select: { id: true },
  });

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user.id, session.id),
    refreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
};

export const register = async (input: RegisterInput, context: SessionContext): Promise<AuthResult> => {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw AppError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // The user row, its settings row and the first session are one logical unit.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        displayName: input.displayName,
        timeZone: input.timeZone,
        settings: { create: { defaultTimeZone: input.timeZone } },
      },
      select: { id: true, email: true, displayName: true, timeZone: true, createdAt: true },
    });
    return created;
  });

  logger.info('user registered', { userId: user.id });
  return issueSession(user, context);
};

export const login = async (input: LoginInput, context: SessionContext): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, displayName: true, timeZone: true, createdAt: true, passwordHash: true },
  });

  // Compare against a dummy hash when the user is missing so the response time
  // does not reveal whether an email is registered.
  const dummyHash = '$2a$12$0000000000000000000000000000000000000000000000000000';
  const matches = await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);

  if (!user || !matches) {
    logger.warn('failed login attempt', { email: input.email });
    throw AppError.invalidCredentials();
  }

  return issueSession(user, context);
};

export interface RefreshResult {
  user: AuthResult['user'];
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/**
 * Rotating refresh: the presented token is invalidated and a new one issued in
 * the same transaction. A reused (already-rotated) token revokes the whole
 * session, which is the standard detection for a stolen token.
 */
export const refresh = async (rawToken: string, context: SessionContext): Promise<RefreshResult> => {
  const tokenHash = hashRefreshToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: tokenHash },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: {
        select: { id: true, email: true, displayName: true, timeZone: true, createdAt: true },
      },
    },
  });

  if (!session) throw AppError.unauthenticated('Invalid refresh token');

  if (session.revokedAt) {
    // Token replay: kill every session for this user.
    await prisma.session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn('refresh token reuse detected; all sessions revoked', { userId: session.userId });
    throw AppError.unauthenticated('Refresh token has already been used');
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    throw AppError.unauthenticated('Refresh token has expired');
  }

  const newRefreshToken = generateRefreshToken();
  const expiresAt = refreshTokenExpiry();

  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        userAgent: context.userAgent?.slice(0, 300) ?? null,
        ipAddress: context.ipAddress?.slice(0, 60) ?? null,
      },
    });
    await tx.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: hashRefreshToken(newRefreshToken),
        userAgent: context.userAgent?.slice(0, 300) ?? null,
        ipAddress: context.ipAddress?.slice(0, 60) ?? null,
        expiresAt,
      },
    });
  });

  return {
    user: toPublicUser(session.user),
    accessToken: signAccessToken(session.userId, session.id),
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt: expiresAt,
  };
};

export const logout = async (rawToken: string | undefined): Promise<void> => {
  if (!rawToken) return;
  await prisma.session.updateMany({
    where: { refreshTokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const logoutAllSessions = async (userId: string): Promise<number> => {
  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, timeZone: true, createdAt: true },
  });
  if (!user) throw AppError.unauthenticated('Account no longer exists');
  return toPublicUser(user);
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw AppError.unauthenticated();

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw AppError.invalidCredentials('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    // Changing a password invalidates every existing session except none:
    // the user must sign in again everywhere, including here.
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  logger.info('password changed; all sessions revoked', { userId });
};
