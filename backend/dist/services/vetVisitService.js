import { Types } from 'mongoose';
import { vetVisitRepository, } from '../repositories/vetVisitRepository.js';
import { expenseRepository } from '../repositories/expenseRepository.js';
import { petRepository } from '../repositories/petRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
function toObjectId(id, fieldName = 'id') {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return new Types.ObjectId(id);
}
function vetVisitNotFound() {
    return new AppError('Vet visit not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.VET_VISIT_NOT_FOUND);
}
export function serializeVetVisit(v) {
    return {
        id: v._id.toString(),
        petId: v.petId.toString(),
        visitDate: v.visitDate.toISOString(),
        vetName: v.vetName ?? null,
        clinicName: v.clinicName ?? null,
        reason: v.reason ?? null,
        diagnosis: v.diagnosis ?? null,
        treatment: v.treatment ?? null,
        costCents: v.costCents ?? null,
        notes: v.notes ?? null,
        scheduled: v.scheduled,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
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
 * Build the expense description for a vet visit.
 */
function buildExpenseDescription(v) {
    const parts = [];
    if (v.clinicName)
        parts.push(v.clinicName);
    else if (v.vetName)
        parts.push(`Dr. ${v.vetName}`);
    if (v.reason)
        parts.push(`- ${v.reason}`);
    return parts.length > 0 ? `Vet visit ${parts.join(' ')}` : 'Vet visit';
}
/**
 * Reconcile the linked expense for a vet visit.
 *
 * Rules:
 * - If costCents > 0: create or update the linked expense.
 * - If costCents is null or 0: delete the linked expense (if any).
 */
async function reconcileLinkedExpense(ownerId, petId, visit) {
    const shouldHaveExpense = (visit.costCents ?? 0) > 0;
    const existingExpense = await expenseRepository.findLinked('vet_visit', visit._id);
    if (shouldHaveExpense) {
        const data = {
            ownerId,
            petId,
            amountCents: visit.costCents,
            currency: 'USD',
            category: 'vet',
            date: visit.visitDate,
            description: buildExpenseDescription(visit),
            notes: null,
            sourceType: 'vet_visit',
            sourceId: visit._id,
        };
        if (existingExpense) {
            await expenseRepository.updateForOwner(existingExpense._id, ownerId, data);
        }
        else {
            await expenseRepository.create(data);
        }
    }
    else if (existingExpense) {
        await expenseRepository.softDeleteForOwner(existingExpense._id, ownerId);
    }
}
export const vetVisitService = {
    async list(userId, petId, query) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        return vetVisitRepository.listForPet(ownerId, petObjectId, query.status ?? null, query.limit ?? 100);
    },
    async getOne(userId, petId, visitId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const visit = await vetVisitRepository.findByIdForOwnerAndPet(visitId, ownerId, petObjectId);
        if (!visit)
            throw vetVisitNotFound();
        return visit;
    },
    async create(userId, petId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        // Auto-determine `scheduled` if the client didn't specify.
        const scheduled = input.scheduled ?? input.visitDate.getTime() > Date.now();
        const data = {
            ownerId,
            petId: petObjectId,
            visitDate: input.visitDate,
            vetName: input.vetName ?? null,
            clinicName: input.clinicName ?? null,
            reason: input.reason ?? null,
            diagnosis: input.diagnosis ?? null,
            treatment: input.treatment ?? null,
            costCents: input.costCents ?? null,
            notes: input.notes ?? null,
            scheduled,
        };
        const visit = await vetVisitRepository.create(data);
        await reconcileLinkedExpense(ownerId, petObjectId, visit);
        return visit;
    },
    async update(userId, petId, visitId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const update = {};
        if (input.visitDate !== undefined)
            update.visitDate = input.visitDate;
        if (input.vetName !== undefined)
            update.vetName = input.vetName ?? null;
        if (input.clinicName !== undefined)
            update.clinicName = input.clinicName ?? null;
        if (input.reason !== undefined)
            update.reason = input.reason ?? null;
        if (input.diagnosis !== undefined)
            update.diagnosis = input.diagnosis ?? null;
        if (input.treatment !== undefined)
            update.treatment = input.treatment ?? null;
        if (input.costCents !== undefined)
            update.costCents = input.costCents ?? null;
        if (input.notes !== undefined)
            update.notes = input.notes ?? null;
        if (input.scheduled !== undefined)
            update.scheduled = input.scheduled;
        const updated = await vetVisitRepository.updateForOwner(visitId, ownerId, update);
        if (!updated)
            throw vetVisitNotFound();
        await reconcileLinkedExpense(ownerId, petObjectId, updated);
        return updated;
    },
    async remove(userId, petId, visitId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const existing = await vetVisitRepository.findByIdForOwnerAndPet(visitId, ownerId, petObjectId);
        if (!existing)
            throw vetVisitNotFound();
        // Cascade: delete the linked expense before the visit.
        const linkedExpense = await expenseRepository.findLinked('vet_visit', existing._id);
        if (linkedExpense) {
            await expenseRepository.softDeleteForOwner(linkedExpense._id, ownerId);
        }
        await vetVisitRepository.softDeleteForOwner(visitId, ownerId);
    },
    /**
     * Upcoming scheduled visits — used by the dashboard.
     */
    async listUpcoming(userId, petId, limit) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        return vetVisitRepository.listUpcomingScheduled(ownerId, petObjectId, new Date(), limit);
    },
};
//# sourceMappingURL=vetVisitService.js.map