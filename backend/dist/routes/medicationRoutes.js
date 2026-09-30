import { Router } from 'express';
import { z } from 'zod';
import { medicationController } from '../controllers/medicationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createMedicationSchema, updateMedicationSchema, listMedicationsQuerySchema, } from '../validators/medicationValidators.js';
const petIdParamsSchema = z.object({ petId: z.string().min(1) });
const medicationParamsSchema = z.object({
    petId: z.string().min(1),
    medicationId: z.string().min(1),
});
export const medicationRouter = Router({ mergeParams: true });
medicationRouter.use(authenticate);
medicationRouter.get('/', validate({ params: petIdParamsSchema, query: listMedicationsQuerySchema }), asyncHandler(medicationController.list));
medicationRouter.post('/', validate({ params: petIdParamsSchema, body: createMedicationSchema }), asyncHandler(medicationController.create));
medicationRouter.get('/:medicationId', validate({ params: medicationParamsSchema }), asyncHandler(medicationController.getOne));
medicationRouter.patch('/:medicationId', validate({ params: medicationParamsSchema, body: updateMedicationSchema }), asyncHandler(medicationController.update));
medicationRouter.delete('/:medicationId', validate({ params: medicationParamsSchema }), asyncHandler(medicationController.remove));
//# sourceMappingURL=medicationRoutes.js.map