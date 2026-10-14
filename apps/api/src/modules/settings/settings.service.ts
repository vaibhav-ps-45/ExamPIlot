import type { UpdateSettingsInput } from '@exampilot/shared';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';

export const getSettings = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timeZone: true, settings: true },
  });
  if (!user) throw AppError.unauthenticated();

  // A settings row is created with the user; upsert here covers legacy rows.
  const settings =
    user.settings ??
    (await prisma.userSettings.create({
      data: { userId, defaultTimeZone: user.timeZone },
    }));

  return {
    theme: settings.theme,
    defaultTimeZone: settings.defaultTimeZone,
    browserNotificationsEnabled: settings.browserNotificationsEnabled,
    inAppNotificationsEnabled: settings.inAppNotificationsEnabled,
  };
};

export const updateSettings = async (userId: string, input: UpdateSettingsInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  if (!user) throw AppError.unauthenticated();

  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, defaultTimeZone: user.timeZone, ...input },
    update: { ...input },
  });

  return getSettings(userId);
};

export const updateProfile = async (
  userId: string,
  input: { displayName?: string; timeZone?: string },
) => {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.timeZone !== undefined ? { timeZone: input.timeZone } : {}),
    },
    select: { id: true, email: true, displayName: true, timeZone: true, createdAt: true },
  });
  return {
    id: updated.id,
    email: updated.email,
    displayName: updated.displayName,
    timeZone: updated.timeZone,
    createdAt: updated.createdAt.toISOString(),
  };
};

/** Active sessions for the account, so a user can see and revoke them. */
export const listSessions = async (userId: string, currentSessionId: string) => {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    isCurrent: session.id === currentSessionId,
  }));
};

export const revokeSession = async (userId: string, sessionId: string): Promise<void> => {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!session || session.userId !== userId) throw AppError.notFound('Session');
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
};
