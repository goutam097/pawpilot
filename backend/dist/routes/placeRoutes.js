import { Router } from 'express';
import { z } from 'zod';
import { placeController } from '../controllers/placeController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { searchPlacesQuerySchema, createOrUpdateReviewSchema, } from '../validators/placeValidators.js';
const placeIdParamsSchema = z.object({ placeId: z.string().min(1) });
export const placeRouter = Router();
placeRouter.use(authenticate);
placeRouter.get('/', validate({ query: searchPlacesQuerySchema }), asyncHandler(placeController.search));
placeRouter.get('/:placeId', validate({ params: placeIdParamsSchema }), asyncHandler(placeController.getById));
placeRouter.post('/:placeId/reviews', validate({ params: placeIdParamsSchema, body: createOrUpdateReviewSchema }), asyncHandler(placeController.upsertReview));
placeRouter.delete('/:placeId/reviews', validate({ params: placeIdParamsSchema }), asyncHandler(placeController.deleteReview));
//# sourceMappingURL=placeRoutes.js.map