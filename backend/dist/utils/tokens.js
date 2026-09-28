import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import ms from 'ms';
// ---------- Access tokens ---------------------------------------------------
export function signAccessToken(userId) {
    const payload = { sub: userId, type: 'access' };
    return jwt.sign(payload, env.jwtAccessSecret, {
        expiresIn: env.jwtAccessExpiresIn,
        issuer: 'pawpilot',
        audience: 'pawpilot-mobile',
    });
}
export function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, env.jwtAccessSecret, {
            issuer: 'pawpilot',
            audience: 'pawpilot-mobile',
        });
        if (decoded.type !== 'access') {
            throw new Error('Wrong token type');
        }
        return decoded;
    }
    catch (err) {
        const isExpired = err instanceof jwt.TokenExpiredError;
        throw new AppError(isExpired ? 'Access token expired' : 'Invalid access token', HTTP_STATUS.UNAUTHORIZED, isExpired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID);
    }
}
// ---------- Refresh tokens --------------------------------------------------
/**
 * Generate a fresh refresh token.
 *
 * Returns both the raw value (sent to the client) and the SHA-256 hash
 * (stored in Mongo). The raw value is never persisted anywhere.
 */
export function generateRefreshToken() {
    const raw = crypto.randomBytes(64).toString('base64url');
    const hash = hashRefreshToken(raw);
    return { raw, hash };
}
export function hashRefreshToken(raw) {
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
export function refreshTokenExpiryMs() {
    const parsed = ms(env.jwtRefreshExpiresIn);
    if (typeof parsed !== 'number') {
        throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN value: "${env.jwtRefreshExpiresIn}"`);
    }
    return parsed;
}
//# sourceMappingURL=tokens.js.map