import type { ApiError as ApiErrorShape } from '@exampilot/shared';

/**
 * API client.
 *
 * Auth model (mirrors the backend):
 * - the access token lives in a module-level variable, never in localStorage,
 *   so an XSS payload cannot read it out of storage;
 * - the refresh token is an httpOnly cookie the browser sends automatically,
 *   which is why every request sets `credentials: 'include'`;
 * - a 401 triggers ONE silent refresh, then the original request is retried.
 *   Concurrent 401s share a single in-flight refresh rather than stampeding.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;
/** Notified when the session ends, so the app can route back to sign-in. */
let onSessionExpired: (() => void) | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => accessToken;

export const setSessionExpiredHandler = (handler: (() => void) | null): void => {
  onSessionExpired = handler;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the user simply is not signed in (or the session lapsed). */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Field-level messages, for wiring server validation into a form. */
  get fieldErrors(): Array<{ path: string; message: string }> {
    if (!Array.isArray(this.details)) return [];
    return this.details
      .filter((entry): entry is { path: string; message: string } => {
        return (
          typeof entry === 'object' &&
          entry !== null &&
          'path' in entry &&
          'message' in entry &&
          typeof (entry as { path: unknown }).path === 'string' &&
          typeof (entry as { message: unknown }).message === 'string'
        );
      })
      .map((entry) => ({ path: entry.path, message: entry.message }));
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the refresh-and-retry dance (used by the refresh call itself). */
  skipAuthRetry?: boolean;
  signal?: AbortSignal;
}

const buildHeaders = (hasBody: boolean): HeadersInit => {
  const headers: Record<string, string> = {};
  if (hasBody) headers['content-type'] = 'application/json';
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
};

const parseError = async (response: Response): Promise<ApiError> => {
  try {
    const body = (await response.json()) as ApiErrorShape;
    if (body?.error) {
      return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
  } catch {
    // Fall through to a generic message when the body is not JSON.
  }
  return new ApiError(response.status, 'INTERNAL_ERROR', `Request failed with status ${response.status}`);
};

/**
 * Attempts one silent refresh. Returns true when a new access token was issued.
 * A single promise is shared by all callers so a burst of 401s produces one
 * refresh, not one per request.
 */
const refreshAccessToken = async (): Promise<boolean> => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) return false;
      const body = (await response.json()) as { accessToken: string };
      accessToken = body.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so concurrent callers all observe this result.
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();

  return refreshPromise;
};

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = 'GET', body, skipAuthRetry = false, signal } = options;
  const hasBody = body !== undefined;

  const send = async (): Promise<Response> =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: buildHeaders(hasBody),
      credentials: 'include',
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
      ...(signal ? { signal } : {}),
    });

  let response = await send();

  // One retry after a successful silent refresh. Never loops.
  if (response.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await send();
    } else {
      accessToken = null;
      onSessionExpired?.();
      throw await parseError(response);
    }
  }

  if (response.status === 204) return undefined as T;

  if (!response.ok) throw await parseError(response);

  return (await response.json()) as T;
};

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

/** Builds a query string, dropping empty values so filters stay clean in URLs. */
export const toQueryString = (params: Record<string, unknown>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
};

export { BASE_URL };
