import { Router } from 'express';
import { z } from 'zod';
import { weightController } from '../controllers/weightController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createWeightSchema,
  updateWeightSchema,
  listWeightsQuerySchema,
} from '../validators/weightValidators.js';

const petIdParamsSchema = z.object({ petId: z.string().min(1) });
const weightParamsSchema = z.object({
  petId: z.string().min(1),
  weightId: z.string().min(1),
});

export const weightRouter = Router({ mergeParams: true });

weightRouter.use(authenticate);

weightRouter.get(
  '/',
  validate({ params: petIdParamsSchema, query: listWeightsQuerySchema }),
  asyncHandler(weightController.list),
);

weightRouter.post(
  '/',
  validate({ params: petIdParamsSchema, body: createWeightSchema }),
  asyncHandler(weightController.create),
);

weightRouter.get(
  '/:weightId',
  validate({ params: weightParamsSchema }),
  asyncHandler(weightController.getOne),
);

weightRouter.patch(
  '/:weightId',
  validate({ params: weightParamsSchema, body: updateWeightSchema }),
  asyncHandler(weightController.update),
);

weightRouter.delete(
  '/:weightId',
  validate({ params: weightParamsSchema }),
  asyncHandler(weightController.remove),
);