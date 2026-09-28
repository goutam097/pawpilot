import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * The one error type the backend throws intentionally.
 *
 * Design goals:
 * - Carries an HTTP status and machine-readable code so the error handler can
 *   build a response without inspecting the message.
 * - Distinguishes "operational" errors (bad input, not found — expected, safe
 *   to expose) from "programmer" errors (undefined variable, DB down — should
 *   be logged with a stack, response says "internal error").
 * - Extends the native Error so `instanceof AppError` works and stacks are kept.
 *
 * Conventions:
 * - `new AppError(...)` for anything we deliberately raise.
 * - Throw anything else (native Error, Mongo errors, etc.) and the error
 *   handler will treat it as a programmer error → 500, generic message.
 */
export class AppError extends Error {
    statusCode;
    code;
    isOperational;
    details;
    constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, code = ERROR_CODES.INTERNAL_ERROR, options) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = options?.isOperational ?? true;
        this.details = options?.details;
        // Fix prototype chain when targeting ES5/ES2015 (harmless in ES2022, but
        // makes `instanceof` robust if we ever downgrade the target).
        Object.setPrototypeOf(this, AppError.prototype);
        // Keep V8 from trimming our stack trace in some engines.
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, AppError);
        }
    }
    /** 4xx = client's fault, safe to expose. 5xx = our fault, hide details. */
    static isClientError(err) {
        return err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500;
    }
}
//# sourceMappingURL=AppError.js.map