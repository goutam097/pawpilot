import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { validateBody } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authRateLimiter } from '../middlewares/security.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  updatePreferencesSchema,
} from '../validators/authValidators.js';

/**
 * Auth routes mounted at /api/v1/auth.
 *
 * Rate limiting strategy:
 * - register, login: strict (authRateLimiter — 10/15min per IP).
 * - refresh, logout: also strict, because a malicious client could otherwise
 *   brute-force refresh tokens (astronomically unlikely but cheap to prevent).
 * - me, updateProfile: protected by `authenticate`; the global limiter applies.
 *
 * Why asyncHandler on every route: without it, a rejected promise from the
 * controller would hang the request (Express 4 does not catch async throws).
 */
export const authRouter = Router();

authRouter.post(
  '/register',
  authRateLimiter,
  validateBody(registerSchema),
  asyncHandler(authController.register),
);

authRouter.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  asyncHandler(authController.login),
);

authRouter.post(
  '/refresh',
  authRateLimiter,
  validateBody(refreshSchema),
  asyncHandler(authController.refresh),
);

authRouter.post(
  '/logout',
  authRateLimiter,
  validateBody(refreshSchema),
  asyncHandler(authController.logout),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(authController.me),
);

authRouter.patch(
  '/me',
  authenticate,
  validateBody(updateProfileSchema),
  asyncHandler(authController.updateProfile),
);

authRouter.patch(
  '/me/preferences',
  authenticate,
  validateBody(updatePreferencesSchema),
  asyncHandler(authController.updatePreferences),
);