import { Types } from 'mongoose';
import { petRepository, type CreatePetData, type UpdatePetData } from '../repositories/petRepository.js';
import { PetModel, type PetDocument } from '../models/Pet.js';
import { FamilyMemberModel } from '../models/FamilyMember.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { require as requirePermission, getAccess, getRolesForPets } from './petPermissionsService.js';
import { createOwnerMembership } from './memberService.js';
import type { PetRole } from '../models/FamilyMember.js';
import type { SerializedPet } from '../types/serialized.js';
import type {
  CreatePetInput,
  UpdatePetInput,
  ListPetsQuery,
} from '../validators/petValidators.js';

/**
 * Pet service.
 *
 * After Phase 21:
 * - Pet CRUD authorizes via petPermissions.
 * - The pets list includes all pets the user has access to (owned + member).
 * - The serializer includes `currentUserRole`.
 */

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

/**
 * Serialize a pet for API responses.
 *
 * `currentUserRole` is required and reflects the requesting user's role on
 * the pet. The mobile app uses it to show/hide actions.
 */
export function serializePet(pet: PetDocument, currentUserRole: PetRole): SerializedPet {
  return {
    id: pet._id.toString(),
    ownerId: pet.ownerId.toString(),
    currentUserRole,
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
}

export const petService = {
  async create(userId: string, input: CreatePetInput): Promise<PetDocument> {
    const ownerId = toObjectId(userId, 'userId');

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

    const pet = await petRepository.create(data);

    // Create the owner's FamilyMember record. From this point on, access is
    // resolved via FamilyMember.
    await createOwnerMembership(pet._id, ownerId);

    return pet;
  },

  /**
   * List all pets the user has access to (owned or member of).
   *
   * Returns pets and their roles. The caller (controller) serializes each
   * with its role.
   */
  async list(
    userId: string,
    query: ListPetsQuery,
  ): Promise<Array<{ pet: PetDocument; role: PetRole }>> {
    const userObjectId = toObjectId(userId, 'userId');

    const [memberships, ownedPets] = await Promise.all([
      FamilyMemberModel.find({ userId: userObjectId }).select('petId role').lean().exec(),
      PetModel.find({ ownerId: userObjectId }).select('_id').lean().exec(),
    ]);

    const petIdsByString = new Map<string, Types.ObjectId>();
    for (const member of memberships) petIdsByString.set(member.petId.toString(), member.petId);
    for (const pet of ownedPets) petIdsByString.set(pet._id.toString(), pet._id);
    const petIds = [...petIdsByString.values()];
    if (petIds.length === 0) return [];

    const roleMap = new Map<string, PetRole>();
    for (const m of memberships) {
      roleMap.set(m.petId.toString(), m.role as PetRole);
    }
    for (const pet of ownedPets) {
      if (!roleMap.has(pet._id.toString())) roleMap.set(pet._id.toString(), 'owner');
    }

    // Fetch the pets themselves.
    const filter: Record<string, unknown> = {
      _id: { $in: petIds },
    };
    if (!query.includeArchived) {
      filter.archivedAt = null;
    }

    const pets = await PetModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(query.limit ?? 50)
      .exec();

    return pets.map((pet) => ({
      pet,
      role: roleMap.get(pet._id.toString()) ?? 'viewer',
    }));
  },

  async getOne(userId: string, petId: string): Promise<{ pet: PetDocument; role: PetRole }> {
    const access = await requirePermission(userId, petId, 'pet:read');
    return { pet: access.pet, role: access.role };
  },

  async update(
    userId: string,
    petId: string,
    input: UpdatePetInput,
  ): Promise<PetDocument> {
    const access = await requirePermission(userId, petId, 'pet:update');

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

    const pet = await petRepository.updateById(access.pet._id, update);
    if (!pet) {
      throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
    }
    return pet;
  },

  async archive(userId: string, petId: string): Promise<PetDocument> {
    return petService.update(userId, petId, { archived: true });
  },

  async unarchive(userId: string, petId: string): Promise<PetDocument> {
    return petService.update(userId, petId, { archived: false });
  },

  async softDelete(userId: string, petId: string): Promise<void> {
    const access = await requirePermission(userId, petId, 'pet:delete');
    await petRepository.softDeleteById(access.pet._id);
  },
};

// Re-export for other services that need role-aware pet listing.
export { getAccess, getRolesForPets };