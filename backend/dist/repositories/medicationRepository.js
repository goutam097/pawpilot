import { Types } from 'mongoose';
import { MedicationModel } from '../models/Medication.js';
export const medicationRepository = {
    async listForPet(ownerId, petId, onlyActive, now, limit) {
        const filter = { ownerId, petId };
        if (onlyActive) {
            filter.startDate = { $lte: now };
            filter.$or = [{ endDate: null }, { endDate: { $gte: now } }];
        }
        return MedicationModel.find(filter)
            .sort({ startDate: -1 })
            .limit(limit)
            .exec();
    },
    async findByIdForOwnerAndPet(medicationId, ownerId, petId) {
        if (!Types.ObjectId.isValid(medicationId))
            return null;
        return MedicationModel.findOne({ _id: medicationId, ownerId, petId }).exec();
    },
    async create(data) {
        return MedicationModel.create(data);
    },
    async updateForOwner(medicationId, ownerId, data) {
        if (!Types.ObjectId.isValid(medicationId))
            return null;
        return MedicationModel.findOneAndUpdate({ _id: medicationId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    async softDeleteForOwner(medicationId, ownerId) {
        if (!Types.ObjectId.isValid(medicationId))
            return null;
        return MedicationModel.findOneAndUpdate({ _id: medicationId, ownerId }, { $set: { deletedAt: new Date() } }, { new: true }).exec();
    },
    /**
     * Count active medications for a pet.
     *
     * "Active" means:
     *   startDate <= now AND (endDate IS NULL OR endDate >= now)
     *
     * Used by the dashboard.
     */
    async countActiveForPet(ownerId, petId, now) {
        return MedicationModel.countDocuments({
            ownerId,
            petId,
            startDate: { $lte: now },
            $or: [{ endDate: null }, { endDate: { $gte: now } }],
        }).exec();
    },
};
//# sourceMappingURL=medicationRepository.js.map