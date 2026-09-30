import { Types } from 'mongoose';
import {
  reminderRepository,
  type CreateReminderData,
  type UpdateReminderData,
} from '../repositories/reminderRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import {
  advancePastNow,
  parseRule,
  type RepeatRule,
} from '../utils/recurrence.js';
import { require as requirePermission } from './petPermissionsService.js';
import type { ReminderDocument, ReminderType } from '../models/Reminder.js';
import type {
  CreateReminderInput,
  UpdateReminderInput,
  ListRemindersQuery,
} from '../validators/reminderValidators.js';

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function reminderNotFound(): AppError {
  return new AppError('Reminder not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.REMINDER_NOT_FOUND);
}

export function serializeReminder(reminder: ReminderDocument) {
  const rule = parseRule(reminder.repeatRule);
  const isRecurring = rule.kind !== 'none';

  return {
    id: reminder._id.toString(),
    petId: reminder.petId.toString(),
    createdBy: reminder.createdBy.toString(),
    title: reminder.title,
    description: reminder.description ?? null,
    type: reminder.type,
    dueAt: reminder.dueAt.toISOString(),
    repeatRule: rule,
    isRecurring,
    notificationEnabled: reminder.notificationEnabled ?? true,
    notifyAtOffsetMinutes: reminder.notifyAtOffsetMinutes ?? 0,
    completed: reminder.completed ?? false,
    completedAt: reminder.completedAt ? reminder.completedAt.toISOString() : null,
    lastCompletedAt: reminder.lastCompletedAt ? reminder.lastCompletedAt.toISOString() : null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

export const reminderService = {
  async list(
    userId: string,
    petId: string,
    query: ListRemindersQuery,
  ): Promise<ReminderDocument[]> {
    const access = await requirePermission(userId, petId, 'records:read');
    return reminderRepository.listForPet({
      petId: access.pet._id,
      completed: query.completed,
      limit: query.limit ?? 50,
    });
  },

  async getOne(userId: string, petId: string, reminderId: string): Promise<ReminderDocument> {
    const access = await requirePermission(userId, petId, 'records:read');
    const reminder = await reminderRepository.findByIdAndPet(
      reminderId,
      access.pet._id,
    );
    if (!reminder) throw reminderNotFound();
    return reminder;
  },

  async create(
    userId: string,
    petId: string,
    input: CreateReminderInput,
  ): Promise<ReminderDocument> {
    const access = await requirePermission(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    const rule: RepeatRule = input.repeatRule ?? { kind: 'none' };
    const notifyAtOffsetMinutes = input.notifyAtOffsetMinutes ?? defaultNotifyOffset(input.type);

    const data: CreateReminderData = {
      createdBy,
      petId: access.pet._id,
      title: input.title,
      description: input.description ?? null,
      type: input.type as ReminderType,
      dueAt: input.dueAt,
      notifyAt: computeNotifyAt(input.dueAt, notifyAtOffsetMinutes),
      repeatRule: rule,
      notificationEnabled: input.notificationEnabled ?? true,
      notifyAtOffsetMinutes,
    };

    return reminderRepository.create(data);
  },

  async update(
    userId: string,
    petId: string,
    reminderId: string,
    input: UpdateReminderInput,
  ): Promise<ReminderDocument> {
    const access = await requirePermission(userId, petId, 'records:write');

    const existing = await reminderRepository.findByIdAndPet(reminderId, access.pet._id);
    if (!existing) throw reminderNotFound();

    const update: UpdateReminderData = {};
    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description ?? null;
    if (input.type !== undefined) update.type = input.type as ReminderType;
    if (input.dueAt !== undefined) update.dueAt = input.dueAt;
    if (input.repeatRule !== undefined) update.repeatRule = input.repeatRule;
    if (input.notificationEnabled !== undefined) update.notificationEnabled = input.notificationEnabled;
    if (input.notifyAtOffsetMinutes !== undefined) update.notifyAtOffsetMinutes = input.notifyAtOffsetMinutes;

    if (input.dueAt !== undefined || input.notifyAtOffsetMinutes !== undefined) {
      const newDueAt = input.dueAt ?? existing.dueAt;
      const newOffset = input.notifyAtOffsetMinutes ?? existing.notifyAtOffsetMinutes ?? 0;
      update.notifyAt = computeNotifyAt(newDueAt, newOffset);
      update.lastNotifiedForDueAt = null;
    }

    const updated = await reminderRepository.updateById(reminderId, access.pet._id, update);
    if (!updated) throw reminderNotFound();
    return updated;
  },

  async complete(userId: string, petId: string, reminderId: string): Promise<ReminderDocument> {
    const access = await requirePermission(userId, petId, 'records:write');
    const now = new Date();

    const reminder = await reminderRepository.findByIdAndPet(reminderId, access.pet._id);
    if (!reminder) throw reminderNotFound();

    const rule = parseRule(reminder.repeatRule);

    if (rule.kind === 'none') {
      if (reminder.completed) {
        throw new AppError(
          'Reminder is already completed',
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.REMINDER_ALREADY_COMPLETED,
        );
      }
      const updated = await reminderRepository.markCompletedById(
        reminderId,
        access.pet._id,
        now,
      );
      if (!updated) throw reminderNotFound();
      return updated;
    }

    const nextDue = advancePastNow(reminder.dueAt, rule, now);
    if (nextDue === null) {
      throw new AppError(
        'Cannot compute next occurrence',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
      );
    }

    const newNotifyAt = computeNotifyAt(nextDue, reminder.notifyAtOffsetMinutes ?? 0);
    const updated = await reminderRepository.advanceRecurringById(
      reminderId,
      access.pet._id,
      nextDue,
      newNotifyAt,
      now,
    );
    if (!updated) throw reminderNotFound();
    return updated;
  },

  async remove(userId: string, petId: string, reminderId: string): Promise<void> {
    const access = await requirePermission(userId, petId, 'records:delete');

    const existing = await reminderRepository.findByIdAndPet(reminderId, access.pet._id);
    if (!existing) throw reminderNotFound();

    await reminderRepository.softDeleteById(reminderId, access.pet._id);
  },
};

function computeNotifyAt(dueAt: Date, offsetMinutes: number): Date {
  return new Date(dueAt.getTime() - offsetMinutes * 60_000);
}

function defaultNotifyOffset(type: string): number {
  switch (type) {
    case 'vaccination':
    case 'vet_visit':
      return 24 * 60;
    case 'medication':
    case 'feeding':
      return 0;
    case 'grooming':
      return 60;
    case 'custom':
    default:
      return 0;
  }
}