import { Router } from 'express';
import { petController } from '../controllers/petController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate, validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createPetSchema,
  updatePetSchema,
  listPetsQuerySchema,
} from '../validators/petValidators.js';
import { z } from 'zod';

const petIdParamsSchema = z.object({
  petId: z.string().min(1, 'petId is required'),
});

export const petRouter = Router();

petRouter.use(authenticate);

petRouter.post(
  '/',
  validateBody(createPetSchema),
  asyncHandler(petController.create),
);

petRouter.get(
  '/',
  validate({ query: listPetsQuerySchema }),
  asyncHandler(petController.list),
);

petRouter.get(
  '/:petId/dashboard',
  validate({ params: petIdParamsSchema }),
  asyncHandler(petController.getDashboard),
);

petRouter.get(
  '/:petId',
  validate({ params: petIdParamsSchema }),
  asyncHandler(petController.getOne),
);

petRouter.patch(
  '/:petId',
  validate({ params: petIdParamsSchema, body: updatePetSchema }),
  asyncHandler(petController.update),
);

petRouter.post(
  '/:petId/archive',
  validate({ params: petIdParamsSchema }),
  asyncHandler(petController.archive),
);

petRouter.post(
  '/:petId/unarchive',
  validate({ params: petIdParamsSchema }),
  asyncHandler(petController.unarchive),
);

petRouter.delete(
  '/:petId',
  validate({ params: petIdParamsSchema }),
  asyncHandler(petController.remove),
);