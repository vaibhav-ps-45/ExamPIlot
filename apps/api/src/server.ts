import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { startReminderScheduler, stopReminderScheduler } from './modules/reminders/reminder.scheduler.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info('api listening', { port: env.PORT, env: env.NODE_ENV });
  if (!env.REMINDER_SCHEDULER_DISABLED) startReminderScheduler();
});

const shutdown = (signal: string) => {
  logger.info('shutting down', { signal });
  stopReminderScheduler();
  server.close(() => {
    void disconnectPrisma().finally(() => process.exit(0));
  });
  // Do not hang forever on stuck connections.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection', { reason: String(reason) });
});
