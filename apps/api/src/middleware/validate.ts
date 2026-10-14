import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { AppError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Parses and REPLACES req[source] with the validated output, so handlers work
 * with typed, coerced values and never see raw user input.
 */
export const validate =
  <T extends ZodTypeAny>(schema: T, source: Source = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(formatZodError(result.error));
    }
    // Express 4 allows assigning the parsed value back onto the request.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    return next();
  };

export const formatZodError = (error: ZodError): AppError => {
  const details = error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
  const first = details[0];
  const message = first ? `${first.path ? `${first.path}: ` : ''}${first.message}` : 'Request validation failed';
  return AppError.validation(message, details);
};

/** Convenience: validated handler body/query/params types. */
export type ValidatedBody<T extends ZodTypeAny> = z.infer<T>;
