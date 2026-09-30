import { Router } from 'express';
import { z } from 'zod';
import { reminderController } from '../controllers/reminderController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createReminderSchema, updateReminderSchema, listRemindersQuerySchema, } from '../validators/reminderValidators.js';
/**
 * Reminder routes.
 *
 * These are mounted under `/pets/:petId/reminders`, so the params schema
 * needs to know about both `petId` and `reminderId` (where applicable).
 *
 * Why a router mounted under a subpath instead of a flat `/reminders`?
 * - The URL structure mirrors the domain: reminders belong to pets.
 * - Ownership verification is naturally scoped to the pet.
 * - A future "all reminders across pets" endpoint lives at `/reminders`
 *   (top-level), separate from per-pet reminders.
 */
const petIdParamsSchema = z.object({
    petId: z.string().min(1, 'petId is required'),
});
const reminderParamsSchema = z.object({
    petId: z.string().min(1, 'petId is required'),
    reminderId: z.string().min(1, 'reminderId is required'),
});
/**
 * `mergeParams: true` is required because we're mounting this router under
 * `/pets/:petId/reminders`. Without it, the parent's `petId` param would not
 * be visible to this router's handlers.
 */
export const reminderRouter = Router({ mergeParams: true });
reminderRouter.use(authenticate);
reminderRouter.get('/', validate({ params: petIdParamsSchema, query: listRemindersQuerySchema }), asyncHandler(reminderController.list));
reminderRouter.post('/', validate({ params: petIdParamsSchema, body: createReminderSchema }), asyncHandler(reminderController.create));
reminderRouter.get('/:reminderId', validate({ params: reminderParamsSchema }), asyncHandler(reminderController.getOne));
reminderRouter.patch('/:reminderId', validate({ params: reminderParamsSchema, body: updateReminderSchema }), asyncHandler(reminderController.update));
reminderRouter.patch('/:reminderId/complete', validate({ params: reminderParamsSchema }), asyncHandler(reminderController.complete));
reminderRouter.delete('/:reminderId', validate({ params: reminderParamsSchema }), asyncHandler(reminderController.remove));
//# sourceMappingURL=reminderRoutes.js.map