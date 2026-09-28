import { Types } from 'mongoose';
import { petRepository, type CreatePetData, type UpdatePetData } from '../repositories/petRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import type { PetDocument } from '../models/Pet.js';
import type {
  CreatePetInput,
  UpdatePetInput,
  ListPetsQuery,
} from '../validators/petValidators.js';
import type { SerializedPet } from '../types/serialized.js';

/**
 * Pet service — business rules for pets.
 *
 * Ownership is enforced here in two ways:
 * - Lists and single-fetches pass `ownerId` into the repository, so the
 *   query itself only returns the user's pets.
 * - Mutations do the same. A missing result becomes PET_NOT_FOUND (404),
 *   never 403 — we don't reveal whether a pet id exists for another user.
 *
 * Soft delete, archive, and validation are coordinated here. The repository
 * stays mechanically simple.
 */

/** Serialize a pet document into the API's public shape. */
/* export function serializePet(pet: PetDocument) {
  return {
    id: pet._id.toString(),
    ownerId: pet.ownerId.toString(),
    name: pet.name,
    species: pet.species,
    breed: pet.breed ?? null,
    gender: pet.gender ?? 'unknown',
    dateOfBirth: pet.dateOfBirth ? pet.dateOfBirth.toISOString() : null,
    weight: pet.weight ?? null,
    weightUnit: pet.weightUnit ?? 'kg',
    color: pet.color ?? null,
    microchipNumber: pet.microchipNumber ?? null,
    notes: pet.notes ?? null,
    photoUrl: pet.photoUrl ?? null,
    archivedAt: pet.archivedAt ? pet.archivedAt.toISOString() : null,
    createdAt: pet.createdAt.toISOString(),
    updatedAt: pet.updatedAt.toISOString(),
  };
} */

/**
 * Serialize a pet document into the API's public shape.
 */
export function serializePet(pet: PetDocument): SerializedPet {
  const petDoc = pet as unknown as {
    _id: { toString(): string };
    ownerId?: { toString(): string } | null;
    name?: string | null;
    species?: 'dog' | 'cat' | 'other' | null;
    breed?: string | null;
    gender?: 'male' | 'female' | 'unknown' | null;
    dateOfBirth?: Date | null;
    weight?: number | null;
    weightUnit?: 'kg' | 'lb' | null;
    color?: string | null;
    microchipNumber?: string | null;
    notes?: string | null;
    photoUrl?: string | null;
    archivedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: petDoc._id.toString(),
    ownerId: petDoc.ownerId?.toString() ?? '',
    name: petDoc.name ?? '',
    species: petDoc.species ?? 'other',
    breed: petDoc.breed ?? null,
    gender: petDoc.gender ?? 'unknown',
    dateOfBirth: petDoc.dateOfBirth ? petDoc.dateOfBirth.toISOString() : null,
    weight: petDoc.weight ?? null,
    weightUnit: petDoc.weightUnit ?? 'kg',
    color: petDoc.color ?? null,
    microchipNumber: petDoc.microchipNumber ?? null,
    notes: petDoc.notes ?? null,
    photoUrl: petDoc.photoUrl ?? null,
    archivedAt: petDoc.archivedAt ? petDoc.archivedAt.toISOString() : null,
    createdAt: petDoc.createdAt ? petDoc.createdAt.toISOString() : new Date(0).toISOString(),
    updatedAt: petDoc.updatedAt ? petDoc.updatedAt.toISOString() : new Date(0).toISOString(),
  };
}

function toObjectId(userId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(userId)) {
    // This should never happen — userId comes from a verified JWT subject.
    // But if it did, we'd want a clear 401, not a CastError.
    throw new AppError('Invalid user session', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }
  return new Types.ObjectId(userId);
}

/** Standard "pet not found" error. Never reveals ownership vs non-existence. */
function petNotFoundError(): AppError {
  return new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
}

export const petService = {
  async create(userId: string, input: CreatePetInput): Promise<PetDocument> {
    const ownerId = toObjectId(userId);

    const data: CreatePetData = {
      ownerId,
      name: input.name,
      species: input.species,
      breed: input.breed ?? null,
      gender: input.gender ?? 'unknown',
      dateOfBirth: input.dateOfBirth ?? null,
      weight: input.weight ?? null,
      weightUnit: input.weightUnit ?? 'kg',
      color: input.color ?? null,
      microchipNumber: input.microchipNumber ?? null,
      notes: input.notes ?? null,
      photoUrl: input.photoUrl ?? null,
    };

    return petRepository.create(data);
  },

  async list(userId: string, query: ListPetsQuery): Promise<PetDocument[]> {
    const ownerId = toObjectId(userId);
    return petRepository.listForOwner({
      ownerId,
      includeArchived: query.includeArchived ?? false,
      limit: query.limit ?? 50,
    });
  },

  async getOne(userId: string, petId: string): Promise<PetDocument> {
    const ownerId = toObjectId(userId);
    const pet = await petRepository.findByIdForOwner(petId, ownerId);
    if (!pet) throw petNotFoundError();
    return pet;
  },

  async update(
    userId: string,
    petId: string,
    input: UpdatePetInput,
  ): Promise<PetDocument> {
    const ownerId = toObjectId(userId);

    const update: UpdatePetData = {};

    if (input.name !== undefined) update.name = input.name;
    if (input.species !== undefined) update.species = input.species;
    if (input.breed !== undefined) update.breed = input.breed ?? null;
    if (input.gender !== undefined) update.gender = input.gender;
    if (input.dateOfBirth !== undefined) update.dateOfBirth = input.dateOfBirth ?? null;
    if (input.weight !== undefined) update.weight = input.weight ?? null;
    if (input.weightUnit !== undefined) update.weightUnit = input.weightUnit;
    if (input.color !== undefined) update.color = input.color ?? null;
    if (input.microchipNumber !== undefined) update.microchipNumber = input.microchipNumber ?? null;
    if (input.notes !== undefined) update.notes = input.notes ?? null;
    if (input.photoUrl !== undefined) update.photoUrl = input.photoUrl ?? null;
    if (input.archived !== undefined) update.archivedAt = input.archived ? new Date() : null;

    const pet = await petRepository.updateForOwner(petId, ownerId, update);
    if (!pet) throw petNotFoundError();
    return pet;
  },

  async archive(userId: string, petId: string): Promise<PetDocument> {
    return petService.update(userId, petId, { archived: true });
  },

  async unarchive(userId: string, petId: string): Promise<PetDocument> {
    return petService.update(userId, petId, { archived: false });
  },

  async softDelete(userId: string, petId: string): Promise<void> {
    const ownerId = toObjectId(userId);
    const pet = await petRepository.softDeleteForOwner(petId, ownerId);
    if (!pet) throw petNotFoundError();
  },
};