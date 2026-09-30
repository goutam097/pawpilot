import { Types } from 'mongoose';
import { PlaceModel } from '../models/Place.js';
import { ReviewModel } from '../models/Review.js';
export const placeRepository = {
    /**
     * Geospatial search.
     *
     * Uses `$near` which returns documents sorted by ascending distance.
     * Mongo handles the sort automatically — no explicit `.sort()`.
     *
     * `$near` requires a `2dsphere` index on `location`. The index is defined
     * in the schema.
     *
     * Coordinate order: GeoJSON is [lng, lat]. This trips everyone up once.
     */
    async search(options) {
        const filter = {
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [options.lng, options.lat],
                    },
                    $maxDistance: options.radiusMeters,
                },
            },
        };
        if (options.type)
            filter.type = options.type;
        if (options.minRating !== undefined)
            filter.averageRating = { $gte: options.minRating };
        // Note: we don't filter `openNow` at the DB level. Computing "open now"
        // requires per-document time comparison, which Mongo can't do with an
        // index efficiently. We filter in the service after fetching.
        const places = await PlaceModel.find(filter)
            .limit(options.limit * 2) // fetch extra in case openNow filters some out
            .exec();
        return places;
    },
    async findById(placeId) {
        if (!Types.ObjectId.isValid(placeId))
            return null;
        return PlaceModel.findById(placeId).exec();
    },
    /**
     * Upsert used by the seed script. Idempotent by `externalId`.
     */
    async upsertByExternalId(externalId, data) {
        const result = await PlaceModel.findOneAndUpdate({ externalId }, { $set: { ...data, externalId } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
        return result;
    },
    /**
     * Recompute the review aggregate for a place.
     * Called after every review mutation.
     *
     * Uses a $group pipeline to compute count + average in one query.
     * Returns the new values for the caller to use if needed.
     */
    async recomputeReviewAggregate(placeId) {
        const result = await ReviewModel.aggregate([
            { $match: { placeId } },
            {
                $group: {
                    _id: null,
                    avg: { $avg: '$rating' },
                    count: { $sum: 1 },
                },
            },
        ]).exec();
        const avg = result[0]?.avg ?? 0;
        const count = result[0]?.count ?? 0;
        // Round the average to 2 decimals to keep the stored value stable and
        // avoid float noise on the client.
        const rounded = Math.round(avg * 100) / 100;
        await PlaceModel.updateOne({ _id: placeId }, { $set: { averageRating: rounded, reviewCount: count } }).exec();
        return { averageRating: rounded, reviewCount: count };
    },
};
//# sourceMappingURL=placeRepository.js.map