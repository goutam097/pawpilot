import { Router } from 'express';
import { z } from 'zod';
import { timelineController } from '../controllers/timelineController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { timelineQuerySchema } from '../validators/timelineValidators.js';

const petIdParamsSchema = z.object({ petId: z.string().min(1) });

export const timelineRouter = Router({ mergeParams: true });

timelineRouter.use(authenticate);

timelineRouter.get(
  '/',
  validate({ params: petIdParamsSchema, query: timelineQuerySchema }),
  asyncHandler(timelineController.get),
);