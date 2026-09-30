import { Types } from 'mongoose';
import {
  expenseRepository,
  type CreateExpenseData,
  type UpdateExpenseData,
  type CategoryTotal,
} from '../repositories/expenseRepository.js';
import { require as requirePermission } from './petPermissionsService.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import type {
  ExpenseDocument,
  ExpenseCategory,
} from '../models/Expense.js';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
  StatsQuery,
} from '../validators/expenseValidators.js';

/**
 * Expense service.
 *
 * Beyond CRUD, provides:
 * - Summary for the list endpoint (current month by default).
 * - Stats endpoint for custom date ranges.
 * - Locking: auto-created expenses are read-only except for notes.
 */

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function expenseNotFound(): AppError {
  return new AppError(
    'Expense not found',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.EXPENSE_NOT_FOUND,
  );
}

export function serializeExpense(e: ExpenseDocument) {
  return {
    id: e._id.toString(),
    petId: e.petId.toString(),
    amountCents: e.amountCents,
    currency: e.currency,
    category: e.category,
    date: e.date.toISOString(),
    description: e.description ?? null,
    notes: e.notes ?? null,
    sourceType: e.sourceType ?? null,
    sourceId: e.sourceId ? e.sourceId.toString() : null,
    /** True if this expense was auto-created from another record. */
    locked: e.sourceType !== null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

async function verifyPetOwnership(
  userId: string,
  petId: string,
  permission: 'records:read' | 'records:write' | 'records:delete',
): Promise<Types.ObjectId> {
  const access = await requirePermission(userId, petId, permission);
  return access.pet._id;
}

/**
 * The start of a month (UTC), given a date.
 */
function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * The start of the next month (UTC). Exclusive upper bound for "this month".
 */
function startOfNextMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export interface ExpenseSummary {
  range: { from: string; to: string };
  totalCents: number;
  byCategory: CategoryTotal[];
}

async function buildSummary(
  petId: Types.ObjectId,
  from: Date,
  to: Date,
): Promise<ExpenseSummary> {
  const [totalCents, byCategory] = await Promise.all([
    expenseRepository.sumInRange(petId, from, to),
    expenseRepository.aggregateByCategory(petId, from, to),
  ]);

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totalCents,
    byCategory,
  };
}

export const expenseService = {
  async list(
    userId: string,
    petId: string,
    query: ListExpensesQuery,
  ): Promise<{
    expenses: ExpenseDocument[];
    summary: ExpenseSummary | null;
  }> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:read');

    const expenses = await expenseRepository.listForPet({
      petId: petObjectId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      limit: query.limit ?? 100,
    });

    // Summary is for the CURRENT month by default, regardless of the list
    // filters. Rationale: the list is filtered by what the user wants to see;
    // the summary is a stable "how am I doing this month" metric.
    //
    // If we summarized the FILTERED list, "showing only vet expenses" would
    // make the summary say "total: $500 (all vet)", which is misleading.
    let summary: ExpenseSummary | null = null;
    if (query.includeSummary) {
      const now = new Date();
      summary = await buildSummary(
        petObjectId,
        startOfMonthUTC(now),
        startOfNextMonthUTC(now),
      );
    }

    return { expenses, summary };
  },

  async getOne(userId: string, petId: string, expenseId: string): Promise<ExpenseDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:read');
    const expense = await expenseRepository.findByIdAndPet(expenseId, petObjectId);
    if (!expense) throw expenseNotFound();
    return expense;
  },

  async create(
    userId: string,
    petId: string,
    input: CreateExpenseInput,
  ): Promise<ExpenseDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    const data: CreateExpenseData = {
      createdBy,
      petId: petObjectId,
      amountCents: input.amountCents,
      currency: 'USD',
      category: input.category as ExpenseCategory,
      date: input.date,
      description: input.description ?? null,
      notes: input.notes ?? null,
      sourceType: null,
      sourceId: null,
    };

    return expenseRepository.create(data);
  },

  /**
   * Update an expense.
   *
   * Auto-created expenses (sourceType !== null) may only have their `notes`
   * updated. Any attempt to change `amountCents`, `category`, `date`, or
   * `description` is rejected with EXPENSE_SOURCE_LOCKED.
   *
   * Why lock? Because the source (e.g., a vet visit) owns those fields. If
   * the user wants to change the amount, they edit the visit. This keeps the
   * source and the derived record from drifting.
   */
  async update(
    userId: string,
    petId: string,
    expenseId: string,
    input: UpdateExpenseInput,
  ): Promise<ExpenseDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:write');

    const existing = await expenseRepository.findByIdAndPet(expenseId, petObjectId);
    if (!existing) throw expenseNotFound();

    const isLocked = existing.sourceType !== null;

    if (isLocked) {
      const attemptedLockedFields = ['amountCents', 'category', 'date', 'description'] as const;
      for (const field of attemptedLockedFields) {
        if (input[field] !== undefined) {
          throw new AppError(
            `This expense is created from a ${existing.sourceType}. Edit the source record instead.`,
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.EXPENSE_SOURCE_LOCKED,
          );
        }
      }
    }

    const update: UpdateExpenseData = {};
    if (input.amountCents !== undefined) update.amountCents = input.amountCents;
    if (input.category !== undefined) update.category = input.category as ExpenseCategory;
    if (input.date !== undefined) update.date = input.date;
    if (input.description !== undefined) update.description = input.description ?? null;
    if (input.notes !== undefined) update.notes = input.notes ?? null;

    const updated = await expenseRepository.updateById(existing._id, petObjectId, update);
    if (!updated) throw expenseNotFound();
    return updated;
  },

  async remove(userId: string, petId: string, expenseId: string): Promise<void> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:delete');

    const existing = await expenseRepository.findByIdAndPet(expenseId, petObjectId);
    if (!existing) throw expenseNotFound();

    // Auto-created expenses can be deleted (soft-deleted). The source record
    // (e.g. vet visit) stays, but the expense won't be recreated unless the
    // source's cost is edited again.
    //
    // This is a deliberate escape hatch: users who want to remove a
    // mistakenly-calculated expense can do so without deleting the visit.
    await expenseRepository.softDeleteById(existing._id, petObjectId);
  },

  /**
   * Stats for a custom date range.
   *
   * Defaults: current month.
   */
  async stats(
    userId: string,
    petId: string,
    query: StatsQuery,
  ): Promise<ExpenseSummary> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:read');

    const now = new Date();
    const from = query.from ?? startOfMonthUTC(now);
    const to = query.to ?? startOfNextMonthUTC(now);

    if (from.getTime() >= to.getTime()) {
      throw new AppError(
        '`from` must be before `to`',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    return buildSummary(petObjectId, from, to);
  },
};