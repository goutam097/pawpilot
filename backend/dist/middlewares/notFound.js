import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Catches any request that didn't match a route and forwards it to the
 * centralized error handler as a proper AppError.
 *
 * Why not send the 404 response here directly?
 * - Uniformity: every error (404, 500, 422...) should go through the same
 *   logging path. If we replied here, 404s would skip the error logger.
 * - Simplicity: one place to change if the error envelope changes.
 *
 * Why is this middleware not in errorHandler.ts?
 * - Different concern. `notFound` sits at the end of the *route* chain;
 *   `errorHandler` sits at the end of the *error* chain. They run at
 *   different points in the pipeline.
 */
export function notFound(req, _res, next) {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND, ERROR_CODES.ROUTE_NOT_FOUND));
}
//# sourceMappingURL=notFound.js.map