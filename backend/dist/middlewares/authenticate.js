import { verifyAccessToken } from '../utils/tokens.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Bearer-token authentication middleware.
 *
 * On success, sets `req.userId` to the subject of the verified token.
 * On failure, throws an AppError (401) that the centralized error handler
 * formats into the standard envelope.
 *
 * Note: this middleware does NOT check whether the user still exists. That
 * check costs a DB query on every request and mostly isn't needed. If a user
 * is deleted, their access token stays valid for its remaining lifetime —
 * at most 15 minutes. The `/auth/me` endpoint does check existence, so any
 * "who am I?" call will reveal the deletion immediately. This is a common
 * and deliberate tradeoff in JWT-based systems.
 */
export function authenticate(req, _res, next) {
    const header = req.get('authorization');
    if (!header) {
        return next(new AppError('Authorization header missing', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
    }
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
        return next(new AppError('Authorization header must be "Bearer <token>"', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
    }
    const token = parts[1];
    if (!token) {
        return next(new AppError('Authorization token missing', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED));
    }
    try {
        const payload = verifyAccessToken(token);
        req.userId = payload.sub;
        next();
    }
    catch (err) {
        // verifyAccessToken already throws AppError with proper code.
        next(err);
    }
}
//# sourceMappingURL=authenticate.js.map