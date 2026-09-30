import { Types } from 'mongoose';
import { travelRepository, } from '../repositories/travelRepository.js';
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
function planNotFound() {
    return new AppError('Travel plan not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.TRAVEL_PLAN_NOT_FOUND);
}
function itemNotFound() {
    return new AppError('Checklist item not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.CHECKLIST_ITEM_NOT_FOUND);
}
export function serializeChecklistItem(item) {
    return {
        id: item._id.toString(),
        label: item.label,
        description: item.description ?? null,
        completed: item.completed ?? false,
        completedAt: item.completedAt ? item.completedAt.toISOString() : null,
        order: item.order,
        fromTemplate: item.sourceTemplateItemId !== null && item.sourceTemplateItemId !== undefined,
    };
}
export function serializeTravelPlan(plan) {
    const checklist = plan.checklist
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(serializeChecklistItem);
    const completedCount = checklist.filter((i) => i.completed).length;
    return {
        id: plan._id.toString(),
        petId: plan.petId.toString(),
        name: plan.name,
        tripType: plan.tripType,
        destination: plan.destination ?? null,
        departureDate: plan.departureDate.toISOString(),
        returnDate: plan.returnDate ? plan.returnDate.toISOString() : null,
        notes: plan.notes ?? null,
        checklist,
        checklistProgress: {
            completed: completedCount,
            total: checklist.length,
        },
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
    };
}
export function serializeTemplate(t) {
    return {
        id: t._id.toString(),
        tripType: t.tripType,
        name: t.name,
        description: t.description,
        itemCount: t.items.length,
        version: t.version,
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
 * Materialize a template's items into a plan's checklist.
 */
function templateToChecklist(template) {
    if (!template)
        return [];
    return template.items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((item, index) => ({
        label: item.label,
        description: item.description ?? null,
        completed: false,
        completedAt: null,
        order: index,
        sourceTemplateItemId: item._id ?? null,
    }));
}
export const travelService = {
    async listTemplates() {
        return travelRepository.listTemplates();
    },
    async list(userId, petId, query) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        return travelRepository.listPlansForPet(ownerId, petObjectId, query.upcomingOnly ?? false, new Date(), query.limit ?? 50);
    },
    async getOne(userId, petId, planId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const plan = await travelRepository.findPlanByIdForOwnerAndPet(planId, ownerId, petObjectId);
        if (!plan)
            throw planNotFound();
        return plan;
    },
    async create(userId, petId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        // Fetch the template for this trip type (may be null for 'other').
        const template = await travelRepository.findTemplateByType(input.tripType);
        const checklist = templateToChecklist(template);
        const data = {
            ownerId,
            petId: petObjectId,
            name: input.name,
            tripType: input.tripType,
            destination: input.destination ?? null,
            departureDate: input.departureDate,
            returnDate: input.returnDate ?? null,
            notes: input.notes ?? null,
            checklist,
        };
        return travelRepository.createPlan(data);
    },
    async update(userId, petId, planId, input) {
        await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const planObjectId = toObjectId(planId, 'planId');
        const update = {};
        if (input.name !== undefined)
            update.name = input.name;
        if (input.tripType !== undefined)
            update.tripType = input.tripType;
        if (input.destination !== undefined)
            update.destination = input.destination ?? null;
        if (input.departureDate !== undefined)
            update.departureDate = input.departureDate;
        if (input.returnDate !== undefined)
            update.returnDate = input.returnDate ?? null;
        if (input.notes !== undefined)
            update.notes = input.notes ?? null;
        const updated = await travelRepository.updatePlan(planObjectId, ownerId, update);
        if (!updated)
            throw planNotFound();
        return updated;
    },
    async remove(userId, petId, planId) {
        await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const planObjectId = toObjectId(planId, 'planId');
        const existing = await travelRepository.findPlanByIdForOwnerAndPet(planObjectId, ownerId, toObjectId(petId, 'petId'));
        if (!existing)
            throw planNotFound();
        await travelRepository.softDeletePlan(planObjectId, ownerId);
    },
    async addChecklistItem(userId, petId, planId, input) {
        await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const planObjectId = toObjectId(planId, 'planId');
        const existing = await travelRepository.findPlanByIdForOwnerAndPet(planObjectId, ownerId, toObjectId(petId, 'petId'));
        if (!existing)
            throw planNotFound();
        // New item goes at the end.
        const maxOrder = existing.checklist.reduce((m, item) => Math.max(m, item.order), -1);
        const nextOrder = maxOrder + 1;
        const updated = await travelRepository.addChecklistItem(planObjectId, ownerId, {
            label: input.label,
            description: input.description ?? null,
            order: nextOrder,
        });
        if (!updated)
            throw planNotFound();
        return updated;
    },
    async updateChecklistItem(userId, petId, planId, itemId, input) {
        await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const planObjectId = toObjectId(planId, 'planId');
        const itemObjectId = toObjectId(itemId, 'itemId');
        const updates = {};
        if (input.label !== undefined)
            updates.label = input.label;
        if (input.description !== undefined)
            updates.description = input.description ?? null;
        if (input.completed !== undefined) {
            updates.completed = input.completed;
            updates.completedAt = input.completed ? new Date() : null;
        }
        const updated = await travelRepository.updateChecklistItem(planObjectId, ownerId, itemObjectId, updates);
        if (!updated)
            throw planNotFound();
        // Verify the item still exists in the returned plan. If not, the item
        // wasn't found (update matched no array element).
        const hasItem = updated.checklist.some((i) => i._id.toString() === itemId);
        if (!hasItem)
            throw itemNotFound();
        return updated;
    },
    async deleteChecklistItem(userId, petId, planId, itemId) {
        await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const planObjectId = toObjectId(planId, 'planId');
        const itemObjectId = toObjectId(itemId, 'itemId');
        const updated = await travelRepository.deleteChecklistItem(planObjectId, ownerId, itemObjectId);
        if (!updated)
            throw planNotFound();
        return updated;
    },
    /**
     * Get the next upcoming trip — used by the dashboard.
     */
    async getNextUpcoming(userId, petId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        return travelRepository.findNextUpcoming(ownerId, petObjectId, new Date());
    },
};
//# sourceMappingURL=travelService.js.map