import { Router } from 'express';
import { z } from 'zod';
import { petController } from '../controllers/petController.js';
import { reminderRouter } from './reminderRoutes.js';
import { vaccinationRouter } from './vaccinationRoutes.js';
import { medicationRouter } from './medicationRoutes.js';
import { vetVisitRouter } from './vetVisitRoutes.js';
import { expenseRouter } from './expenseRoutes.js';
import { weightRouter } from './weightRoutes.js';
import { timelineRouter } from './timelineRoutes.js';
import { documentRouter } from './documentRoutes.js';
import { travelRouter } from './travelRoutes.js';
import { lostPetRouter } from './lostPetRoutes.js';
import { memberRouter, invitationRouter } from './memberRoutes.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate, validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { uploadSingleFile } from '../middlewares/upload.js';
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
petRouter.use('/:petId/vet-visits', vetVisitRouter);
petRouter.use('/:petId/expenses', expenseRouter);
petRouter.use('/:petId/weights', weightRouter);
petRouter.use('/:petId/timeline', timelineRouter);
petRouter.use('/:petId/documents', documentRouter);
petRouter.use('/:petId/travel-plans', travelRouter);
petRouter.use('/:petId/lost-report', lostPetRouter);
petRouter.use('/:petId/members', memberRouter);
petRouter.use('/:petId/invitations', invitationRouter);

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

petRouter.post(
  '/:petId/photo',
  validate({ params: petIdParamsSchema }),
  uploadSingleFile('photo'),
  asyncHandler(petController.uploadPhoto),
);

