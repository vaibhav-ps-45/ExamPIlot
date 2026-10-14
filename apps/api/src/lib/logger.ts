/**
 * Minimal structured logger. It redacts anything that looks like a secret so
 * tokens, passwords and cookies can never reach the logs.
 */
const REDACTED = '[redacted]';
const SECRET_KEYS = [
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
  'refreshtokenhash',
];

const isSecretKey = (key: string): boolean => {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return SECRET_KEYS.some((secret) => normalized.includes(secret));
};

export const redact = (value: unknown, depth = 0): unknown => {
  if (depth > 6) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((entry) => redact(entry, depth + 1));
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = isSecretKey(key) ? REDACTED : redact(entry, depth + 1);
    }
    return output;
  }
  return value;
};

type Level = 'debug' | 'info' | 'warn' | 'error';

const write = (level: Level, message: string, meta?: Record<string, unknown>): void => {
  if (process.env.NODE_ENV === 'test' && level === 'debug') return;
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === 'error') process.stderr.write(`${serialized}\n`);
  else process.stdout.write(`${serialized}\n`);
};

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};
