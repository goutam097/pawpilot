import { Router } from 'express';
import { authRouter } from './authRoutes.js';
import { petRouter } from './petRoutes.js';
/**
 * Versioned API router.
 *
 * Adding a feature: import its router and mount it under a path here.
 * Order doesn't matter for different prefixes.
 */
export const apiRouter = Router();
apiRouter.use('/auth', authRouter);
apiRouter.use('/pets', petRouter);
//# sourceMappingURL=index.js.map