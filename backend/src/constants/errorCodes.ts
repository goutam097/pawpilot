/**
 * Machine-readable error codes returned in error responses.
 *
 * Why a separate code from the HTTP status?
 * - HTTP status is a coarse class (400 vs 404 vs 500).
 * - Clients often need to branch on a specific failure. "Invalid email format"
 *   and "email already registered" are both 400/409, but the mobile app wants
 *   to render a different message and focus a different field.
 * - Codes are stable API contract; human messages can change.
 *
 * Naming: SCREAMING_SNAKE_CASE, prefixed by domain where useful.
 */
export const ERROR_CODES = {
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Auth (used starting Phase 5)
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',

  // Pets / domain (used from Phase 7)
  PET_NOT_FOUND: 'PET_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];