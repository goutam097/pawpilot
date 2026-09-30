import { Types } from 'mongoose';
import { ReminderModel, type ReminderDocument, type ReminderType } from '../models/Reminder.js';
import type { RepeatRule } from '../utils/recurrence.js';

/**
 * Reminder repository.
 *
 * The service checks pet permissions before every call; repository reads are
 * scoped to the pet so family members share the same child records.
 */

export interface CreateReminderData {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  title: string;
  description: string | null;
  type: ReminderType;
  dueAt: Date;
  notifyAt: Date;
  repeatRule: RepeatRule;
  notificationEnabled: boolean;
  notifyAtOffsetMinutes: number;
}

export interface UpdateReminderData {
  title?: string;
  description?: string | null;
  type?: ReminderType;
  dueAt?: Date;
  notifyAt?: Date;
  repeatRule?: RepeatRule;
  notificationEnabled?: boolean;
  notifyAtOffsetMinutes?: number;
  lastNotifiedForDueAt?: Date | null;
}

export interface ListRemindersOptions {
  petId: Types.ObjectId;
  completed: 'false' | 'true' | 'all';
  limit: number;
}

export const reminderRepository = {
  async listForPet(options: ListRemindersOptions): Promise<ReminderDocument[]> {
    const filter: Record<string, unknown> = {
      petId: options.petId,
    };
    if (options.completed === 'false') filter.completed = false;
    if (options.completed === 'true') filter.completed = true;

    return ReminderModel.find(filter)
      .sort({ dueAt: 1 })
      .limit(options.limit)
      .exec();
  },

  /**
  * Fetch a single reminder scoped to the already-authorized pet.
   */
  async findByIdAndPet(
    reminderId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<ReminderDocument | null> {
    if (!Types.ObjectId.isValid(reminderId)) return null;
    return ReminderModel.findOne({ _id: reminderId, petId }).exec();
  },

  async create(data: CreateReminderData): Promise<ReminderDocument> {
    return ReminderModel.create(data);
  },

  async updateById(
    reminderId: string | Types.ObjectId,
    petId: Types.ObjectId,
    data: UpdateReminderData,
  ): Promise<ReminderDocument | null> {
    if (!Types.ObjectId.isValid(reminderId)) return null;
    return ReminderModel.findOneAndUpdate(
      { _id: reminderId, petId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  /**
   * Mark a one-time reminder complete. Only sets `completed`/`completedAt`.
   * Caller has already verified it's non-recurring.
   */
  async markCompletedById(
    reminderId: string | Types.ObjectId,
    petId: Types.ObjectId,
    now: Date,
  ): Promise<ReminderDocument | null> {
    if (!Types.ObjectId.isValid(reminderId)) return null;
    return ReminderModel.findOneAndUpdate(
      { _id: reminderId, petId },
      { $set: { completed: true, completedAt: now } },
      { returnDocument: 'after' },
    ).exec();
  },

  /**
   * Advance a recurring reminder to its next occurrence. Sets `dueAt` and
   * `lastCompletedAt`. Keeps `completed: false`.
   */
  async advanceRecurringById(
    reminderId: string | Types.ObjectId,
    petId: Types.ObjectId,
    nextDueAt: Date,
    nextNotifyAt: Date,
    now: Date,
  ): Promise<ReminderDocument | null> {
    if (!Types.ObjectId.isValid(reminderId)) return null;
    return ReminderModel.findOneAndUpdate(
      { _id: reminderId, petId },
      { $set: { dueAt: nextDueAt, notifyAt: nextNotifyAt, lastCompletedAt: now } },
      { returnDocument: 'after' },
    ).exec();
  },

  async softDeleteById(
    reminderId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<ReminderDocument | null> {
    if (!Types.ObjectId.isValid(reminderId)) return null;
    return ReminderModel.findOneAndUpdate(
      { _id: reminderId, petId },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
  },

  /**
   * Upcoming reminders for the dashboard. Fetches the N nearest-due
   * non-completed reminders for a pet.
   *
   */
  async listUpcomingForPet(
    petId: Types.ObjectId,
    now: Date,
    limit: number,
  ): Promise<ReminderDocument[]> {
    return ReminderModel.find({
      petId,
      completed: false,
      dueAt: { $lte: new Date(now.getTime() + 90 * 86_400_000) },
      // Include overdue reminders too — they're still "upcoming" from the
      // user's perspective (they need to do it). We sort by dueAt ascending
      // so the most overdue appear first.
    })
      .sort({ dueAt: 1 })
      .limit(limit)
      .exec();
  },

  /**
   * Count reminders due within [now, now + 7 days) for the dashboard stats.
   *
   * `completed: false` excludes done one-time reminders. Recurring reminders
   * always have `completed: false`, so they're included if their next due
   * falls in the window.
   */
  async countDueWithinWeek(
    petId: Types.ObjectId,
    now: Date,
  ): Promise<number> {
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000);
    return ReminderModel.countDocuments({
      petId,
      completed: false,
      dueAt: { $gte: now, $lt: sevenDaysFromNow },
    }).exec();
  },
};