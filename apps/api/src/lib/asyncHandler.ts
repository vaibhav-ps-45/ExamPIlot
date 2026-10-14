import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async handler so rejected promises reach the error middleware
 * instead of becoming unhandled rejections.
 */
export const asyncHandler =
  <T extends RequestHandler>(handler: T): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
