import { Router } from 'express';
import { z } from 'zod';
import { vetVisitController } from '../controllers/vetVisitController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createVetVisitSchema, updateVetVisitSchema, listVetVisitsQuerySchema, } from '../validators/vetVisitValidators.js';
const petIdParamsSchema = z.object({ petId: z.string().min(1) });
const visitParamsSchema = z.object({
    petId: z.string().min(1),
    visitId: z.string().min(1),
});
export const vetVisitRouter = Router({ mergeParams: true });
vetVisitRouter.use(authenticate);
vetVisitRouter.get('/', validate({ params: petIdParamsSchema, query: listVetVisitsQuerySchema }), asyncHandler(vetVisitController.list));
vetVisitRouter.post('/', validate({ params: petIdParamsSchema, body: createVetVisitSchema }), asyncHandler(vetVisitController.create));
vetVisitRouter.get('/:visitId', validate({ params: visitParamsSchema }), asyncHandler(vetVisitController.getOne));
vetVisitRouter.patch('/:visitId', validate({ params: visitParamsSchema, body: updateVetVisitSchema }), asyncHandler(vetVisitController.update));
vetVisitRouter.delete('/:visitId', validate({ params: visitParamsSchema }), asyncHandler(vetVisitController.remove));
//# sourceMappingURL=vetVisitRoutes.js.map