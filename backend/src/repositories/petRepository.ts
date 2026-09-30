import { Types } from 'mongoose';
import { PetModel, type PetDocument } from '../models/Pet.js';

/**
 * Pet repository — the only place that touches the Pet model.
 *
 * CRITICAL DESIGN POINT:
 * Every method that fetches a single pet takes `ownerId` and includes it in
 * the query filter. This makes authorization a *data-layer invariant*, not a
 * service-layer afterthought. A service can't "forget" the ownership check
 * because there's no method that returns a pet without one.
 *
 * For lists, `ownerId` is also required.
 *
 * For creates, we set `ownerId` to the authenticated user — the service
 * passes it in; the repository never trusts a `ownerId` from the request body.
 */

export interface CreatePetData {
  ownerId: Types.ObjectId;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed?: string | null;
  gender?: 'male' | 'female' | 'unknown';
  dateOfBirth?: Date | null;
  weight?: number | null;
  weightUnit?: 'kg' | 'lb';
  color?: string | null;
  microchipNumber?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
}

export interface UpdatePetData {
  name?: string;
  species?: 'dog' | 'cat' | 'other';
  breed?: string | null;
  gender?: 'male' | 'female' | 'unknown';
  dateOfBirth?: Date | null;
  weight?: number | null;
  weightUnit?: 'kg' | 'lb';
  color?: string | null;
  microchipNumber?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  archivedAt?: Date | null;
}

export interface ListPetsOptions {
  ownerId: Types.ObjectId;
  includeArchived: boolean;
  limit: number;
}

export const petRepository = {
  /**
   * Fetch a single pet by id, scoped to its owner.
   * Returns null if the pet doesn't exist OR belongs to someone else.
   * Callers cannot distinguish the two — by design.
   */
  async findByIdForOwner(
    petId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<PetDocument | null> {
    if (!Types.ObjectId.isValid(petId)) return null;
    return PetModel.findOne({ _id: petId, ownerId }).exec();
  },

  /**
   * List pets for an owner.
   *
   * `includeArchived=false` (default) excludes archived pets.
   * Sorted newest first.
   */
  async listForOwner(options: ListPetsOptions): Promise<PetDocument[]> {
    const filter: Record<string, unknown> = { ownerId: options.ownerId };
    if (!options.includeArchived) {
      filter.archivedAt = null;
    }
    return PetModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .exec();
  },

  async create(data: CreatePetData): Promise<PetDocument> {
    return PetModel.create(data);
  },

  /**
   * Update a pet, scoped to its owner.
   *
   * The `ownerId` filter in `findOneAndUpdate` means even a race where the
   * id is guessed correctly won't let an attacker modify another user's pet.
   * `new: true` returns the updated doc; `runValidators: true` enforces
   * schema validators (maxlength etc.) on update.
   */
  async updateForOwner(
    petId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
    data: UpdatePetData,
  ): Promise<PetDocument | null> {
    if (!Types.ObjectId.isValid(petId)) return null;
    return PetModel.findOneAndUpdate(
      { _id: petId, ownerId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  /**
   * Soft delete — sets `deletedAt` to now. The pet remains in the DB but
   * is invisible to all normal queries (see the pre-find hook).
   */
  async softDeleteForOwner(
    petId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<PetDocument | null> {
    if (!Types.ObjectId.isValid(petId)) return null;
    return PetModel.findOneAndUpdate(
      { _id: petId, ownerId },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
  },

  /**
   * Count pets for an owner — used for MVP tier limits (Phase 22).
   * `countDocuments` is hooked to exclude soft-deleted pets.
   */
  async countActiveForOwner(ownerId: Types.ObjectId): Promise<number> {
    return PetModel.countDocuments({ ownerId, deletedAt: null }).exec();
  },

  /**
 * Update by id only. Authorization must be checked by the caller.
 * Used by petService after petPermissions.checkAccess.
 */
async updateById(
  petId: Types.ObjectId,
  data: UpdatePetData,
): Promise<PetDocument | null> {
  return PetModel.findByIdAndUpdate(
    petId,
    { $set: data },
    { returnDocument: 'after', runValidators: true },
  ).exec();
},

async softDeleteById(petId: Types.ObjectId): Promise<PetDocument | null> {
  return PetModel.findByIdAndUpdate(
    petId,
    { $set: { deletedAt: new Date() } },
    { returnDocument: 'after' },
  ).exec();
}
};