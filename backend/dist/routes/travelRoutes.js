import { Router } from 'express';
import { z } from 'zod';
import { travelController } from '../controllers/travelController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createTravelPlanSchema, updateTravelPlanSchema, addChecklistItemSchema, updateChecklistItemSchema, listTravelPlansQuerySchema, } from '../validators/travelValidators.js';
const petIdParamsSchema = z.object({ petId: z.string().min(1) });
const planParamsSchema = z.object({
    petId: z.string().min(1),
    planId: z.string().min(1),
});
const itemParamsSchema = z.object({
    petId: z.string().min(1),
    planId: z.string().min(1),
    itemId: z.string().min(1),
});
export const travelRouter = Router({ mergeParams: true });
travelRouter.use(authenticate);
travelRouter.get('/', validate({ params: petIdParamsSchema, query: listTravelPlansQuerySchema }), asyncHandler(travelController.list));
travelRouter.post('/', validate({ params: petIdParamsSchema, body: createTravelPlanSchema }), asyncHandler(travelController.create));
travelRouter.get('/:planId', validate({ params: planParamsSchema }), asyncHandler(travelController.getOne));
travelRouter.patch('/:planId', validate({ params: planParamsSchema, body: updateTravelPlanSchema }), asyncHandler(travelController.update));
travelRouter.delete('/:planId', validate({ params: planParamsSchema }), asyncHandler(travelController.remove));
// Checklist items
travelRouter.post('/:planId/items', validate({ params: planParamsSchema, body: addChecklistItemSchema }), asyncHandler(travelController.addItem));
travelRouter.patch('/:planId/items/:itemId', validate({ params: itemParamsSchema, body: updateChecklistItemSchema }), asyncHandler(travelController.updateItem));
travelRouter.delete('/:planId/items/:itemId', validate({ params: itemParamsSchema }), asyncHandler(travelController.deleteItem));
//# sourceMappingURL=travelRoutes.js.map