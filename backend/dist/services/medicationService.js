import { Types } from 'mongoose';
import { medicationRepository, } from '../repositories/medicationRepository.js';
import { petRepository } from '../repositories/petRepository.js';
import { ReminderModel } from '../models/Reminder.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
function toObjectId(id, fieldName = 'id') {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return new Types.ObjectId(id);
}
function medicationNotFound() {
    return new AppError('Medication not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.MEDICATION_NOT_FOUND);
}
function frequencyToRepeatRule(frequency) {
    switch (frequency) {
        case 'daily':
            return { kind: 'daily', interval: 1 };
        case 'every_other_day':
            return { kind: 'daily', interval: 2 };
        case 'weekly':
            return { kind: 'weekly', interval: 1 };
        case 'monthly':
            return { kind: 'monthly', interval: 1 };
        case 'as_needed':
            return null;
    }
}
export function serializeMedication(m) {
    return {
        id: m._id.toString(),
        petId: m.petId.toString(),
        name: m.name,
        dosage: m.dosage ?? null,
        frequency: m.frequency,
        startDate: m.startDate.toISOString(),
        endDate: m.endDate ? m.endDate.toISOString() : null,
        instructions: m.instructions ?? null,
        prescribedBy: m.prescribedBy ?? null,
        notificationsEnabled: m.notificationsEnabled,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
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
async function findLinkedReminder(ownerId, medicationId) {
    return ReminderModel.findOne({
        ownerId,
        sourceType: 'medication',
        sourceId: medicationId,
    }).exec();
}
function buildMedicationReminderCopy(m) {
    const dosePart = m.dosage ? `${m.dosage} of ` : '';
    const instructionsPart = m.instructions ? ` ${m.instructions}` : '';
    return {
        title: m.name,
        description: `Give ${dosePart}${m.name}.${instructionsPart}`,
    };
}
async function createLinkedReminder(ownerId, petId, medication) {
    const rule = frequencyToRepeatRule(medication.frequency);
    if (!rule)
        return;
    const dueAt = medication.startDate;
    const copy = buildMedicationReminderCopy(medication);
    const notifyAtOffsetMinutes = 0;
    const notifyAt = dueAt;
    await ReminderModel.create({
        createdBy: ownerId,
        petId,
        title: copy.title,
        description: copy.description,
        type: 'medication',
        dueAt,
        notifyAt,
        repeatRule: rule,
        notificationEnabled: true,
        notifyAtOffsetMinutes,
        sourceType: 'medication',
        sourceId: medication._id,
    });
}
async function updateLinkedReminder(reminderId, medication) {
    const rule = frequencyToRepeatRule(medication.frequency);
    if (!rule)
        return;
    const dueAt = medication.startDate;
    const copy = buildMedicationReminderCopy(medication);
    await ReminderModel.updateOne({ _id: reminderId }, {
        $set: {
            title: copy.title,
            description: copy.description,
            dueAt,
            notifyAt: dueAt,
            repeatRule: rule,
            lastNotifiedForDueAt: null,
        },
    });
}
async function deleteLinkedReminder(reminderId) {
    await ReminderModel.updateOne({ _id: reminderId }, { $set: { deletedAt: new Date() } });
}
async function reconcileLinkedReminder(ownerId, petId, medication) {
    const shouldHaveReminder = medication.notificationsEnabled && medication.frequency !== 'as_needed';
    const existingReminder = await findLinkedReminder(ownerId, medication._id);
    if (shouldHaveReminder) {
        if (existingReminder) {
            await updateLinkedReminder(existingReminder._id, medication);
        }
        else {
            await createLinkedReminder(ownerId, petId, medication);
        }
    }
    else if (existingReminder) {
        await deleteLinkedReminder(existingReminder._id);
    }
}
export const medicationService = {
    async list(userId, petId, query) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        return medicationRepository.listForPet(ownerId, petObjectId, query.active ?? false, new Date(), query.limit ?? 100);
    },
    async getOne(userId, petId, medicationId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const medication = await medicationRepository.findByIdForOwnerAndPet(medicationId, ownerId, petObjectId);
        if (!medication)
            throw medicationNotFound();
        return medication;
    },
    async create(userId, petId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const data = {
            ownerId,
            petId: petObjectId,
            name: input.name,
            dosage: input.dosage ?? null,
            frequency: input.frequency,
            startDate: input.startDate,
            endDate: input.endDate ?? null,
            timeOfDay: input.timeOfDay,
            instructions: input.instructions ?? null,
            prescribedBy: input.prescribedBy ?? null,
            notificationsEnabled: input.notificationsEnabled ?? true,
        };
        const medication = await medicationRepository.create(data);
        if (medication.notificationsEnabled && medication.frequency !== 'as_needed') {
            await createLinkedReminder(ownerId, petObjectId, medication);
        }
        return medication;
    },
    async update(userId, petId, medicationId, input) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const existing = await medicationRepository.findByIdForOwnerAndPet(medicationId, ownerId, petObjectId);
        if (!existing)
            throw medicationNotFound();
        const update = {};
        if (input.name !== undefined)
            update.name = input.name;
        if (input.dosage !== undefined)
            update.dosage = input.dosage ?? null;
        if (input.frequency !== undefined)
            update.frequency = input.frequency;
        if (input.startDate !== undefined)
            update.startDate = input.startDate;
        if (input.endDate !== undefined)
            update.endDate = input.endDate ?? null;
        if (input.timeOfDay !== undefined)
            update.timeOfDay = input.timeOfDay;
        if (input.instructions !== undefined)
            update.instructions = input.instructions ?? null;
        if (input.prescribedBy !== undefined)
            update.prescribedBy = input.prescribedBy ?? null;
        if (input.notificationsEnabled !== undefined)
            update.notificationsEnabled = input.notificationsEnabled;
        const mergedStart = input.startDate ?? existing.startDate;
        const mergedEnd = input.endDate !== undefined ? input.endDate : existing.endDate;
        if (mergedEnd && mergedEnd.getTime() <= mergedStart.getTime()) {
            throw new AppError('endDate must be after startDate', HTTP_STATUS.UNPROCESSABLE_ENTITY, ERROR_CODES.VALIDATION_ERROR);
        }
        const updated = await medicationRepository.updateForOwner(medicationId, ownerId, update);
        if (!updated)
            throw medicationNotFound();
        await reconcileLinkedReminder(ownerId, petObjectId, updated);
        return updated;
    },
    async remove(userId, petId, medicationId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const existing = await medicationRepository.findByIdForOwnerAndPet(medicationId, ownerId, petObjectId);
        if (!existing)
            throw medicationNotFound();
        const linkedReminder = await findLinkedReminder(ownerId, existing._id);
        if (linkedReminder) {
            await deleteLinkedReminder(linkedReminder._id);
        }
        await medicationRepository.softDeleteForOwner(medicationId, ownerId);
    },
};
//# sourceMappingURL=medicationService.js.map