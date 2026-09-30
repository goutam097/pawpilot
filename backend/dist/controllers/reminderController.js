import { reminderService, serializeReminder } from '../services/reminderService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
/**
 * Reminder controller — HTTP glue for reminder endpoints.
 *
 * Every route is mounted under `/pets/:petId/reminders`, so `petId` is always
 * present in params. We type-check and pass it through to the service.
 */
export const reminderController = {
    async list(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const reminders = await reminderService.list(userId, petId, query);
        ok(res, { reminders: reminders.map(serializeReminder) });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId, reminderId } = req.params;
        const reminder = await reminderService.getOne(userId, petId, reminderId);
        ok(res, { reminder: serializeReminder(reminder) });
    },
    async create(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const reminder = await reminderService.create(userId, petId, input);
        ok(res, { reminder: serializeReminder(reminder) }, HTTP_STATUS.CREATED);
    },
    async update(req, res) {
        const { userId } = req;
        const { petId, reminderId } = req.params;
        const input = req.body;
        const reminder = await reminderService.update(userId, petId, reminderId, input);
        ok(res, { reminder: serializeReminder(reminder) });
    },
    async complete(req, res) {
        const { userId } = req;
        const { petId, reminderId } = req.params;
        const reminder = await reminderService.complete(userId, petId, reminderId);
        ok(res, { reminder: serializeReminder(reminder) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId, reminderId } = req.params;
        await reminderService.remove(userId, petId, reminderId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
};
//# sourceMappingURL=reminderController.js.map