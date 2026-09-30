import { placeService, serializePlace, serializeReview, } from '../services/placeService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const placeController = {
    async search(req, res) {
        const query = req.query;
        const places = await placeService.search(query);
        ok(res, { places: places.map(serializePlace) });
    },
    async getById(req, res) {
        const { placeId } = req.params;
        const place = await placeService.getById(placeId);
        const reviews = await placeService.listReviews(placeId);
        const { userId } = req;
        ok(res, {
            place: serializePlace(place),
            reviews: reviews.map((r) => serializeReview(r, userId)),
        });
    },
    async upsertReview(req, res) {
        const { userId } = req;
        const { placeId } = req.params;
        const input = req.body;
        const { review, updated } = await placeService.upsertReview(userId, placeId, input);
        // Refetch the place so the response includes the updated aggregate.
        const place = await placeService.getById(placeId);
        ok(res, {
            review: serializeReview(review, userId),
            place: serializePlace(place),
        }, updated ? HTTP_STATUS.OK : HTTP_STATUS.CREATED);
    },
    async deleteReview(req, res) {
        const { userId } = req;
        const { placeId } = req.params;
        await placeService.deleteReview(userId, placeId);
        const place = await placeService.getById(placeId);
        ok(res, { place: serializePlace(place) });
    },
};
//# sourceMappingURL=placeController.js.map