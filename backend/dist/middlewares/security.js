import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { fail } from '../utils/apiResponse.js';
/**
 * Helmet — sets a bundle of security-related headers.
 *
 * The default preset is sensible for a JSON API. Notable headers it sets:
 * - Strict-Transport-Security: force HTTPS for future requests (prod).
 * - X-Content-Type-Options: nosniff — don't MIME-sniff responses.
 * - X-Frame-Options: DENY — no framing (clickjacking).
 * - Referrer-Policy: no-referrer.
 * - Cross-Origin-Resource-Policy: same-origin.
 *
 * We disable `contentSecurityPolicy` because:
 * - This server returns JSON, not HTML. CSP is for HTML documents in browsers.
 * - Leaving it on sometimes breaks tooling that serves API responses in a
 *   browser tab (e.g. Postman web, Swagger UI later).
 * If we ever serve an admin HTML page, we'll re-enable CSP with a proper policy.
 */
export const helmetMiddleware = helmet({
    contentSecurityPolicy: false,
});
/**
 * CORS — controls which browser origins can read responses.
 *
 * In the mobile world, native apps don't enforce CORS (there's no browser
 * origin). But:
 * - Expo web runs in a browser and DOES enforce CORS.
 * - Any future web dashboard will too.
 * - Some proxy setups add an Origin header even for native requests.
 *
 * We use an explicit allowlist from env. No wildcards in production.
 *
 * `credentials: true` matters: we plan to send an Authorization header on
 * every request. Browsers require this to be echoed if any credentials
 * (cookies or Authorization) are sent, and require a specific origin — you
 * cannot use `*` with `credentials: true` (browsers reject it).
 */
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no Origin (native mobile, curl, server-to-server).
        if (!origin)
            return callback(null, true);
        if (env.corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Do NOT throw here — reject cleanly so the client sees a proper CORS
        // error, not a 500. The `cors` package will simply not set the header,
        // and the browser will block the response.
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600, // cache preflight for 10 minutes to reduce OPTIONS traffic
};
export const corsMiddleware = cors(corsOptions);
/**
 * Rate limiting — throttle abusive clients by IP.
 *
 * Two limiters:
 * - Global: generous, protects the whole server from dumb flooding.
 * - (Later, Phase 5) Auth-specific: tight, protects /login and /register from
 *   brute force.
 *
 * We send a JSON 429 envelope (not express-rate-limit's default text),
 * because clients branch on `success: false` uniformly.
 */
export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per window per IP
    standardHeaders: 'draft-7', // emits `RateLimit-*` headers (modern)
    legacyHeaders: false,
    handler: (_req, res) => {
        fail(res, 'Too many requests, please try again later.', HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMITED);
    },
});
/**
 * Auth rate limiter — used on /auth/login and /auth/register from Phase 5.
 * Exported here so it's colocated with the other security knobs, but not
 * applied globally.
 */
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per IP per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
        fail(res, 'Too many authentication attempts, please try again later.', HTTP_STATUS.TOO_MANY_REQUESTS, ERROR_CODES.RATE_LIMITED);
    },
});
/**
 * Public rate limiter — used for unauthenticated HTML/JSON pages.
 *
 * Rationale:
 * - Higher than authRateLimiter (10/15min) because a legitimate user might
 *   refresh a page a few times.
 * - Lower than globalRateLimiter (300/15min) because public endpoints don't
 *   need burst capacity.
 * - Applies per IP.
 */
export const publicRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
        res
            .status(429)
            .type('text/html')
            .send('<!DOCTYPE html><html><head><title>Too many requests</title></head><body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;"><h1>Too many requests</h1><p>Please try again in a few minutes.</p></body></html>');
    },
});
//# sourceMappingURL=security.js.map