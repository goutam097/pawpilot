import { Router } from 'express';
import { authRouter } from './authRoutes.js';
import { petRouter } from './petRoutes.js';
import { deviceRouter } from './deviceRoutes.js';
import { travelTemplateRouter } from './travelTemplateRoutes.js';
import { lostReportRouter } from './lostPetRoutes.js';
import { placeRouter } from './placeRoutes.js';
import { authenticatedInvitationRouter } from './memberRoutes.js';

/**
 * Versioned API router.
 *
 * Adding a feature: import its router and mount it under a path here.
 * Order doesn't matter for different prefixes.
 */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/pets', petRouter);
apiRouter.use('/devices', deviceRouter);
apiRouter.use('/travel-templates', travelTemplateRouter);
apiRouter.use('/lost-reports', lostReportRouter);
apiRouter.use('/places', placeRouter);
apiRouter.use('/invitations', authenticatedInvitationRouter);