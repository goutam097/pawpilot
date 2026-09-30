import { medicationService, serializeMedication } from '../services/medicationService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const medicationController = {
    async list(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const medications = await medicationService.list(userId, petId, query);
        ok(res, { medications: medications.map(serializeMedication) });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId, medicationId } = req.params;
        const medication = await medicationService.getOne(userId, petId, medicationId);
        ok(res, { medication: serializeMedication(medication) });
    },
    async create(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const medication = await medicationService.create(userId, petId, input);
        ok(res, { medication: serializeMedication(medication) }, HTTP_STATUS.CREATED);
    },
    async update(req, res) {
        const { userId } = req;
        const { petId, medicationId } = req.params;
        const input = req.body;
        const medication = await medicationService.update(userId, petId, medicationId, input);
        ok(res, { medication: serializeMedication(medication) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId, medicationId } = req.params;
        await medicationService.remove(userId, petId, medicationId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
};
//# sourceMappingURL=medicationController.js.map