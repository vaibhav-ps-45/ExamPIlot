/**
 * Every failure that reaches a client goes through AppError so the response
 * shape is uniform: { error: { code, message, details? } }.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Marks errors that are safe to show to the client verbatim. */
  readonly expose = true;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  static validation(message = 'Request validation failed', details?: unknown): AppError {
    return new AppError('VALIDATION_ERROR', message, details);
  }

  static unauthenticated(message = 'Authentication required'): AppError {
    return new AppError('UNAUTHENTICATED', message);
  }

  static invalidCredentials(message = 'Invalid email or password'): AppError {
    return new AppError('INVALID_CREDENTIALS', message);
  }

  static forbidden(message = 'You do not have access to this resource'): AppError {
    return new AppError('FORBIDDEN', message);
  }

  static notFound(resource = 'Resource'): AppError {
    return new AppError('NOT_FOUND', `${resource} not found`);
  }

  static conflict(message: string): AppError {
    return new AppError('CONFLICT', message);
  }
}
