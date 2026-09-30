import { Types } from 'mongoose';
import { vaccinationRepository, } from '../repositories/vaccinationRepository.js';
import { petRepository } from '../repositories/petRepository.js';
import { ReminderModel } from '../models/Reminder.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Vaccination service.
 *
 * Beyond CRUD, this service manages the LINKED REMINDER for a vaccination
 * with a nextDueAt. The lifecycle:
 *
 * - Create: if nextDueAt + createReminder, insert a Reminder with
 *   sourceType='vaccination', sourceId=vaccination._id.
 * - Update: if nextDueAt changed and a reminder exists, update its dueAt.
 *   If createReminder flipped false and a reminder exists, delete it.
 *   If nextDueAt cleared and a reminder exists, delete it.
 *   If createReminder flipped true and nextDueAt set but no reminder exists,
 *   create one. (Edge case: user previously unchecked, now rechecks.)
 * - Delete: soft-delete the vaccination AND delete the linked reminder.
 *   The reminder's soft-delete is used (deletedAt) so the notification
 *   pipeline can't fire it.
 *
 * Invariants enforced:
 * - If nextDueAt is null, no linked reminder exists.
 * - If createReminder is false, no linked reminder exists.
 * - If both are set, at most ONE linked reminder exists.
 */
const DEFAULT_NOTIFY_OFFSET_MINUTES = 24 * 60; // 1 day before
function toObjectId(id, fieldName = 'id') {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return new Types.ObjectId(id);
}
function vaccinationNotFound() {
    return new AppError('Vaccination not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.VACCINATION_NOT_FOUND);
}
function computeNotifyAt(dueAt, offsetMinutes) {
    return new Date(dueAt.getTime() - offsetMinutes * 60_000);
}
export function serializeVaccination(v) {
    return {
        id: v._id.toString(),
        petId: v.petId.toString(),
        vaccineName: v.vaccineName,
        givenAt: v.givenAt.toISOString(),
        nextDueAt: v.nextDueAt ? v.nextDueAt.toISOString() : null,
        administeredBy: v.administeredBy ?? null,
        lotNumber: v.lotNumber ?? null,
        notes: v.notes ?? null,
        createReminder: v.createReminder,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
    };
}
/**
 * Verify the pet exists and belongs to the user.
 */
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
 * Find the linked reminder for a vaccination.
 * Uses the sourceType/sourceId index.
 */
async function findLinkedReminder(ownerId, vaccinationId) {
    return ReminderModel.findOne({
        ownerId,
        sourceType: 'vaccination',
        sourceId: vaccinationId,
    }).exec();
}
/**
 * Create a linked reminder for a vaccination.
 * Assumes the vaccination has nextDueAt.
 */
async function createLinkedReminder(ownerId, petId, vaccination) {
    if (!vaccination.nextDueAt)
        return;
    await ReminderModel.create({
        createdBy: ownerId,
        petId,
        title: `${vaccination.vaccineName} due`,
        description: `Next dose for ${vaccination.vaccineName}.`,
        type: 'vaccination',
        dueAt: vaccination.nextDueAt,
        notifyAt: computeNotifyAt(vaccination.nextDueAt, DEFAULT_NOTIFY_OFFSET_MINUTES),
        repeatRule: { kind: 'none' }, // Vaccination reminders are one-shot; the user creates a new vaccination record when done.
        notificationEnabled: true,
        notifyAtOffsetMinutes: DEFAULT_NOTIFY_OFFSET_MINUTES,
        sourceType: 'vaccination',
        sourceId: vaccination._id,
    });
}
/**
 * Update the linked reminder's dueAt to match the vaccination.
 */
async function updateLinkedReminder(reminderId, nextDueAt) {
    await ReminderModel.updateOne({ _id: reminderId }, {
        $set: {
            dueAt: nextDueAt,
            notifyAt: computeNotifyAt(nextDueAt, DEFAULT_NOTIFY_OFFSET_MINUTES),
            // Reset notification state — a new due date means the previous
            // notification (if any) is obsolete.
            lastNotifiedForDueAt: null,
        },
    });
}
/**
 * Soft-delete a linked reminder.
 */
async function deleteLinkedReminder(reminderId) {
    await ReminderModel.updateOne({ _id: reminderId }, { $set: { deletedAt: new Date() } });
}
export const vaccinationService = {
    async list(userId, petId, query) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        return vaccinationRepository.listForPet(ownerId, petObjectId, query.limit ?? 100);
    },
    async getOne(userId, petId, vaccinationId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const vaccination = await vaccinationRepository.findByIdForOwnerAndPet(vaccinationId, ownerId, petObjectId);
        if (!vaccination)
            throw vaccinationNotFound();
        return vaccination;
    },
    async create(userId, petId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const data = {
            ownerId,
            petId: petObjectId,
            vaccineName: input.vaccineName,
            givenAt: input.givenAt,
            nextDueAt: input.nextDueAt ?? null,
            administeredBy: input.administeredBy ?? null,
            lotNumber: input.lotNumber ?? null,
            notes: input.notes ?? null,
            createReminder: input.createReminder ?? true,
        };
        const vaccination = await vaccinationRepository.create(data);
        // Create the linked reminder if applicable.
        if (vaccination.createReminder && vaccination.nextDueAt) {
            await createLinkedReminder(ownerId, petObjectId, vaccination);
        }
        return vaccination;
    },
    async update(userId, petId, vaccinationId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const existing = await vaccinationRepository.findByIdForOwnerAndPet(vaccinationId, ownerId, petObjectId);
        if (!existing)
            throw vaccinationNotFound();
        // Build the update payload.
        const update = {};
        if (input.vaccineName !== undefined)
            update.vaccineName = input.vaccineName;
        if (input.givenAt !== undefined)
            update.givenAt = input.givenAt;
        if (input.nextDueAt !== undefined)
            update.nextDueAt = input.nextDueAt ?? null;
        if (input.administeredBy !== undefined)
            update.administeredBy = input.administeredBy ?? null;
        if (input.lotNumber !== undefined)
            update.lotNumber = input.lotNumber ?? null;
        if (input.notes !== undefined)
            update.notes = input.notes ?? null;
        if (input.createReminder !== undefined)
            update.createReminder = input.createReminder;
        // Cross-field validation on the MERGED result. Since the update might
        // change givenAt or nextDueAt independently, we need to check the
        // combination that would result after the update.
        const mergedGivenAt = input.givenAt ?? existing.givenAt;
        const mergedNextDueAt = input.nextDueAt !== undefined ? input.nextDueAt : existing.nextDueAt;
        if (mergedNextDueAt && mergedNextDueAt.getTime() <= mergedGivenAt.getTime()) {
            throw new AppError('nextDueAt must be after givenAt', HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR);
        }
        const updated = await vaccinationRepository.updateForOwner(vaccinationId, ownerId, update);
        if (!updated)
            throw vaccinationNotFound();
        // Reconcile the linked reminder with the new state.
        await reconcileLinkedReminder(ownerId, petObjectId, updated, existing);
        return updated;
    },
    async remove(userId, petId, vaccinationId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const existing = await vaccinationRepository.findByIdForOwnerAndPet(vaccinationId, ownerId, petObjectId);
        if (!existing)
            throw vaccinationNotFound();
        // Delete the linked reminder first (or after — order doesn't matter
        // much, but doing it first means a failure leaves us in a clean state
        // where the reminder is gone and the vaccination remains, which the
        // user can retry).
        const linkedReminder = await findLinkedReminder(ownerId, existing._id);
        if (linkedReminder) {
            await deleteLinkedReminder(linkedReminder._id);
        }
        await vaccinationRepository.softDeleteForOwner(vaccinationId, ownerId);
    },
};
/**
 * Reconcile the linked reminder with the vaccination's current state.
 *
 * Rules:
 * - If shouldHaveReminder (createReminder && nextDueAt) and reminder exists:
 *   update its dueAt if changed.
 * - If shouldHaveReminder and no reminder exists: create one. This handles
 *   the case where the user previously had createReminder=false, or the
 *   reminder was deleted manually, and now wants it back.
 * - If !shouldHaveReminder and reminder exists: delete it.
 * - If !shouldHaveReminder and no reminder: no-op.
 */
async function reconcileLinkedReminder(ownerId, petId, updated, previous) {
    const shouldHaveReminder = updated.createReminder && !!updated.nextDueAt;
    const existingReminder = await findLinkedReminder(ownerId, updated._id);
    if (shouldHaveReminder) {
        if (existingReminder) {
            // Update if the due date changed.
            const dueChanged = !previous.nextDueAt ||
                !updated.nextDueAt ||
                previous.nextDueAt.getTime() !== updated.nextDueAt.getTime();
            if (dueChanged && updated.nextDueAt) {
                await updateLinkedReminder(existingReminder._id, updated.nextDueAt);
            }
            // Also update the title if the vaccine name changed.
            if (previous.vaccineName !== updated.vaccineName) {
                await ReminderModel.updateOne({ _id: existingReminder._id }, { $set: { title: `${updated.vaccineName} due` } });
            }
        }
        else if (updated.nextDueAt) {
            await createLinkedReminder(ownerId, petId, updated);
        }
    }
    else if (existingReminder) {
        await deleteLinkedReminder(existingReminder._id);
    }
}
//# sourceMappingURL=vaccinationService.js.map