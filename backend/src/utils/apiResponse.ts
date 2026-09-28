import type { Response } from 'express';
import { HTTP_STATUS, type HttpStatus } from '../constants/httpStatus.js';
import type { ErrorCode } from '../constants/errorCodes.js';

/**
 * The canonical success envelope.
 *
 * Every successful response in the API looks like:
 *   { "success": true, "data": <payload> }
 *
 * Why an envelope at all?
 * - A client can check `success` before touching `data` — one guard for every
 *   endpoint rather than "is this an array? an object? a string?".
 * - Room for future additions (pagination metadata, warnings) without breaking
 *   the contract: add `meta` next to `data`, old clients ignore it.
 * - Symmetric with the error envelope, which has `success: false`.
 *
 * Why not return the payload directly (REST purist stance)?
 * - Purity is nice, but the reality is that HTTP status codes are already a
 *   coarse channel and clients need richer structure. Uniform envelopes are
 *   the pragmatic industry norm for app backends (Stripe, GitHub, etc.).
 */
export interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorBody {
  success: false;
  message: string;
  code: ErrorCode;
  details?: unknown;
}

/**
 * Send a success response.
 *
 * `res` is passed in rather than returned so that a controller can simply do:
 *   return ok(res, pets);
 * That pattern plays nicely with `asyncHandler` and early returns.
 */
export function ok<T>(
  res: Response,
  data: T,
  statusCode: HttpStatus = HTTP_STATUS.OK,
  meta?: Record<string, unknown>,
): Response {
  const body: SuccessBody<T> = { success: true, data };
  if (meta !== undefined) body.meta = meta;
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
export function fail(
  res: Response,
  message: string,
  statusCode: HttpStatus,
  code: ErrorCode,
  details?: unknown,
): Response {
  const body: ErrorBody = { success: false, message, code };
  if (details !== undefined) body.details = details;
  return res.status(statusCode).json(body);
}