import { Types } from 'mongoose';
import { ReminderModel } from '../models/Reminder.js';
export const reminderRepository = {
    async listForPet(options) {
        const filter = {
            ownerId: options.ownerId,
            petId: options.petId,
        };
        if (options.completed === 'false')
            filter.completed = false;
        if (options.completed === 'true')
            filter.completed = true;
        return ReminderModel.find(filter)
            .sort({ dueAt: 1 })
            .limit(options.limit)
            .exec();
    },
    /**
     * Fetch a single reminder, scoped to owner AND pet.
     *
     * Why both ownerId AND petId?
     *   - ownerId ensures authorization (this user owns the reminder).
     *   - petId ensures the URL is coherent: `/pets/A/reminders/B` should only
     *     return reminder B if it actually belongs to pet A. Without this,
     *     a user could fetch their own reminder under any pet's URL — confusing
     *     for the client and a small inconsistency we don't want.
     */
    async findByIdForOwnerAndPet(reminderId, ownerId, petId) {
        if (!Types.ObjectId.isValid(reminderId))
            return null;
        return ReminderModel.findOne({ _id: reminderId, ownerId, petId }).exec();
    },
    async create(data) {
        return ReminderModel.create(data);
    },
    async updateForOwner(reminderId, ownerId, data) {
        if (!Types.ObjectId.isValid(reminderId))
            return null;
        return ReminderModel.findOneAndUpdate({ _id: reminderId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    /**
     * Mark a one-time reminder complete. Only sets `completed`/`completedAt`.
     * Caller has already verified it's non-recurring.
     */
    async markCompleted(reminderId, ownerId, now) {
        if (!Types.ObjectId.isValid(reminderId))
            return null;
        return ReminderModel.findOneAndUpdate({ _id: reminderId, ownerId }, { $set: { completed: true, completedAt: now } }, { new: true }).exec();
    },
    /**
     * Advance a recurring reminder to its next occurrence. Sets `dueAt` and
     * `lastCompletedAt`. Keeps `completed: false`.
     */
    async advanceRecurring(reminderId, ownerId, nextDueAt, nextNotifyAt, now) {
        if (!Types.ObjectId.isValid(reminderId))
            return null;
        return ReminderModel.findOneAndUpdate({ _id: reminderId, ownerId }, { $set: { dueAt: nextDueAt, notifyAt: nextNotifyAt, lastCompletedAt: now } }, { new: true }).exec();
    },
    async softDeleteForOwner(reminderId, ownerId) {
        if (!Types.ObjectId.isValid(reminderId))
            return null;
        return ReminderModel.findOneAndUpdate({ _id: reminderId, ownerId }, { $set: { deletedAt: new Date() } }, { new: true }).exec();
    },
    /**
     * Upcoming reminders for the dashboard. Fetches the N nearest-due
     * non-completed reminders for a pet.
     *
     */
    async listUpcomingForPet(ownerId, petId, limit) {
        return ReminderModel.find({
            ownerId,
            petId,
            completed: false,
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
    async countDueWithinWeek(ownerId, petId, now) {
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 86_400_000);
        return ReminderModel.countDocuments({
            ownerId,
            petId,
            completed: false,
            dueAt: { $gte: now, $lt: sevenDaysFromNow },
        }).exec();
    },
};
//# sourceMappingURL=reminderRepository.js.map