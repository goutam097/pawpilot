import { Types } from 'mongoose';
import { VaccinationModel } from '../models/Vaccination.js';
export const vaccinationRepository = {
    async listForPet(ownerId, petId, limit) {
        return VaccinationModel.find({ ownerId, petId })
            .sort({ givenAt: -1 })
            .limit(limit)
            .exec();
    },
    async findByIdForOwnerAndPet(vaccinationId, ownerId, petId) {
        if (!Types.ObjectId.isValid(vaccinationId))
            return null;
        return VaccinationModel.findOne({ _id: vaccinationId, ownerId, petId }).exec();
    },
    async create(data) {
        return VaccinationModel.create(data);
    },
    async updateForOwner(vaccinationId, ownerId, data) {
        if (!Types.ObjectId.isValid(vaccinationId))
            return null;
        return VaccinationModel.findOneAndUpdate({ _id: vaccinationId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    async softDeleteForOwner(vaccinationId, ownerId) {
        if (!Types.ObjectId.isValid(vaccinationId))
            return null;
        return VaccinationModel.findOneAndUpdate({ _id: vaccinationId, ownerId }, { $set: { deletedAt: new Date() } }, { new: true }).exec();
    },
    /**
     * The most recent vaccination for a pet (any type).
     * Used by the dashboard's `lastVaccinationAt`.
     */
    async latestForPet(ownerId, petId) {
        return VaccinationModel.findOne({ ownerId, petId })
            .sort({ givenAt: -1 })
            .exec();
    },
    /**
     * The earliest future `nextDueAt` for a pet.
     * Used by the dashboard's `nextVaccinationDueAt`.
     */
    async nextDueForPet(ownerId, petId, now) {
        return VaccinationModel.findOne({
            ownerId,
            petId,
            nextDueAt: { $gte: now },
        })
            .sort({ nextDueAt: 1 })
            .exec();
    },
};
//# sourceMappingURL=vaccinationRepository.js.map