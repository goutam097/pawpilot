import { Types } from 'mongoose';
import {
  ExpenseModel,
  type ExpenseDocument,
  type ExpenseCategory,
  type ExpenseSourceType,
} from '../models/Expense.js';

export interface CreateExpenseData {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  amountCents: number;
  currency: 'USD';
  category: ExpenseCategory;
  date: Date;
  description: string | null;
  notes: string | null;
  sourceType: ExpenseSourceType | null;
  sourceId: Types.ObjectId | null;
}

export interface UpdateExpenseData {
  amountCents?: number;
  category?: ExpenseCategory;
  date?: Date;
  description?: string | null;
  notes?: string | null;
}

export interface ListExpensesOptions {
  petId: Types.ObjectId;
  category?: ExpenseCategory;
  from?: Date;
  to?: Date;
  limit: number;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  totalCents: number;
  count: number;
}

export const expenseRepository = {
  async create(data: CreateExpenseData): Promise<ExpenseDocument> {
    return ExpenseModel.create(data);
  },

  async findLinked(
    sourceType: ExpenseSourceType,
    sourceId: Types.ObjectId,
  ): Promise<ExpenseDocument | null> {
    return ExpenseModel.findOne({ sourceType, sourceId }).exec();
  },

  async findByIdAndPet(
    expenseId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<ExpenseDocument | null> {
    if (!Types.ObjectId.isValid(expenseId)) return null;
    return ExpenseModel.findOne({ _id: expenseId, petId }).exec();
  },

  async updateById(
    expenseId: Types.ObjectId,
    petId: Types.ObjectId,
    data: UpdateExpenseData,
  ): Promise<ExpenseDocument | null> {
    return ExpenseModel.findOneAndUpdate(
      { _id: expenseId, petId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  async softDeleteById(
    expenseId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<void> {
    await ExpenseModel.updateOne(
      { _id: expenseId, petId },
      { $set: { deletedAt: new Date() } },
    ).exec();
  },

  async listForPet(options: ListExpensesOptions): Promise<ExpenseDocument[]> {
    const filter: Record<string, unknown> = {
      petId: options.petId,
    };

    if (options.category) filter.category = options.category;

    if (options.from || options.to) {
      const dateFilter: Record<string, Date> = {};
      if (options.from) dateFilter.$gte = options.from;
      if (options.to) dateFilter.$lt = options.to;
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
  async aggregateByCategory(
    petId: Types.ObjectId,
    from: Date,
    to: Date,
  ): Promise<CategoryTotal[]> {
    const results = await ExpenseModel.aggregate<{
      _id: ExpenseCategory;
      totalCents: number;
      count: number;
    }>([
      {
        $match: {
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
  async sumInRange(
    petId: Types.ObjectId,
    from: Date,
    to: Date,
  ): Promise<number> {
    const results = await ExpenseModel.aggregate<{ total: number }>([
      {
        $match: {
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