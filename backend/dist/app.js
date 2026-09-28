import express from 'express';
import { env } from './config/env.js';
import { ok } from './utils/apiResponse.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { helmetMiddleware, corsMiddleware, globalRateLimiter, } from './middlewares/security.js';
import { apiRouter } from './routes/index.js';
/**
 * Builds and returns a fully-configured Express application.
 *
 * Middleware order (see Phase 4 notes for the reasoning):
 *   1. requestLogger
 *   2. helmet
 *   3. cors
 *   4. globalRateLimiter
 *   5. body parsers
 *   6. routes (/api/v1/*)
 *   7. notFound
 *   8. errorHandler
 */
export function createApp() {
    const app = express();
    app.use(requestLogger);
    app.use(helmetMiddleware);
    app.use(corsMiddleware);
    app.use(globalRateLimiter);
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    // Health check lives outside /api/v1 — infrastructure tools should be able
    // to hit it without knowing about API versioning.
    app.get('/health', (_req, res) => {
        ok(res, {
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            env: env.nodeEnv,
        });
    });
    // Versioned API
    app.use('/api/v1', apiRouter);
    app.use(notFound);
    app.use(errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map