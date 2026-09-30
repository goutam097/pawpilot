import { timelineService } from '../services/timelineService.js';
import { ok } from '../utils/apiResponse.js';
export const timelineController = {
    async get(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
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
//# sourceMappingURL=timelineController.js.map