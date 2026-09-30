import { Router } from 'express';
import { z } from 'zod';
import { petController } from '../controllers/petController.js';
import { reminderRouter } from './reminderRoutes.js';
import { vaccinationRouter } from './vaccinationRoutes.js';
import { medicationRouter } from './medicationRoutes.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate, validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createPetSchema,
  updatePetSchema,
  listPetsQuerySchema,
} from '../validators/petValidators.js';

const petIdParamsSchema = z.object({
  petId: z.string().min(1, 'petId is required'),
});

export const petRouter = Router();

petRouter.use(authenticate);

// --- Pet sub-resources (mount first, in order of specificity) --------------
// Sub-resources must be mounted BEFORE the `/:petId` catch-alls, because
// `/:petId` would match `/pets/abc/reminders` if it were a single segment...
// actually no — `/:petId` only matches one segment. But mounting sub-resources
// first is a good convention to keep.
petRouter.use('/:petId/reminders', reminderRouter);
petRouter.use('/:petId/vaccinations', vaccinationRouter);
petRouter.use('/:petId/medications', medicationRouter);

// --- Pet CRUD ---------------------------------------------------------------
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

