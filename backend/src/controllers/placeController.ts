import type { Request, Response } from 'express';
import {
  placeService,
  serializePlace,
  serializeReview,
} from '../services/placeService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  SearchPlacesQuery,
  CreateOrUpdateReviewInput,
} from '../validators/placeValidators.js';

export const placeController = {
  async search(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as SearchPlacesQuery;
    const places = await placeService.search(query);
    ok(res, { places: places.map(serializePlace) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { placeId } = req.params as { placeId: string };
    const place = await placeService.getById(placeId);
    const reviews = await placeService.listReviews(placeId);
    const { userId } = req as AuthenticatedRequest;
    ok(res, {
      place: serializePlace(place),
      reviews: reviews.map((r) => serializeReview(r, userId)),
    });
  },

  async upsertReview(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { placeId } = req.params as { placeId: string };
    const input = req.body as CreateOrUpdateReviewInput;

    const { review, updated } = await placeService.upsertReview(userId, placeId, input);

    // Refetch the place so the response includes the updated aggregate.
    const place = await placeService.getById(placeId);

    ok(
      res,
      {
        review: serializeReview(review, userId),
        place: serializePlace(place),
      },
      updated ? HTTP_STATUS.OK : HTTP_STATUS.CREATED,
    );
  },

  async deleteReview(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { placeId } = req.params as { placeId: string };
    await placeService.deleteReview(userId, placeId);
    const place = await placeService.getById(placeId);
    ok(res, { place: serializePlace(place) });
  },
};