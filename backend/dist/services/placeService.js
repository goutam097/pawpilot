import { Types } from 'mongoose';
import { placeRepository } from '../repositories/placeRepository.js';
import { ReviewModel } from '../models/Review.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Serialize a place for API responses.
 * Excludes internal fields (externalId, deletedAt).
 */
export function serializePlace(place) {
    const [lng, lat] = place.location.coordinates;
    return {
        id: place._id.toString(),
        name: place.name,
        type: place.type,
        location: { lat: lat ?? 0, lng: lng ?? 0 },
        address: place.address ?? null,
        city: place.city ?? null,
        region: place.region ?? null,
        postalCode: place.postalCode ?? null,
        phone: place.phone ?? null,
        website: place.website ?? null,
        hours: place.hours ?? {},
        averageRating: place.averageRating,
        reviewCount: place.reviewCount,
        description: place.description ?? null,
        isVerified: place.isVerified,
    };
}
/**
 * Serialize a review.
 *
 * The reviewer's identity is NEVER exposed. `isMine` is computed by the
 * caller (who knows the requesting user id).
 */
export function serializeReview(review, requestingUserId) {
    const isMine = requestingUserId !== null && review.userId.toString() === requestingUserId;
    return {
        id: review._id.toString(),
        placeId: review.placeId.toString(),
        rating: review.rating,
        text: review.text ?? null,
        isMine,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
    };
}
/**
 * Determine whether a place is open now, given its weekly hours.
 *
 * Computes using the SERVER's time (UTC). This is a documented limitation
 * for MVP — a place in a different timezone may show an incorrect status.
 * The long-term fix is storing the place's IANA timezone and computing
 * against it.
 */
function isOpenNow(place, now) {
    const dayNames = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
    ];
    const dayName = dayNames[now.getUTCDay()] ?? 'sunday';
    const hours = place.hours?.[dayName];
    if (!hours)
        return false;
    const [openH, openM] = hours.open.split(':').map(Number);
    const [closeH, closeM] = hours.close.split(':').map(Number);
    const minutesNow = now.getUTCHours() * 60 + now.getUTCMinutes();
    const minutesOpen = (openH ?? 0) * 60 + (openM ?? 0);
    const minutesClose = (closeH ?? 0) * 60 + (closeM ?? 0);
    // Handle overnight hours (e.g. 22:00 - 02:00).
    if (minutesClose < minutesOpen) {
        return minutesNow >= minutesOpen || minutesNow < minutesClose;
    }
    return minutesNow >= minutesOpen && minutesNow < minutesClose;
}
export const placeService = {
    async search(query) {
        const options = {
            lat: query.lat,
            lng: query.lng,
            radiusMeters: query.radius ?? 5000, // 5km default
            openNow: query.openNow ?? false,
            limit: query.limit ?? 30,
            ...(query.type ? { type: query.type } : {}),
            ...(query.minRating !== undefined ? { minRating: query.minRating } : {}),
        };
        let places = await placeRepository.search(options);
        // Post-filter by openNow if requested. See repo comment for why this
        // isn't a DB filter.
        if (options.openNow) {
            const now = new Date();
            places = places.filter((p) => isOpenNow(p, now));
        }
        return places.slice(0, options.limit);
    },
    async getById(placeId) {
        const place = await placeRepository.findById(placeId);
        if (!place) {
            throw new AppError('Place not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PLACE_NOT_FOUND);
        }
        return place;
    },
    async listReviews(placeId) {
        if (!Types.ObjectId.isValid(placeId))
            return [];
        return ReviewModel.find({ placeId: new Types.ObjectId(placeId) })
            .sort({ createdAt: -1 })
            .limit(50)
            .exec();
    },
    /**
     * Create or update the requesting user's review for a place.
     * Uses upsert semantics: if a review exists, update it.
     */
    async upsertReview(userId, placeId, input) {
        // Verify the place exists.
        const place = await placeRepository.findById(placeId);
        if (!place) {
            throw new AppError('Place not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PLACE_NOT_FOUND);
        }
        const userObjectId = new Types.ObjectId(userId);
        const placeObjectId = new Types.ObjectId(placeId);
        const existing = await ReviewModel.findOne({
            placeId: placeObjectId,
            userId: userObjectId,
        }).exec();
        let review;
        let updated = false;
        if (existing) {
            existing.rating = input.rating;
            existing.text = input.text ?? null;
            review = await existing.save();
            updated = true;
        }
        else {
            review = await ReviewModel.create({
                placeId: placeObjectId,
                userId: userObjectId,
                rating: input.rating,
                text: input.text ?? null,
            });
        }
        await placeRepository.recomputeReviewAggregate(placeObjectId);
        return { review, updated };
    },
    async deleteReview(userId, placeId) {
        const userObjectId = new Types.ObjectId(userId);
        const placeObjectId = new Types.ObjectId(placeId);
        const result = await ReviewModel.deleteOne({
            placeId: placeObjectId,
            userId: userObjectId,
        }).exec();
        if (result.deletedCount === 0) {
            throw new AppError('No review found to delete', HTTP_STATUS.NOT_FOUND, ERROR_CODES.REVIEW_NOT_FOUND);
        }
        await placeRepository.recomputeReviewAggregate(placeObjectId);
    },
};
//# sourceMappingURL=placeService.js.map