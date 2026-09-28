import { authRepository } from '../repositories/authRepository.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signAccessToken, generateRefreshToken, hashRefreshToken, refreshTokenExpiryMs, } from '../utils/tokens.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Public-facing user shape. Deliberately omits internal fields and converts
 * the ObjectId to a string. If we ever add sensitive fields to the model,
 * they don't leak by default.
 */
export function serializeUser(user) {
    return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
async function issueTokens(user, meta) {
    const accessToken = signAccessToken(user._id.toString());
    const { raw: refreshTokenRaw, hash: refreshTokenHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + refreshTokenExpiryMs());
    await authRepository.createRefreshToken({
        userId: user._id,
        tokenHash: refreshTokenHash,
        expiresAt,
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
    });
    return {
        accessToken,
        refreshToken: refreshTokenRaw,
        accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
        refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    };
}
export const authService = {
    async register(input, meta) {
        const existing = await authRepository.findUserByEmail(input.email);
        if (existing) {
            throw new AppError('An account with this email already exists', HTTP_STATUS.CONFLICT, ERROR_CODES.EMAIL_ALREADY_REGISTERED);
        }
        const passwordHash = await hashPassword(input.password);
        const user = await authRepository.createUser({
            email: input.email,
            passwordHash,
            name: input.name,
        });
        const tokens = await issueTokens(user, meta);
        return { user, tokens };
    },
    async login(input, meta) {
        const user = await authRepository.findUserByEmailWithPassword(input.email);
        // Timing consideration: if the user doesn't exist, we skip bcrypt entirely,
        // which is detectable via response time. To blunt user enumeration, we
        // could run a dummy bcrypt compare. For PawPilot's threat model, we accept
        // the timing signal and rely on the 401 + identical message. (Add dummy
        // compare in Phase 28 security audit if desired.)
        if (!user) {
            throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
        }
        const passwordHash = typeof user.passwordHash === 'string' ? user.passwordHash : null;
        if (!passwordHash) {
            throw new AppError('User account is missing a password hash', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
        }
        const passwordOk = await verifyPassword(input.password, passwordHash);
        if (!passwordOk) {
            // Same error as "user not found" — the client can't distinguish.
            throw new AppError('Invalid email or password', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
        }
        const tokens = await issueTokens(user, meta);
        return { user, tokens };
    },
    /**
     * Refresh flow with rotation:
     *   1. Client presents old refresh token (raw).
     *   2. Server hashes it and looks it up.
     *   3. If found and unexpired: delete it, issue a fresh pair.
     *   4. If not found: 401. This also implicitly detects reuse — if an attacker
     *      stole a token and used it before the legit user, the legit user's next
     *      refresh will fail (their token was deleted). For now we treat that as
     *      a plain 401. Phase 28 will add reuse detection: on failed lookup,
     *      nuke all of the user's tokens.
     */
    async refresh(rawRefreshToken, meta) {
        const hash = hashRefreshToken(rawRefreshToken);
        const record = await authRepository.findRefreshTokenByHash(hash);
        if (!record) {
            throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_INVALID);
        }
        if (record.expiresAt.getTime() < Date.now()) {
            // TTL index may not have swept yet — enforce expiry in code.
            await authRepository.deleteRefreshTokenByHash(hash);
            throw new AppError('Refresh token expired', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_EXPIRED);
        }
        const user = await authRepository.findUserById(record.userId);
        if (!user) {
            // Token references a deleted user. Clean up and reject.
            await authRepository.deleteRefreshTokenByHash(hash);
            throw new AppError('Invalid refresh token', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.TOKEN_INVALID);
        }
        // Rotate: delete old, issue new.
        await authRepository.deleteRefreshTokenByHash(hash);
        const tokens = await issueTokens(user, meta);
        return { user, tokens };
    },
    async logout(rawRefreshToken) {
        const hash = hashRefreshToken(rawRefreshToken);
        // No error if the token is already gone — logout should be idempotent.
        await authRepository.deleteRefreshTokenByHash(hash);
    },
    async logoutAll(userId) {
        await authRepository.deleteAllRefreshTokensForUser(userId);
    },
    async getCurrentUser(userId) {
        const user = await authRepository.findUserById(userId);
        if (!user) {
            // The access token was valid but the user no longer exists (deleted).
            // Treat as unauthorized — the client must re-login.
            throw new AppError('User no longer exists', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
        }
        return user;
    },
    async updateProfile(userId, input) {
        if (input.name === undefined) {
            // Should be prevented by the validator, but be defensive.
            throw new AppError('No fields to update', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
        }
        const updated = await authRepository.updateUserName(userId, input.name);
        if (!updated) {
            throw new AppError('User not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.UNAUTHORIZED);
        }
        return updated;
    },
};
//# sourceMappingURL=authService.js.map