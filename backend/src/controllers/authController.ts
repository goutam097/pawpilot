import type { Request, Response } from 'express';
import { authService, serializeUser } from '../services/authService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
  UpdateProfileInput,
  UpdatePreferencesInput,
} from '../validators/authValidators.js';

/**
 * Auth controller — HTTP-layer glue.
 *
 * Responsibilities:
 * - Read validated, typed input (validated by middleware before we get here).
 * - Call the service.
 * - Format the response via `ok()`.
 *
 * That's it. No business logic, no DB. If a controller grows, it's a sign
 * that logic belongs in the service.
 *
 * Type note: we cast `req.body` to the inferred input type. That's safe
 * because the route applies `validateBody(registerSchema)` first, which
 * guarantees the body matches the schema. The cast makes the guarantee
 * explicit at the type level.
 */

interface RequestMeta {
  userAgent: string | null;
  ip: string | null;
}

function extractMeta(req: Request): RequestMeta {
  return {
    userAgent: req.get('user-agent') ?? null,
    ip: req.ip ?? null,
  };
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const input = req.body as RegisterInput;
    const result = await authService.register(input, extractMeta(req));

    ok(
      res,
      {
        user: serializeUser(result.user),
        tokens: result.tokens,
      },
      HTTP_STATUS.CREATED,
    );
  },

  async login(req: Request, res: Response): Promise<void> {
    const input = req.body as LoginInput;
    const result = await authService.login(input, extractMeta(req));

    ok(res, {
      user: serializeUser(result.user),
      tokens: result.tokens,
    });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const input = req.body as RefreshInput;
    const result = await authService.refresh(input.refreshToken, extractMeta(req));

    ok(res, {
      user: serializeUser(result.user),
      tokens: result.tokens,
    });
  },

  async logout(req: Request, res: Response): Promise<void> {
    const input = req.body as RefreshInput;
    await authService.logout(input.refreshToken);
    // 204 No Content — no body to return.
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  async me(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const user = await authService.getCurrentUser(userId);
    ok(res, { user: serializeUser(user) });
  },

  async updateProfile(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const input = req.body as UpdateProfileInput;
    const user = await authService.updateProfile(userId, input);
    ok(res, { user: serializeUser(user) });
  },

  async updatePreferences(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const input = req.body as UpdatePreferencesInput;
    const user = await authService.updatePreferences(userId, input);
    ok(res, { user: serializeUser(user) });
  },
};