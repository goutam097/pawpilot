import { Types } from 'mongoose';
import { expenseRepository, } from '../repositories/expenseRepository.js';
import { petRepository } from '../repositories/petRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Expense service.
 *
 * Beyond CRUD, provides:
 * - Summary for the list endpoint (current month by default).
 * - Stats endpoint for custom date ranges.
 * - Locking: auto-created expenses are read-only except for notes.
 */
function toObjectId(id, fieldName = 'id') {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return new Types.ObjectId(id);
}
function expenseNotFound() {
    return new AppError('Expense not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.EXPENSE_NOT_FOUND);
}
export function serializeExpense(e) {
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
async function verifyPetOwnership(userId, petId) {
    const ownerId = toObjectId(userId, 'userId');
    const petObjectId = toObjectId(petId, 'petId');
    const pet = await petRepository.findByIdForOwner(petObjectId, ownerId);
    if (!pet) {
        throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
    }
    return petObjectId;
}
/**
 * The start of a month (UTC), given a date.
 */
function startOfMonthUTC(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
/**
 * The start of the next month (UTC). Exclusive upper bound for "this month".
 */
function startOfNextMonthUTC(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}
async function buildSummary(ownerId, petId, from, to) {
    const [totalCents, byCategory] = await Promise.all([
        expenseRepository.sumInRange(ownerId, petId, from, to),
        expenseRepository.aggregateByCategory(ownerId, petId, from, to),
    ]);
    return {
        range: { from: from.toISOString(), to: to.toISOString() },
        totalCents,
        byCategory,
    };
}
export const expenseService = {
    async list(userId, petId, query) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const expenses = await expenseRepository.listForPet({
            ownerId,
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
        let summary = null;
        if (query.includeSummary) {
            const now = new Date();
            summary = await buildSummary(ownerId, petObjectId, startOfMonthUTC(now), startOfNextMonthUTC(now));
        }
        return { expenses, summary };
    },
    async getOne(userId, petId, expenseId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const expense = await expenseRepository.findByIdForOwnerAndPet(expenseId, ownerId, petObjectId);
        if (!expense)
            throw expenseNotFound();
        return expense;
    },
    async create(userId, petId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const data = {
            ownerId,
            petId: petObjectId,
            amountCents: input.amountCents,
            currency: 'USD',
            category: input.category,
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
    async update(userId, petId, expenseId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const existing = await expenseRepository.findByIdForOwnerAndPet(expenseId, ownerId, petObjectId);
        if (!existing)
            throw expenseNotFound();
        const isLocked = existing.sourceType !== null;
        if (isLocked) {
            const attemptedLockedFields = ['amountCents', 'category', 'date', 'description'];
            for (const field of attemptedLockedFields) {
                if (input[field] !== undefined) {
                    throw new AppError(`This expense is created from a ${existing.sourceType}. Edit the source record instead.`, HTTP_STATUS.CONFLICT, ERROR_CODES.EXPENSE_SOURCE_LOCKED);
                }
            }
        }
        const update = {};
        if (input.amountCents !== undefined)
            update.amountCents = input.amountCents;
        if (input.category !== undefined)
            update.category = input.category;
        if (input.date !== undefined)
            update.date = input.date;
        if (input.description !== undefined)
            update.description = input.description ?? null;
        if (input.notes !== undefined)
            update.notes = input.notes ?? null;
        const updated = await expenseRepository.updateForOwner(existing._id, ownerId, update);
        if (!updated)
            throw expenseNotFound();
        return updated;
    },
    async remove(userId, petId, expenseId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const existing = await expenseRepository.findByIdForOwnerAndPet(expenseId, ownerId, petObjectId);
        if (!existing)
            throw expenseNotFound();
        // Auto-created expenses can be deleted (soft-deleted). The source record
        // (e.g. vet visit) stays, but the expense won't be recreated unless the
        // source's cost is edited again.
        //
        // This is a deliberate escape hatch: users who want to remove a
        // mistakenly-calculated expense can do so without deleting the visit.
        await expenseRepository.softDeleteForOwner(existing._id, ownerId);
    },
    /**
     * Stats for a custom date range.
     *
     * Defaults: current month.
     */
    async stats(userId, petId, query) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const now = new Date();
        const from = query.from ?? startOfMonthUTC(now);
        const to = query.to ?? startOfNextMonthUTC(now);
        if (from.getTime() >= to.getTime()) {
            throw new AppError('`from` must be before `to`', HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR);
        }
        return buildSummary(ownerId, petObjectId, from, to);
    },
};
//# sourceMappingURL=expenseService.js.map