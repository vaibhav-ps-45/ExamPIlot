import { PrismaClient } from '@prisma/client';
import { env, isProduction } from '../config/env.js';

/**
 * A single client per process. In development the instance is cached on
 * globalThis so `tsx watch` reloads do not exhaust the connection pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Errors are caught and logged at request/scheduler boundaries. Emitting
    // Prisma's raw error event as well would duplicate them on every retry.
    log: ['warn'],
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (!isProduction) globalForPrisma.prisma = prisma;

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};

let databaseAvailable: boolean | null = null;

export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseAvailable = true;
  } catch {
    databaseAvailable = false;
  }
  return databaseAvailable;
};

export const getDatabaseAvailability = (): boolean | null => databaseAvailable;
