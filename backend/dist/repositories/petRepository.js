import { Types } from 'mongoose';
import { PetModel } from '../models/Pet.js';
export const petRepository = {
    /**
     * Fetch a single pet by id, scoped to its owner.
     * Returns null if the pet doesn't exist OR belongs to someone else.
     * Callers cannot distinguish the two — by design.
     */
    async findByIdForOwner(petId, ownerId) {
        if (!Types.ObjectId.isValid(petId))
            return null;
        return PetModel.findOne({ _id: petId, ownerId }).exec();
    },
    /**
     * List pets for an owner.
     *
     * `includeArchived=false` (default) excludes archived pets.
     * Sorted newest first.
     */
    async listForOwner(options) {
        const filter = { ownerId: options.ownerId };
        if (!options.includeArchived) {
            filter.archivedAt = null;
        }
        return PetModel.find(filter)
            .sort({ createdAt: -1 })
            .limit(options.limit)
            .exec();
    },
    async create(data) {
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
    async updateForOwner(petId, ownerId, data) {
        if (!Types.ObjectId.isValid(petId))
            return null;
        return PetModel.findOneAndUpdate({ _id: petId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    /**
     * Soft delete — sets `deletedAt` to now. The pet remains in the DB but
     * is invisible to all normal queries (see the pre-find hook).
     */
    async softDeleteForOwner(petId, ownerId) {
        if (!Types.ObjectId.isValid(petId))
            return null;
        return PetModel.findOneAndUpdate({ _id: petId, ownerId }, { $set: { deletedAt: new Date() } }, { new: true }).exec();
    },
    /**
     * Count pets for an owner — used for MVP tier limits (Phase 22).
     * `countDocuments` is hooked to exclude soft-deleted pets.
     */
    async countActiveForOwner(ownerId) {
        return PetModel.countDocuments({ ownerId, deletedAt: null }).exec();
    },
};
//# sourceMappingURL=petRepository.js.map