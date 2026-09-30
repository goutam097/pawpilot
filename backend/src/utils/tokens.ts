import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import ms from 'ms';

/**
 * Token utilities.
 *
 * Two kinds of tokens flow through the system:
 *
 * 1. Access token — a short-lived JWT signed and verified with HS256.
 *    Payload: { sub: userId, type: 'access' }.
 *
 * 2. Refresh token — a long-lived random string. Never leaves the server
 *    as anything but an opaque blob. We store a SHA-256 hash of it in Mongo.
 *    The raw string is sent to the client once and never stored server-side.
 *
 * Why SHA-256 for the refresh token hash and not bcrypt?
 * - The token is 64 random bytes → 512 bits of entropy. There is nothing
 *   to brute-force. Bcrypt's deliberate slowness is unnecessary and would
 *   make refresh 250ms slower for no benefit.
 * - SHA-256 is fast and (given the input entropy) collision-resistant.
 *
 * Why access tokens don't live in the DB:
 * - Verification is stateless. Every request verifies the signature, no
 *   DB hit. If we ever need instant access-token revocation, we add a
 *   denylist cache (Redis) — but for a 15-minute token, the cost-benefit
 *   is usually against it.
 */

export interface AccessTokenPayload {
  sub: string;   // user id
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;   // user id
  type: 'refresh';
  jti: string;   // unique token id — future-proofing for denylisting
}

// ---------- Access tokens ---------------------------------------------------

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: 'access' };
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn,
    algorithm: 'HS256',
    issuer: 'pawpilot',
    audience: 'pawpilot-mobile',
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret, {
      algorithms: ['HS256'],
      issuer: 'pawpilot',
      audience: 'pawpilot-mobile',
    }) as AccessTokenPayload;

    if (decoded.type !== 'access') {
      throw new Error('Wrong token type');
    }
    return decoded;
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    throw new AppError(
      isExpired ? 'Access token expired' : 'Invalid access token',
      HTTP_STATUS.UNAUTHORIZED,
      isExpired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID,
    );
  }
}

// ---------- Refresh tokens --------------------------------------------------

/**
 * Generate a fresh refresh token.
 *
 * Returns both the raw value (sent to the client) and the SHA-256 hash
 * (stored in Mongo). The raw value is never persisted anywhere.
 */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(64).toString('base64url');
  const hash = hashRefreshToken(raw);
  return { raw, hash };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Parse the JWT-style refresh expiry string ("30d") into milliseconds.
 * We use this to compute `expiresAt` on the RefreshToken document.
 *
 * We do NOT sign the refresh token as a JWT — the string is opaque. This
 * function only handles converting the env-configured duration into a Date.
 */
/* export function refreshTokenExpiryMs(): number {
  const raw = env.jwtRefreshExpiresIn;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) {
    throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN value: "${raw}". Expected e.g. "30d".`);
  }
  const [, num, unit] = match;
  const n = Number.parseInt(num!, 10);
  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return n * multipliers[unit as keyof typeof multipliers];
} */

  export function refreshTokenExpiryMs(): number {
  const parsed = ms(env.jwtRefreshExpiresIn as ms.StringValue);
  if (typeof parsed !== 'number') {
    throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN value: "${env.jwtRefreshExpiresIn}"`);
  }
  return parsed;
}