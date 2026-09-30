import type { Request, Response } from 'express';
import { timelineService } from '../services/timelineService.js';
import { ok } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';

interface TimelineQuery {
  limit?: number;
  before?: Date;
}

export const timelineController = {
  async get(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as TimelineQuery;
    const result = await timelineService.getTimeline(userId, petId, {
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.before !== undefined ? { before: query.before } : {}),
    });
    ok(res, {
      events: result.events,
      hasMore: result.hasMore,
    });
  },
};