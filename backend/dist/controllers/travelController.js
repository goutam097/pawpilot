import { travelService, serializeTravelPlan, serializeTemplate, } from '../services/travelService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const travelController = {
    async listTemplates(_req, res) {
        const templates = await travelService.listTemplates();
        ok(res, { templates: templates.map(serializeTemplate) });
    },
    async list(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const plans = await travelService.list(userId, petId, query);
        ok(res, { travelPlans: plans.map(serializeTravelPlan) });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId, planId } = req.params;
        const plan = await travelService.getOne(userId, petId, planId);
        ok(res, { travelPlan: serializeTravelPlan(plan) });
    },
    async create(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const plan = await travelService.create(userId, petId, input);
        ok(res, { travelPlan: serializeTravelPlan(plan) }, HTTP_STATUS.CREATED);
    },
    async update(req, res) {
        const { userId } = req;
        const { petId, planId } = req.params;
        const input = req.body;
        const plan = await travelService.update(userId, petId, planId, input);
        ok(res, { travelPlan: serializeTravelPlan(plan) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId, planId } = req.params;
        await travelService.remove(userId, petId, planId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
    async addItem(req, res) {
        const { userId } = req;
        const { petId, planId } = req.params;
        const input = req.body;
        const plan = await travelService.addChecklistItem(userId, petId, planId, input);
        ok(res, { travelPlan: serializeTravelPlan(plan) }, HTTP_STATUS.CREATED);
    },
    async updateItem(req, res) {
        const { userId } = req;
        const { petId, planId, itemId } = req.params;
        const input = req.body;
        const plan = await travelService.updateChecklistItem(userId, petId, planId, itemId, input);
        ok(res, { travelPlan: serializeTravelPlan(plan) });
    },
    async deleteItem(req, res) {
        const { userId } = req;
        const { petId, planId, itemId } = req.params;
        const plan = await travelService.deleteChecklistItem(userId, petId, planId, itemId);
        ok(res, { travelPlan: serializeTravelPlan(plan) });
    },
};
//# sourceMappingURL=travelController.js.map