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
    log: isProduction ? ['error', 'warn'] : ['error', 'warn'],
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (!isProduction) globalForPrisma.prisma = prisma;

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
};
