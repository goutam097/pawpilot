import { Router } from 'express';
import { z } from 'zod';
import { expenseController } from '../controllers/expenseController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  statsQuerySchema,
} from '../validators/expenseValidators.js';

const petIdParamsSchema = z.object({ petId: z.string().min(1) });
const expenseParamsSchema = z.object({
  petId: z.string().min(1),
  expenseId: z.string().min(1),
});

export const expenseRouter = Router({ mergeParams: true });

expenseRouter.use(authenticate);

expenseRouter.get(
  '/',
  validate({ params: petIdParamsSchema, query: listExpensesQuerySchema }),
  asyncHandler(expenseController.list),
);

expenseRouter.post(
  '/',
  validate({ params: petIdParamsSchema, body: createExpenseSchema }),
  asyncHandler(expenseController.create),
);

/**
 * `/stats` must be registered BEFORE `/:expenseId` so Express doesn't try
 * to match "stats" as an expense id. This is the classic static-before-
 * dynamic route ordering rule.
 */
expenseRouter.get(
  '/stats',
  validate({ params: petIdParamsSchema, query: statsQuerySchema }),
  asyncHandler(expenseController.stats),
);

expenseRouter.get(
  '/:expenseId',
  validate({ params: expenseParamsSchema }),
  asyncHandler(expenseController.getOne),
);

expenseRouter.patch(
  '/:expenseId',
  validate({ params: expenseParamsSchema, body: updateExpenseSchema }),
  asyncHandler(expenseController.update),
);

expenseRouter.delete(
  '/:expenseId',
  validate({ params: expenseParamsSchema }),
  asyncHandler(expenseController.remove),
);