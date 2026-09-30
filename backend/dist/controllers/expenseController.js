import { expenseService, serializeExpense } from '../services/expenseService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const expenseController = {
    async list(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const { expenses, summary } = await expenseService.list(userId, petId, query);
        ok(res, {
            expenses: expenses.map(serializeExpense),
            summary,
        });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId, expenseId } = req.params;
        const expense = await expenseService.getOne(userId, petId, expenseId);
        ok(res, { expense: serializeExpense(expense) });
    },
    async create(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const expense = await expenseService.create(userId, petId, input);
        ok(res, { expense: serializeExpense(expense) }, HTTP_STATUS.CREATED);
    },
    async update(req, res) {
        const { userId } = req;
        const { petId, expenseId } = req.params;
        const input = req.body;
        const expense = await expenseService.update(userId, petId, expenseId, input);
        ok(res, { expense: serializeExpense(expense) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId, expenseId } = req.params;
        await expenseService.remove(userId, petId, expenseId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
    async stats(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const stats = await expenseService.stats(userId, petId, query);
        ok(res, { stats });
    },
};
//# sourceMappingURL=expenseController.js.map