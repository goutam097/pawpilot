import { Types } from 'mongoose';
import { VetVisitModel } from '../models/VetVisit.js';
export const vetVisitRepository = {
    async listForPet(ownerId, petId, status, limit) {
        const filter = { ownerId, petId };
        if (status === 'scheduled')
            filter.scheduled = true;
        if (status === 'completed')
            filter.scheduled = false;
        return VetVisitModel.find(filter)
            .sort({ visitDate: -1 })
            .limit(limit)
            .exec();
    },
    async findByIdForOwnerAndPet(visitId, ownerId, petId) {
        if (!Types.ObjectId.isValid(visitId))
            return null;
        return VetVisitModel.findOne({ _id: visitId, ownerId, petId }).exec();
    },
    async create(data) {
        return VetVisitModel.create(data);
    },
    async updateForOwner(visitId, ownerId, data) {
        if (!Types.ObjectId.isValid(visitId))
            return null;
        return VetVisitModel.findOneAndUpdate({ _id: visitId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    async softDeleteForOwner(visitId, ownerId) {
        if (!Types.ObjectId.isValid(visitId))
            return null;
        return VetVisitModel.findOneAndUpdate({ _id: visitId, ownerId }, { $set: { deletedAt: new Date() } }, { new: true }).exec();
    },
    /**
     * Scheduled visits in the future — for the dashboard's `upcoming`.
     */
    async listUpcomingScheduled(ownerId, petId, now, limit) {
        return VetVisitModel.find({
            ownerId,
            petId,
            scheduled: true,
            visitDate: { $gte: now },
        })
            .sort({ visitDate: 1 })
            .limit(limit)
            .exec();
    },
};
//# sourceMappingURL=vetVisitRepository.js.map