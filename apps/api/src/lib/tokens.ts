import crypto from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errors.js';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  sid: string;
}

/**
 * Access tokens are short-lived and held in memory by the client only.
 * Refresh tokens are opaque random strings: the server stores a SHA-256 hash,
 * so a database leak does not hand over usable sessions.
 */
export const signAccessToken = (userId: string, sessionId: string): string =>
  jwt.sign({ sub: userId, sid: sessionId }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'exampilot',
    audience: 'exampilot-web',
  });

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'exampilot',
      audience: 'exampilot-web',
    });
    if (typeof decoded === 'string' || !decoded.sub || typeof decoded.sid !== 'string') {
      throw new Error('malformed payload');
    }
    return decoded as AccessTokenPayload;
  } catch {
    throw AppError.unauthenticated('Invalid or expired access token');
  }
};

export const generateRefreshToken = (): string => crypto.randomBytes(48).toString('base64url');

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/**
 * Refresh tokens are salted with the refresh secret before hashing so that a
 * leaked database alone cannot be brute-forced against known token values.
 */
export const hashRefreshToken = (token: string): string =>
  crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');

export const refreshTokenExpiry = (from = new Date()): Date =>
  new Date(from.getTime() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
