/**
 * Named HTTP status codes.
 *
 * Why not use raw numbers?
 * - `res.status(404)` vs `res.status(HTTP_STATUS.NOT_FOUND)` — the latter is greppable
 *   and immune to typos (e.g. `401` vs `410`).
 * - When a status appears in multiple places, one symbol centralizes the meaning.
 * - `as const` gives literal types; `HttpStatus` becomes a union of the values.
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  GONE: 410,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];