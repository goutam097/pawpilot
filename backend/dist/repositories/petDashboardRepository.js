import { WeightRecordModel } from '../models/WeightRecord.js';
export const petDashboardRepository = {
    /**
     * Fetch the latest N weight records for a pet owned by this user.
     * Returns [] if the pet isn't owned by the user — the ownerId filter
     * enforces this at the query level.
     */
    async latestWeightRecords(ownerId, petId, limit) {
        const records = await WeightRecordModel.find({ ownerId, petId })
            .sort({ recordedAt: -1 })
            .limit(limit)
            .lean()
            .exec();
        // `lean()` returns the object shape we declared; cast through unknown to
        // satisfy TS's FlattenMaps machinery without sprinkling casts downstream.
        return records;
    },
};
//# sourceMappingURL=petDashboardRepository.js.map