import { Types } from 'mongoose';
import {
  weightRepository,
  type CreateWeightData,
  type UpdateWeightData,
} from '../repositories/weightRepository.js';
import { PetModel } from '../models/Pet.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { require as requirePermission } from './petPermissionsService.js';
import { convertWeight, type WeightUnit } from '../utils/weightUnits.js';
import type { WeightRecordDocument } from '../models/WeightRecord.js';
import type { PetDocument } from '../models/Pet.js';
import type {
  CreateWeightInput,
  UpdateWeightInput,
  ListWeightsQuery,
} from '../validators/weightValidators.js';

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

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function weightRecordNotFound(): AppError {
  return new AppError(
    'Weight record not found',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.WEIGHT_RECORD_NOT_FOUND,
  );
}

/**
 * Serialize a weight record, converting to the pet's display unit.
 */
export function serializeWeight(
  record: WeightRecordDocument,
  petUnit: WeightUnit,
) {
  const displayWeight = convertWeight(record.weight, record.unit as WeightUnit, petUnit);
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

async function requirePetAccess(
  userId: string,
  petId: string,
  permission: 'records:read' | 'records:write' | 'records:delete',
): Promise<PetDocument> {
  const access = await requirePermission(userId, petId, permission);
  return access.pet;
}

/**
 * Recompute the pet's `weight` cache from the current latest record.
 * Called after any weight mutation.
 *
 * Cases:
 * - No records: pet.weight = null.
 * - Records: pet.weight = latest.weight converted to pet.weightUnit.
 */
async function syncPetWeightCache(
  petId: Types.ObjectId,
): Promise<void> {
  const pet = await PetModel.findById(petId).exec();
  if (!pet) return; // Pet was deleted; nothing to sync.

  const latest = await weightRepository.latestForPet(petId, 1);
  const latestRecord = latest[0];

  const petUnit = (pet.weightUnit ?? 'kg') as WeightUnit;
  const newPetWeight = latestRecord
    ? convertWeight(latestRecord.weight, latestRecord.unit as WeightUnit, petUnit)
    : null;

  // Only write if the value actually changed — avoids a no-op save and the
  // associated `updatedAt` churn.
  if (pet.weight !== newPetWeight) {
    await PetModel.updateOne(
      { _id: petId },
      { $set: { weight: newPetWeight } },
    ).exec();
  }
}

export const weightService = {
  async list(
    userId: string,
    petId: string,
    query: ListWeightsQuery,
  ): Promise<{ records: WeightRecordDocument[]; petUnit: WeightUnit }> {
    const pet = await requirePetAccess(userId, petId, 'records:read');
    const records = await weightRepository.listForPet(pet._id, query.limit ?? 100);
    return { records, petUnit: (pet.weightUnit ?? 'kg') as WeightUnit };
  },

  async getOne(
    userId: string,
    petId: string,
    recordId: string,
  ): Promise<{ record: WeightRecordDocument; petUnit: WeightUnit }> {
    const pet = await requirePetAccess(userId, petId, 'records:read');
    const record = await weightRepository.findByIdAndPet(recordId, pet._id);
    if (!record) throw weightRecordNotFound();
    return { record, petUnit: (pet.weightUnit ?? 'kg') as WeightUnit };
  },

  async create(
    userId: string,
    petId: string,
    input: CreateWeightInput,
  ): Promise<WeightRecordDocument> {
    const pet = await requirePetAccess(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    const data: CreateWeightData = {
      createdBy,
      petId: pet._id,
      weight: input.weight,
      unit: input.unit as WeightUnit,
      recordedAt: input.recordedAt ?? new Date(),
      notes: input.notes ?? null,
    };

    const record = await weightRepository.create(data);
    await syncPetWeightCache(pet._id);
    return record;
  },

  async update(
    userId: string,
    petId: string,
    recordId: string,
    input: UpdateWeightInput,
  ): Promise<WeightRecordDocument> {
    const pet = await requirePetAccess(userId, petId, 'records:write');

    const update: UpdateWeightData = {};
    if (input.weight !== undefined) update.weight = input.weight;
    if (input.unit !== undefined) update.unit = input.unit as WeightUnit;
    if (input.recordedAt !== undefined) update.recordedAt = input.recordedAt;
    if (input.notes !== undefined) update.notes = input.notes ?? null;

    const updated = await weightRepository.updateById(recordId, pet._id, update);
    if (!updated) throw weightRecordNotFound();

    await syncPetWeightCache(pet._id);
    return updated;
  },

  async remove(userId: string, petId: string, recordId: string): Promise<void> {
    const pet = await requirePetAccess(userId, petId, 'records:delete');

    const existing = await weightRepository.findByIdAndPet(recordId, pet._id);
    if (!existing) throw weightRecordNotFound();

    await weightRepository.softDeleteById(recordId, pet._id);
    await syncPetWeightCache(pet._id);
  },
};