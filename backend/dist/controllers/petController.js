import { petService, serializePet } from '../services/petService.js';
import { petDashboardService } from '../services/petDashboardService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
/**
 * Pet controller — HTTP layer only. Every method assumes:
 * - The user is authenticated (route applies `authenticate`).
 * - The body/query is validated (route applies `validate*`).
 */
export const petController = {
    async create(req, res) {
        const { userId } = req;
        const input = req.body;
        const pet = await petService.create(userId, input);
        ok(res, { pet: serializePet(pet) }, HTTP_STATUS.CREATED);
    },
    async list(req, res) {
        const { userId } = req;
        const query = req.query;
        const pets = await petService.list(userId, query);
        ok(res, { pets: pets.map(serializePet) });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const pet = await petService.getOne(userId, petId);
        ok(res, { pet: serializePet(pet) });
    },
    async getDashboard(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const dashboard = await petDashboardService.getDashboard(userId, petId);
        // Cache hint: dashboards are safe to cache on the client for a short
        // period. We set an HTTP header that mobile can use (though TanStack
        // Query's staleTime is what actually drives client cache). The header
        // is a nice signal and future-proofs us for CDN or intermediary caching.
        res.set('Cache-Control', 'private, max-age=30');
        ok(res, dashboard);
    },
    async update(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const pet = await petService.update(userId, petId, input);
        ok(res, { pet: serializePet(pet) });
    },
    async archive(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const pet = await petService.archive(userId, petId);
        ok(res, { pet: serializePet(pet) });
    },
    async unarchive(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const pet = await petService.unarchive(userId, petId);
        ok(res, { pet: serializePet(pet) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        await petService.softDelete(userId, petId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
};
//# sourceMappingURL=petController.js.map