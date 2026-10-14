import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

/**
 * Environment validation. The process refuses to start with a bad or missing
 * configuration rather than failing later at request time. Secrets are never
 * logged: see `lib/logger.ts`.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    REMINDER_SWEEP_INTERVAL_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
    REMINDER_SCHEDULER_DISABLED: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),
    AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(20),
    API_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(1),
    API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100000).default(300),
    COOKIE_DOMAIN: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    const insecure = ['dev-only', 'replace-me', 'change-me', 'secret'];
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (insecure.some((needle) => value[key].toLowerCase().includes(needle))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} still looks like a development placeholder`,
        });
      }
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'Refresh secret must differ from the access secret',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Deliberately not printing values, only field names and reasons.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
