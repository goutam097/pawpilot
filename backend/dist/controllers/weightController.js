import { weightService, serializeWeight } from '../services/weightService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const weightController = {
    async list(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const { records, petUnit } = await weightService.list(userId, petId, query);
        ok(res, { weights: records.map((r) => serializeWeight(r, petUnit)) });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId, weightId } = req.params;
        const { record, petUnit } = await weightService.getOne(userId, petId, weightId);
        ok(res, { weight: serializeWeight(record, petUnit) });
    },
    async create(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const record = await weightService.create(userId, petId, input);
        // Serialize with the pet's unit. The service returned the record; we
        // need the pet unit. We could re-fetch, but there's a cheaper way: the
        // service already loaded the pet; we could return the unit. Let's just
        // accept the extra query for now — weight creation is rare.
        const fresh = await weightService.getOne(userId, petId, record._id.toString());
        ok(res, { weight: serializeWeight(fresh.record, fresh.petUnit) }, HTTP_STATUS.CREATED);
    },
    async update(req, res) {
        const { userId } = req;
        const { petId, weightId } = req.params;
        const input = req.body;
        await weightService.update(userId, petId, weightId, input);
        const fresh = await weightService.getOne(userId, petId, weightId);
        ok(res, { weight: serializeWeight(fresh.record, fresh.petUnit) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId, weightId } = req.params;
        await weightService.remove(userId, petId, weightId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
};
//# sourceMappingURL=weightController.js.map