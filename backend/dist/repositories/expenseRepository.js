import { Types } from 'mongoose';
import { ExpenseModel, } from '../models/Expense.js';
export const expenseRepository = {
    async create(data) {
        return ExpenseModel.create(data);
    },
    async findLinked(sourceType, sourceId) {
        return ExpenseModel.findOne({ sourceType, sourceId }).exec();
    },
    async findByIdForOwnerAndPet(expenseId, ownerId, petId) {
        if (!Types.ObjectId.isValid(expenseId))
            return null;
        return ExpenseModel.findOne({ _id: expenseId, ownerId, petId }).exec();
    },
    async updateForOwner(expenseId, ownerId, data) {
        return ExpenseModel.findOneAndUpdate({ _id: expenseId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    async softDeleteForOwner(expenseId, ownerId) {
        await ExpenseModel.updateOne({ _id: expenseId, ownerId }, { $set: { deletedAt: new Date() } }).exec();
    },
    async listForPet(options) {
        const filter = {
            ownerId: options.ownerId,
            petId: options.petId,
        };
        if (options.category)
            filter.category = options.category;
        if (options.from || options.to) {
            const dateFilter = {};
            if (options.from)
                dateFilter.$gte = options.from;
            if (options.to)
                dateFilter.$lt = options.to;
            filter.date = dateFilter;
        }
        return ExpenseModel.find(filter)
            .sort({ date: -1 })
            .limit(options.limit)
            .exec();
    },
    /**
     * Aggregate totals by category for a date range.
     *
     * This is where MongoDB's aggregation pipeline earns its keep. A naive
     * implementation would fetch every matching expense and `.reduce` in JS.
     * For a year of data (potentially thousands of records), that's a lot of
     * memory and CPU. The pipeline does it in the DB.
     *
     * Pipeline stages:
     * - $match: narrow to the requested pet + date range + non-deleted.
     * - $group: aggregate by category, summing amounts and counting.
     * - $sort: largest category first (most useful for a breakdown display).
     */
    async aggregateByCategory(ownerId, petId, from, to) {
        const results = await ExpenseModel.aggregate([
            {
                $match: {
                    ownerId,
                    petId,
                    deletedAt: null,
                    date: { $gte: from, $lt: to },
                },
            },
            {
                $group: {
                    _id: '$category',
                    totalCents: { $sum: '$amountCents' },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { totalCents: -1 },
            },
        ]).exec();
        return results.map((r) => ({
            category: r._id,
            totalCents: r.totalCents,
            count: r.count,
        }));
    },
    /**
     * Sum of all expenses in a range. Returns 0 if none.
     */
    async sumInRange(ownerId, petId, from, to) {
        const results = await ExpenseModel.aggregate([
            {
                $match: {
                    ownerId,
                    petId,
                    deletedAt: null,
                    date: { $gte: from, $lt: to },
                },
            },
            { $group: { _id: null, total: { $sum: '$amountCents' } } },
        ]).exec();
        return results[0]?.total ?? 0;
    },
};
//# sourceMappingURL=expenseRepository.js.map