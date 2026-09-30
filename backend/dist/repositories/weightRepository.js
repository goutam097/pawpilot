import { Types } from 'mongoose';
import { WeightRecordModel } from '../models/WeightRecord.js';
export const weightRepository = {
    async listForPet(ownerId, petId, limit) {
        return WeightRecordModel.find({ ownerId, petId })
            .sort({ recordedAt: -1 })
            .limit(limit)
            .exec();
    },
    async findByIdForOwnerAndPet(recordId, ownerId, petId) {
        if (!Types.ObjectId.isValid(recordId))
            return null;
        return WeightRecordModel.findOne({ _id: recordId, ownerId, petId }).exec();
    },
    async create(data) {
        return WeightRecordModel.create(data);
    },
    async updateForOwner(recordId, ownerId, data) {
        if (!Types.ObjectId.isValid(recordId))
            return null;
        return WeightRecordModel.findOneAndUpdate({ _id: recordId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    async softDeleteForOwner(recordId, ownerId) {
        if (!Types.ObjectId.isValid(recordId))
            return null;
        return WeightRecordModel.findOneAndUpdate({ _id: recordId, ownerId }, { $set: { deletedAt: new Date() } }, { new: true }).exec();
    },
    /**
     * Latest N records for a pet — used by the pet service to sync the
     * `pet.weight` cache and by the dashboard.
     */
    async latestForPet(ownerId, petId, limit) {
        return WeightRecordModel.find({ ownerId, petId })
            .sort({ recordedAt: -1 })
            .limit(limit)
            .exec();
    },
};
//# sourceMappingURL=weightRepository.js.map