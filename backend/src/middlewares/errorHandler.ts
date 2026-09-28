import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { fail } from '../utils/apiResponse.js';
import { HTTP_STATUS, type HttpStatus } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { env } from '../config/env.js';

/**
 * Centralized error handler. Must be registered LAST in createApp().
 *
 * Responsibilities:
 * 1. Log the error with enough context to debug (method, path, stack in dev).
 * 2. Convert the error into the standard error envelope.
 * 3. Never leak internal details to clients for 5xx errors.
 *
 * Notes on Express error middleware:
 * - The signature MUST have exactly four parameters (err, req, res, next).
 *   Express uses arity to distinguish error handlers from regular middleware.
 *   If you drop `next`, Express treats it as a normal middleware and it never runs.
 * - `next` is intentionally unused in most paths, but must be present.
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  // --- Normalize the unknown error into { status, code, message, details } ---

  let status: HttpStatus = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES] = ERROR_CODES.INTERNAL_ERROR;
  let message = 'Internal server error';
  let details: unknown;
  let isOperational = false;

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
    isOperational = err.isOperational;
  } else if (err instanceof ZodError) {
    // Validators will throw ZodError; surface the field issues to the client.
    status = HTTP_STATUS.UNPROCESSABLE_ENTITY;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = 'Validation failed';
    details = err.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
      code: i.code,
    }));
    isOperational = true;
  } else if (isBodyParserSyntaxError(err)) {
    // `express.json()` throws a SyntaxError subclass with a `body` property
    // when the client sends malformed JSON.
    status = HTTP_STATUS.BAD_REQUEST;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = 'Malformed JSON in request body';
    isOperational = true;
  }

  // --- Log ---

  const logPayload = {
    level: status >= 500 ? 'error' : 'warn',
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    message,
    ...(env.isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  };
  const logLine = JSON.stringify(logPayload);
  if (status >= 500) {
    console.error(logLine);
  } else {
    console.warn(logLine);
  }

  // --- Response ---

  // For non-operational (unexpected) 5xx errors, hide the real message from the
  // client. The stack and message are in the logs; the client gets a generic one.
  const clientMessage =
    status >= 500 && !isOperational ? 'Internal server error' : message;

  fail(res, clientMessage, status, code, details);
};

/**
 * Detects the SyntaxError that body-parser (used by express.json) throws on
 * invalid JSON. The class isn't exported, so we duck-type it.
 */
function isBodyParserSyntaxError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    'body' in err &&
    (err as { type?: string }).type === 'entity.parse.failed'
  );
}