import { Types } from 'mongoose';
import { weightRepository, } from '../repositories/weightRepository.js';
import { petRepository } from '../repositories/petRepository.js';
import { PetModel } from '../models/Pet.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { convertWeight } from '../utils/weightUnits.js';
/**
 * Weight service.
 *
 * Two responsibilities beyond CRUD:
 *
 * 1. CACHE MAINTENANCE
 *    The pet has a `weight` field (denormalized cache of the latest record).
 *    On any weight mutation, we recompute the cache from the current latest
 *    record. This keeps `pet.weight` consistent with the weight history.
 *
 * 2. UNIT CONVERSION FOR DISPLAY
 *    Records store their raw value + unit. When serializing, we convert to
 *    the pet's current `weightUnit`. This means a change to the pet's unit
 *    is reflected instantly without touching stored data.
 */
function toObjectId(id, fieldName = 'id') {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return new Types.ObjectId(id);
}
function weightRecordNotFound() {
    return new AppError('Weight record not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.WEIGHT_RECORD_NOT_FOUND);
}
/**
 * Serialize a weight record, converting to the pet's display unit.
 */
export function serializeWeight(record, petUnit) {
    const displayWeight = convertWeight(record.weight, record.unit, petUnit);
    return {
        id: record._id.toString(),
        petId: record.petId.toString(),
        weight: displayWeight,
        unit: petUnit,
        /** The raw stored value + unit, for transparency. */
        raw: {
            weight: record.weight,
            unit: record.unit,
        },
        recordedAt: record.recordedAt.toISOString(),
        notes: record.notes ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
    };
}
async function verifyPetOwnership(userId, petId) {
    const ownerId = toObjectId(userId, 'userId');
    const petObjectId = toObjectId(petId, 'petId');
    const pet = await petRepository.findByIdForOwner(petObjectId, ownerId);
    if (!pet) {
        throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
    }
    return pet;
}
/**
 * Recompute the pet's `weight` cache from the current latest record.
 * Called after any weight mutation.
 *
 * Cases:
 * - No records: pet.weight = null.
 * - Records: pet.weight = latest.weight converted to pet.weightUnit.
 */
async function syncPetWeightCache(ownerId, petId) {
    const pet = await petRepository.findByIdForOwner(petId, ownerId);
    if (!pet)
        return; // Pet was deleted; nothing to sync.
    const latest = await weightRepository.latestForPet(ownerId, petId, 1);
    const latestRecord = latest[0];
    const petUnit = (pet.weightUnit ?? 'kg');
    const newPetWeight = latestRecord
        ? convertWeight(latestRecord.weight, latestRecord.unit, petUnit)
        : null;
    // Only write if the value actually changed — avoids a no-op save and the
    // associated `updatedAt` churn.
    if (pet.weight !== newPetWeight) {
        await PetModel.updateOne({ _id: petId, ownerId }, { $set: { weight: newPetWeight } }).exec();
    }
}
export const weightService = {
    async list(userId, petId, query) {
        const pet = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const records = await weightRepository.listForPet(ownerId, toObjectId(petId, 'petId'), query.limit ?? 100);
        return { records, petUnit: (pet.weightUnit ?? 'kg') };
    },
    async getOne(userId, petId, recordId) {
        const pet = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const record = await weightRepository.findByIdForOwnerAndPet(recordId, ownerId, toObjectId(petId, 'petId'));
        if (!record)
            throw weightRecordNotFound();
        return { record, petUnit: (pet.weightUnit ?? 'kg') };
    },
    async create(userId, petId, input) {
        await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const petObjectId = toObjectId(petId, 'petId');
        const data = {
            ownerId,
            petId: petObjectId,
            weight: input.weight,
            unit: input.unit,
            recordedAt: input.recordedAt ?? new Date(),
            notes: input.notes ?? null,
        };
        const record = await weightRepository.create(data);
        await syncPetWeightCache(ownerId, petObjectId);
        return record;
    },
    async update(userId, petId, recordId, input) {
        await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const petObjectId = toObjectId(petId, 'petId');
        const update = {};
        if (input.weight !== undefined)
            update.weight = input.weight;
        if (input.unit !== undefined)
            update.unit = input.unit;
        if (input.recordedAt !== undefined)
            update.recordedAt = input.recordedAt;
        if (input.notes !== undefined)
            update.notes = input.notes ?? null;
        const updated = await weightRepository.updateForOwner(recordId, ownerId, update);
        if (!updated)
            throw weightRecordNotFound();
        await syncPetWeightCache(ownerId, petObjectId);
        return updated;
    },
    async remove(userId, petId, recordId) {
        await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const petObjectId = toObjectId(petId, 'petId');
        const existing = await weightRepository.findByIdForOwnerAndPet(recordId, ownerId, petObjectId);
        if (!existing)
            throw weightRecordNotFound();
        await weightRepository.softDeleteForOwner(recordId, ownerId);
        await syncPetWeightCache(ownerId, petObjectId);
    },
};
//# sourceMappingURL=weightService.js.map