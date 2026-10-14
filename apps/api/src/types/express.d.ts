import type { AccessTokenPayload } from '../lib/tokens.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. Present only on authenticated routes. */
      auth?: {
        userId: string;
        sessionId: string;
        payload: AccessTokenPayload;
      };
    }
  }
}

export {};
