import type { Request, Response } from 'express';
import { reminderService, serializeReminder } from '../services/reminderService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateReminderInput,
  UpdateReminderInput,
  ListRemindersQuery,
} from '../validators/reminderValidators.js';

/**
 * Reminder controller — HTTP glue for reminder endpoints.
 *
 * Every route is mounted under `/pets/:petId/reminders`, so `petId` is always
 * present in params. We type-check and pass it through to the service.
 */
export const reminderController = {
  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as ListRemindersQuery;
    const reminders = await reminderService.list(userId, petId, query);
    ok(res, { reminders: reminders.map(serializeReminder) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, reminderId } = req.params as { petId: string; reminderId: string };
    const reminder = await reminderService.getOne(userId, petId, reminderId);
    ok(res, { reminder: serializeReminder(reminder) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateReminderInput;
    const reminder = await reminderService.create(userId, petId, input);
    ok(res, { reminder: serializeReminder(reminder) }, HTTP_STATUS.CREATED);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, reminderId } = req.params as { petId: string; reminderId: string };
    const input = req.body as UpdateReminderInput;
    const reminder = await reminderService.update(userId, petId, reminderId, input);
    ok(res, { reminder: serializeReminder(reminder) });
  },

  async complete(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, reminderId } = req.params as { petId: string; reminderId: string };
    const reminder = await reminderService.complete(userId, petId, reminderId);
    ok(res, { reminder: serializeReminder(reminder) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, reminderId } = req.params as { petId: string; reminderId: string };
    await reminderService.remove(userId, petId, reminderId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};