import { Router } from 'express';
import { authRouter } from './authRoutes.js';

/**
 * Versioned API router.
 *
 * Mounting under /api/v1 from day one means:
 * - Future breaking changes ship as /api/v2 without touching clients.
 * - The mobile app can pin to a version and upgrade on its own schedule.
 *
 * If we hadn't versioned now, adding /v2 later would require supporting
 * /api/... (unversioned) forever for existing clients.
 */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);