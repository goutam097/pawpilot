import { authService, serializeUser } from '../services/authService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
function extractMeta(req) {
    return {
        userAgent: req.get('user-agent') ?? null,
        ip: req.ip ?? null,
    };
}
export const authController = {
    async register(req, res) {
        const input = req.body;
        const result = await authService.register(input, extractMeta(req));
        ok(res, {
            user: serializeUser(result.user),
            tokens: result.tokens,
        }, HTTP_STATUS.CREATED);
    },
    async login(req, res) {
        const input = req.body;
        const result = await authService.login(input, extractMeta(req));
        ok(res, {
            user: serializeUser(result.user),
            tokens: result.tokens,
        });
    },
    async refresh(req, res) {
        const input = req.body;
        const result = await authService.refresh(input.refreshToken, extractMeta(req));
        ok(res, {
            user: serializeUser(result.user),
            tokens: result.tokens,
        });
    },
    async logout(req, res) {
        const input = req.body;
        await authService.logout(input.refreshToken);
        // 204 No Content — no body to return.
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
    async me(req, res) {
        const { userId } = req;
        const user = await authService.getCurrentUser(userId);
        ok(res, { user: serializeUser(user) });
    },
    async updateProfile(req, res) {
        const { userId } = req;
        const input = req.body;
        const user = await authService.updateProfile(userId, input);
        ok(res, { user: serializeUser(user) });
    },
};
//# sourceMappingURL=authController.js.map