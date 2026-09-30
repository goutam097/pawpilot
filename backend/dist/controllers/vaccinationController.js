import { vaccinationService, serializeVaccination } from '../services/vaccinationService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const vaccinationController = {
    async list(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const vaccinations = await vaccinationService.list(userId, petId, query);
        ok(res, { vaccinations: vaccinations.map(serializeVaccination) });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId, vaccinationId } = req.params;
        const vaccination = await vaccinationService.getOne(userId, petId, vaccinationId);
        ok(res, { vaccination: serializeVaccination(vaccination) });
    },
    async create(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const vaccination = await vaccinationService.create(userId, petId, input);
        ok(res, { vaccination: serializeVaccination(vaccination) }, HTTP_STATUS.CREATED);
    },
    async update(req, res) {
        const { userId } = req;
        const { petId, vaccinationId } = req.params;
        const input = req.body;
        const vaccination = await vaccinationService.update(userId, petId, vaccinationId, input);
        ok(res, { vaccination: serializeVaccination(vaccination) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId, vaccinationId } = req.params;
        await vaccinationService.remove(userId, petId, vaccinationId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
};
//# sourceMappingURL=vaccinationController.js.map