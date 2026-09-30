import { Router } from 'express';
import { z } from 'zod';
import { lostPetController } from '../controllers/lostPetController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { publicRateLimiter } from '../middlewares/security.js';
import { createLostPetReportSchema, updateLostPetReportSchema, } from '../validators/lostPetValidators.js';
const petIdParamsSchema = z.object({ petId: z.string().min(1) });
const reportIdParamsSchema = z.object({ reportId: z.string().min(1) });
/**
 * Authenticated routes — mounted under /pets/:petId/lost-report.
 * These let the owner manage their own report.
 */
export const lostPetRouter = Router({ mergeParams: true });
lostPetRouter.use(authenticate);
lostPetRouter.get('/', validate({ params: petIdParamsSchema }), asyncHandler(lostPetController.getActive));
lostPetRouter.post('/', validate({ params: petIdParamsSchema, body: createLostPetReportSchema }), asyncHandler(lostPetController.createOrUpdate));
/**
 * Report management — separate router mounted at /lost-reports.
 * The report id is globally unique; no need to nest under pet.
 */
export const lostReportRouter = Router();
lostReportRouter.use(authenticate);
lostReportRouter.get('/:reportId', validate({ params: reportIdParamsSchema }), asyncHandler(lostPetController.getById));
lostReportRouter.patch('/:reportId', validate({ params: reportIdParamsSchema, body: updateLostPetReportSchema }), asyncHandler(lostPetController.update));
lostReportRouter.post('/:reportId/found', validate({ params: reportIdParamsSchema }), asyncHandler(lostPetController.markFound));
lostReportRouter.post('/:reportId/regenerate-token', validate({ params: reportIdParamsSchema }), asyncHandler(lostPetController.regenerateToken));
lostReportRouter.delete('/:reportId', validate({ params: reportIdParamsSchema }), asyncHandler(lostPetController.remove));
/**
 * Public routes — no auth. Rate-limited.
 */
const tokenParamsSchema = z.object({ token: z.string().min(16).max(64) });
export const publicLostPetRouter = Router();
publicLostPetRouter.use(publicRateLimiter);
publicLostPetRouter.get('/:token', validate({ params: tokenParamsSchema }), asyncHandler(lostPetController.getPublicJson));
//# sourceMappingURL=lostPetRoutes.js.map