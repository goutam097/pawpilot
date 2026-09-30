import { vetVisitService, serializeVetVisit } from '../services/vetVisitService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const vetVisitController = {
    async list(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const visits = await vetVisitService.list(userId, petId, query);
        ok(res, { vetVisits: visits.map(serializeVetVisit) });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId, visitId } = req.params;
        const visit = await vetVisitService.getOne(userId, petId, visitId);
        ok(res, { vetVisit: serializeVetVisit(visit) });
    },
    async create(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const visit = await vetVisitService.create(userId, petId, input);
        ok(res, { vetVisit: serializeVetVisit(visit) }, HTTP_STATUS.CREATED);
    },
    async update(req, res) {
        const { userId } = req;
        const { petId, visitId } = req.params;
        const input = req.body;
        const visit = await vetVisitService.update(userId, petId, visitId, input);
        ok(res, { vetVisit: serializeVetVisit(visit) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId, visitId } = req.params;
        await vetVisitService.remove(userId, petId, visitId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
};
//# sourceMappingURL=vetVisitController.js.map