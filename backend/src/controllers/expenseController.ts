import type { Request, Response } from 'express';
import { expenseService, serializeExpense } from '../services/expenseService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
  StatsQuery,
} from '../validators/expenseValidators.js';

export const expenseController = {
  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as ListExpensesQuery;
    const { expenses, summary } = await expenseService.list(userId, petId, query);
    ok(res, {
      expenses: expenses.map(serializeExpense),
      summary,
    });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, expenseId } = req.params as { petId: string; expenseId: string };
    const expense = await expenseService.getOne(userId, petId, expenseId);
    ok(res, { expense: serializeExpense(expense) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateExpenseInput;
    const expense = await expenseService.create(userId, petId, input);
    ok(res, { expense: serializeExpense(expense) }, HTTP_STATUS.CREATED);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, expenseId } = req.params as { petId: string; expenseId: string };
    const input = req.body as UpdateExpenseInput;
    const expense = await expenseService.update(userId, petId, expenseId, input);
    ok(res, { expense: serializeExpense(expense) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, expenseId } = req.params as { petId: string; expenseId: string };
    await expenseService.remove(userId, petId, expenseId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  async stats(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as StatsQuery;
    const stats = await expenseService.stats(userId, petId, query);
    ok(res, { stats });
  },
};