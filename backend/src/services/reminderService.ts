import { Types } from 'mongoose';
import {
  reminderRepository,
  type CreateReminderData,
  type UpdateReminderData,
} from '../repositories/reminderRepository.js';
import { petRepository } from '../repositories/petRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import {
  advancePastNow,
  parseRule,
  type RepeatRule,
} from '../utils/recurrence.js';
import type { ReminderDocument, ReminderType } from '../models/Reminder.js';
import type {
  CreateReminderInput,
  UpdateReminderInput,
  ListRemindersQuery,
} from '../validators/reminderValidators.js';

/**
 * Reminder service.
 *
 * Two responsibilities:
 * 1. Enforce ownership — every operation scopes by userId.
 * 2. Manage recurrence — completing a recurring reminder advances its dueAt.
 *
 * Ownership enforcement strategy:
 *   Before touching a reminder, we first verify the pet exists AND belongs
 *   to the user (via `petRepository.findByIdForOwner`). This prevents a
 *   subtle bug where the URL's petId doesn't belong to the user but the
 *   reminder does — we don't want to allow creating reminders for someone
 *   else's pet.
 *
 *   Once we know the pet is legitimate, we scope reminder queries by
 *   `ownerId` and (for single-item ops) `petId`.
 */

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function reminderNotFound(): AppError {
  return new AppError('Reminder not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.REMINDER_NOT_FOUND);
}

/**
 * Convert a ReminderDocument to the API's serialized shape.
 *
 * We call `parseRule` here so the rule is validated on the way out — a
 * malformed rule in the DB would surface as a 500 rather than silent bad
 * data. If this is too aggressive, we can log-and-default instead later.
 */
export function serializeReminder(reminder: ReminderDocument) {
  const rule = parseRule(reminder.repeatRule);
  const isRecurring = rule.kind !== 'none';

  return {
    id: reminder._id.toString(),
    petId: reminder.petId.toString(),
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

/**
 * Verify the pet exists and belongs to the user. Throws PET_NOT_FOUND if not.
 * Returns the pet's id as an ObjectId.
 */
async function verifyPetOwnership(
  userId: string,
  petId: string,
): Promise<Types.ObjectId> {
  const ownerId = toObjectId(userId, 'userId');
  const petObjectId = toObjectId(petId, 'petId');
  const pet = await petRepository.findByIdForOwner(petObjectId, ownerId);
  if (!pet) {
    throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
  }
  return petObjectId;
}

export const reminderService = {
  async list(
    userId: string,
    petId: string,
    query: ListRemindersQuery,
  ): Promise<ReminderDocument[]> {
    const petObjectId = await verifyPetOwnership(userId, petId);
    const ownerId = toObjectId(userId, 'userId');
    return reminderRepository.listForPet({
      ownerId,
      petId: petObjectId,
      completed: query.completed,
      limit: query.limit ?? 50,
    });
  },

  async getOne(userId: string, petId: string, reminderId: string): Promise<ReminderDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId);
    const ownerId = toObjectId(userId, 'userId');
    const reminder = await reminderRepository.findByIdForOwnerAndPet(
      reminderId,
      ownerId,
      petObjectId,
    );
    if (!reminder) throw reminderNotFound();
    return reminder;
  },

  async create(
    userId: string,
    petId: string,
    input: CreateReminderInput,
  ): Promise<ReminderDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId);
    const ownerId = toObjectId(userId, 'userId');

    const rule: RepeatRule = input.repeatRule ?? { kind: 'none' };

    const data: CreateReminderData = {
      ownerId,
      petId: petObjectId,
      title: input.title,
      description: input.description ?? null,
      type: input.type as ReminderType,
      dueAt: input.dueAt,
      notifyAt: computeNotifyAt(
        input.dueAt,
        input.notifyAtOffsetMinutes ?? defaultNotifyOffset(input.type),
      ),
      repeatRule: rule,
      notificationEnabled: input.notificationEnabled ?? true,
      notifyAtOffsetMinutes: input.notifyAtOffsetMinutes ?? defaultNotifyOffset(input.type),
    };

    return reminderRepository.create(data);
  },

  async update(
    userId: string,
    petId: string,
    reminderId: string,
    input: UpdateReminderInput,
  ): Promise<ReminderDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId);
    const ownerId = toObjectId(userId, 'userId');
    const existing = await reminderRepository.findByIdForOwnerAndPet(
      reminderId,
      ownerId,
      petObjectId,
    );
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
      const dueAt = input.dueAt ?? existing.dueAt;
      const offset = input.notifyAtOffsetMinutes ?? existing.notifyAtOffsetMinutes;
      update.notifyAt = computeNotifyAt(dueAt, offset);
      update.lastNotifiedForDueAt = null;
    }

    const updated = await reminderRepository.updateForOwner(reminderId, ownerId, update);
    if (!updated) throw reminderNotFound();
    return updated;
  },
  
  /**
   * Complete a reminder.
   *
   * - One-time: mark completed, record completedAt.
   * - Recurring: advance dueAt to the next future occurrence, record
   *   lastCompletedAt. If the new dueAt would still be in the past (a
   *   reminder overdue by days), we keep advancing until it's in the future.
   *
   * `now` is captured once at the top of the function so the entire operation
   * uses a consistent time reference — important for correctness under load.
   */
  async complete(
    userId: string,
    petId: string,
    reminderId: string,
  ): Promise<ReminderDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId);
    const ownerId = toObjectId(userId, 'userId');
    const now = new Date();

    const reminder = await reminderRepository.findByIdForOwnerAndPet(
      reminderId,
      ownerId,
      petObjectId,
    );
    if (!reminder) throw reminderNotFound();

    const rule = parseRule(reminder.repeatRule);

    if (rule.kind === 'none') {
      // One-time reminder.
      if (reminder.completed) {
        throw new AppError(
          'Reminder is already completed',
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.REMINDER_ALREADY_COMPLETED,
        );
      }
      const updated = await reminderRepository.markCompleted(reminderId, ownerId, now);
      if (!updated) throw reminderNotFound();
      return updated;
    }

    // Recurring reminder — advance past now.
    const nextDue = advancePastNow(reminder.dueAt, rule, now);
    if (nextDue === null) {
      // Shouldn't happen for a recurring rule, but guard.
      throw new AppError(
        'Cannot compute next occurrence',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR,
      );
    }

    const updated = await reminderRepository.advanceRecurring(
      reminderId,
      ownerId,
      nextDue,
      computeNotifyAt(nextDue, reminder.notifyAtOffsetMinutes),
      now,
    );
    if (!updated) throw reminderNotFound();
    return updated;
  },

  async remove(userId: string, petId: string, reminderId: string): Promise<void> {
    const petObjectId = await verifyPetOwnership(userId, petId);
    const ownerId = toObjectId(userId, 'userId');

    // Explicit existence check so 404 is returned for missing reminders
    // instead of silently succeeding (which is misleading for clients).
    const existing = await reminderRepository.findByIdForOwnerAndPet(
      reminderId,
      ownerId,
      petObjectId,
    );
    if (!existing) throw reminderNotFound();

    await reminderRepository.softDeleteForOwner(reminderId, ownerId);
  },

  /**
   * Upcoming reminders for a specific pet — a public API method for future
   * "all pets' upcoming" screens.
   *
   * NOT called by the dashboard service — the dashboard verifies pet
   * ownership itself and calls the repository directly (avoiding a
   * duplicate pet lookup). If a future feature needs upcoming reminders
   * from outside the dashboard path, use this method.
   */
  async listUpcoming(
    userId: string,
    petId: string,
    limit: number,
  ): Promise<ReminderDocument[]> {
    const petObjectId = await verifyPetOwnership(userId, petId);
    const ownerId = toObjectId(userId, 'userId');
    return reminderRepository.listUpcomingForPet(ownerId, petObjectId, limit);
  },
};

/**
 * Default notify offset per reminder type. These are sensible defaults;
 * users can override on a per-reminder basis.
 */
function defaultNotifyOffset(type: string): number {
  switch (type) {
    case 'vaccination':
    case 'vet_visit':
      return 24 * 60; // 1 day before

    case 'medication':
    case 'feeding':
      return 0; // at due time

    case 'grooming':
      return 60; // 1 hour before

    case 'custom':
    default:
      return 0;
  }
}

/**
 * Compute `notifyAt` from `dueAt` and `notifyAtOffsetMinutes`.
 *
 * Why a helper? Because this must be called on every create AND every
 * update where either field changes. Miss it and the notification won't
 * fire. Centralizing makes it obvious where the logic lives.
 */
function computeNotifyAt(dueAt: Date, offsetMinutes: number): Date {
  return new Date(dueAt.getTime() - offsetMinutes * 60_000);

  
}



/* function defaultNotifyOffset(type: string): number {
  switch (type) {
    case 'vaccination':
    case 'vet_visit':
      return 24 * 60; // 1 day before
    case 'medication':
    case 'feeding':
      return 0; // at due time
    case 'grooming':
      return 60; // 1 hour before
    case 'custom':
    default:
      return 0;
  }
} */