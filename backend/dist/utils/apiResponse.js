import { HTTP_STATUS } from '../constants/httpStatus.js';
/**
 * Send a success response.
 *
 * `res` is passed in rather than returned so that a controller can simply do:
 *   return ok(res, pets);
 * That pattern plays nicely with `asyncHandler` and early returns.
 */
export function ok(res, data, statusCode = HTTP_STATUS.OK, meta) {
    const body = { success: true, data };
    if (meta !== undefined)
        body.meta = meta;
    return res.status(statusCode).json(body);
}
/**
 * Send an error response.
 *
 * In practice, controllers should THROW AppError rather than call fail() directly,
 * because the centralized error handler guarantees uniform logging and shape.
 * fail() is used by middlewares that already know they want to short-circuit
 * (e.g. the not-found handler, the 429 rate-limit handler).
 */
export function fail(res, message, statusCode, code, details) {
    const body = { success: false, message, code };
    if (details !== undefined)
        body.details = details;
    return res.status(statusCode).json(body);
}
//# sourceMappingURL=apiResponse.js.map