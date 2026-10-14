import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { isProduction } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { formatZodError } from './validate.js';
import { ZodError } from 'zod';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route matches ${req.method} ${req.path}` },
  });
};

/**
 * Terminal error middleware. It never leaks stack traces or database details
 * to the client in production, and always logs with secrets redacted.
 */
export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = formatZodError(error);
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    appError = mapPrismaError(error);
  } else if (error instanceof SyntaxError && 'body' in error) {
    appError = new AppError('VALIDATION_ERROR', 'Malformed JSON body');
  } else {
    appError = new AppError('INTERNAL_ERROR', 'Something went wrong');
  }

  const logMeta = {
    code: appError.code,
    status: appError.status,
    method: req.method,
    path: req.originalUrl,
    userId: req.auth?.userId,
    ...(appError.status >= 500 ? { stack: error instanceof Error ? error.stack : String(error) } : {}),
  };

  if (appError.status >= 500) logger.error('request failed', logMeta);
  else logger.warn('request rejected', logMeta);

  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code: appError.code, message: appError.message },
  };
  if (appError.details !== undefined) body.error.details = appError.details;
  if (!isProduction && appError.status >= 500 && error instanceof Error) {
    body.error.details = { stack: error.stack?.split('\n').slice(0, 5) };
  }

  res.status(appError.status).json(body);
};

/**
 * Translates Prisma's error codes into API errors. Note that a unique-constraint
 * violation is reported as a conflict WITHOUT echoing the offending value.
 */
export const mapPrismaError = (error: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (error.code) {
    case 'P2002': {
      const target = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]) : [];
      return AppError.conflict(
        target.length ? `A record with this ${target.join(', ')} already exists` : 'Record already exists',
      );
    }
    case 'P2003':
      return new AppError('VALIDATION_ERROR', 'Referenced record does not exist');
    case 'P2025':
      return AppError.notFound();
    case 'P2000':
      return new AppError('VALIDATION_ERROR', 'A value is too long for its field');
    default:
      return new AppError('INTERNAL_ERROR', 'Database error');
  }
};
