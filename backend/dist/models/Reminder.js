import { Schema, model, } from "mongoose";
/**
 * Reminder types — the categories of thing a reminder can represent.
 *
 * Kept in sync with the dashboard's `UpcomingEventType` (which has one extra
 * value `reminder` for the generic case — which we don't need here because
 * every document IS a reminder).
 */
export const REMINDER_TYPES = [
    "vaccination",
    "medication",
    "vet_visit",
    "grooming",
    "feeding",
    "custom",
];
const reminderSchema = new Schema({
    /**
     * Owner — used for authorization on every query. Denormalized from pet
     * so a "list my reminders across all pets" query is a single scan.
     */
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    petId: {
        type: Schema.Types.ObjectId,
        ref: "Pet",
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    type: {
        type: String,
        required: true,
        enum: REMINDER_TYPES,
    },
    /**
     * The next occurrence of this reminder. When the reminder is completed
     * and the rule is recurring, this advances. When the rule is 'none',
     * completion marks the reminder `completed` and this is the historical
     * due date.
     */
    dueAt: {
        type: Date,
        required: true,
    },
    /**
     * Repeat rule as a tagged union. Stored as a nested object with a `kind`
     * discriminator. Mongoose's Mixed type is used because the schema varies
     * by `kind`. The application validates the shape via Zod on the way in
     * and `parseRule` on the way out.
     */
    repeatRule: {
        type: Schema.Types.Mixed,
        required: true,
        default: { kind: "none" },
    },
    /**
     * Whether to send a local notification. Phase 10 wires Expo Notifications;
     * for now the flag is stored but unused by the server.
     */
    notificationEnabled: {
        type: Boolean,
        default: true,
    },
    /**
     * Minutes before `dueAt` to notify. 0 means "at dueAt."
     * Default is 1 day before (1440 minutes) for most types — sensible for
     * vaccinations and vet visits. Medication defaults to 0 (at due time).
     */
    notifyAtOffsetMinutes: {
        type: Number,
        default: 0,
        min: 0,
        max: 60 * 24 * 30, // up to 30 days before
    },
    /**
     * For non-recurring reminders: has it been completed?
     * For recurring reminders: this field is not used (they stay `false`).
     * The `lastCompletedAt` field tracks the last completion timestamp.
     */
    completed: {
        type: Boolean,
        default: false,
        index: true,
    },
    completedAt: {
        type: Date,
        default: null,
    },
    /**
     * For recurring reminders: timestamp of the most recent completion.
     * Advances the reminder; kept for history and analytics.
     */
    lastCompletedAt: {
        type: Date,
        default: null,
    },
    /**
     * Computed: `dueAt` minus `notifyAtOffsetMinutes`, in milliseconds.
     * Stored (not computed on read) so the notifier can query by it.
     *
     * Invariant: must be recomputed whenever `dueAt` or
     * `notifyAtOffsetMinutes` changes. The service enforces this.
     */
    notifyAt: {
        type: Date,
        required: true,
        index: true,
    },
    /**
     * If this reminder was auto-created from another record (vaccination,
     * medication, etc.), these fields link back to the source.
     *
     * Why not use `ref` + `refPath` polymorphism?
     * - Mongoose's refPath works but complicates queries (they need populate
     *   with a dynamic ref). For our use case (looking up by sourceType +
     *   sourceId in the same collection), a plain ObjectId + enum is simpler
     *   and more explicit.
     * - We don't currently `populate` the source; we only need to find the
     *   reminder given the source. A plain index handles that.
     *
     * Both fields are null for user-created reminders.
     */
    sourceType: {
        type: String,
        enum: ["vaccination", "medication", "vet_visit", "grooming", "feeding"],
        default: null,
    },
    sourceId: {
        type: Schema.Types.ObjectId,
        default: null,
    },
    /**
     * The `dueAt` for which we've already dispatched a notification.
     * Used to prevent duplicate notifications for the same occurrence.
     */
    lastNotifiedForDueAt: {
        type: Date,
        default: null,
    },
    /**
     * Soft delete — same pattern as Pet. Enforced via pre-hooks.
     */
    deletedAt: {
        type: Date,
        default: null,
        select: false,
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform(_doc, ret) {
            const serialized = ret;
            delete serialized.deletedAt;
            return ret;
        },
    },
});
/**
 * The primary dashboard query: "upcoming reminders for this pet."
 *   find({ petId, completed: false, deletedAt: null })
 *   sort({ dueAt: 1 })
 *   limit(N)
 *
 * Index matches: equality on (petId, completed), range/sort on dueAt.
 * `deletedAt: null` is added by the pre-find hook; because it's equality
 * too, it belongs in the index, but putting it after the range field
 * (dueAt) means it wouldn't be usable for the sort. Since all non-deleted
 * documents have `deletedAt: null`, and the vast majority aren't deleted,
 * we accept a small inefficiency here. Alternative: partial index, which
 * MongoDB supports but Mongoose types poorly.
 */
reminderSchema.index({ petId: 1, completed: 1, dueAt: 1 });
/**
 * "All reminders for this user, sorted by due date" — used by a future
 * global reminders screen.
 */
reminderSchema.index({ createdBy: 1, completed: 1, dueAt: 1 });
/**
 * The notifier's query: "pending reminders whose notifyAt falls in the
 * window and haven't been notified for this dueAt yet."
 *
 * Mongo can't directly index "notifyAt = dueAt - offsetInMinutes" because
 * that's computed. Instead, we query by `dueAt` range and filter in code —
 * the index supports the `dueAt` range scan.
 *
 * The `completed: 1` and `deletedAt` conditions are added by the pre-find
 * hook (deletedAt) and the query (completed).
 */
reminderSchema.index({ completed: 1, dueAt: 1, lastNotifiedForDueAt: 1 });
/**
 * The notifier's hot query:
 *   find({
 *     completed: false,
 *     notifyAt: { $lte: now },
 *     // filter lastNotifiedForDueAt != dueAt in $expr
 *   })
 *
 * Index supports the notifyAt range scan and completed equality.
 */
reminderSchema.index({ completed: 1, notifyAt: 1 });
/**
 * Find the reminder linked to a given source (e.g., a specific vaccination).
 * Sparse so nulls don't bloat the index.
 */
reminderSchema.index({ sourceType: 1, sourceId: 1 }, { sparse: true, partialFilterExpression: { sourceId: { $ne: null } } });
/**
 * Same soft-delete enforcement as Pet. Every find goes through this hook.
 */
reminderSchema.pre(/^find/, function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
});
export const ReminderModel = model("Reminder", reminderSchema);
//# sourceMappingURL=Reminder.js.map