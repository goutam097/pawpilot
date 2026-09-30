import { Router } from 'express';
import { z } from 'zod';
import { vaccinationController } from '../controllers/vaccinationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createVaccinationSchema, updateVaccinationSchema, listVaccinationsQuerySchema, } from '../validators/vaccinationValidators.js';
const petIdParamsSchema = z.object({
    petId: z.string().min(1),
});
const vaccinationParamsSchema = z.object({
    petId: z.string().min(1),
    vaccinationId: z.string().min(1),
});
export const vaccinationRouter = Router({ mergeParams: true });
vaccinationRouter.use(authenticate);
vaccinationRouter.get('/', validate({ params: petIdParamsSchema, query: listVaccinationsQuerySchema }), asyncHandler(vaccinationController.list));
vaccinationRouter.post('/', validate({ params: petIdParamsSchema, body: createVaccinationSchema }), asyncHandler(vaccinationController.create));
vaccinationRouter.get('/:vaccinationId', validate({ params: vaccinationParamsSchema }), asyncHandler(vaccinationController.getOne));
vaccinationRouter.patch('/:vaccinationId', validate({ params: vaccinationParamsSchema, body: updateVaccinationSchema }), asyncHandler(vaccinationController.update));
vaccinationRouter.delete('/:vaccinationId', validate({ params: vaccinationParamsSchema }), asyncHandler(vaccinationController.remove));
//# sourceMappingURL=vaccinationRoutes.js.map