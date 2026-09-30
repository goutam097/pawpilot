import { Schema, model, } from 'mongoose';
/**
 * Medication regimen.
 *
 * Semantics:
 * - A medication is a REGIMEN: "give Max 1 tablet of Heartgard every month
 *   starting Jan 1, indefinitely."
 * - It has a start and (optional) end date.
 * - It has a frequency that determines the reminder's repeat rule.
 *
 * Ownership:
 * - ownerId denormalized for scoping.
 * - petId scopes to a pet.
 * - A linked reminder exists when frequency !== 'as_needed' AND the
 *   regimen's date range includes or extends past now.
 */
export const MEDICATION_FREQUENCIES = [
    'daily',
    'every_other_day',
    'weekly',
    'monthly',
    'as_needed',
];
const medicationSchema = new Schema({
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    petId: {
        type: Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    /**
     * Free-form dosage string. "1 tablet", "5mg", "0.5 mL".
     * We don't parse this — it's for the user's reference and for the
     * reminder body copy.
     */
    dosage: {
        type: String,
        trim: true,
        maxlength: 120,
        default: null,
    },
    frequency: {
        type: String,
        required: true,
        enum: MEDICATION_FREQUENCIES,
    },
    /**
     * When the regimen starts. Reminders begin from this date.
     */
    startDate: {
        type: Date,
        required: true,
    },
    /**
     * When the regimen ends. Null means indefinite (ongoing).
     * If set, the reminder is deactivated once this passes.
     */
    endDate: {
        type: Date,
        default: null,
    },
    /**
     * Time of day for the reminder, as "HH:MM" in the user's local timezone
     * at the time of creation. We use this to build the reminder's `dueAt`
     * (startDate at this time).
     *
     * NOTE ON TIMEZONES: We do not store the user's timezone. If the user
     * travels across timezones, the reminder fires at the same UTC instant,
     * not the same local time. Fixing this requires timezone-aware scheduling
     * (a Phase 26 concern).
     */
    timeOfDay: {
        type: String,
        required: true,
        match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'timeOfDay must be HH:MM'],
    },
    instructions: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    /**
     * The vet or clinic that prescribed the medication.
     */
    prescribedBy: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
    },
    /**
     * Whether the user wants notifications for this medication.
     * Defaults to true. When false, we don't create/maintain a reminder.
     */
    notificationsEnabled: {
        type: Boolean,
        default: true,
    },
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
 * List query: "medications for a pet."
 * Sorted by startDate descending (newest regimens first).
 */
medicationSchema.index({ petId: 1, startDate: -1 });
/**
 * Active count query: startDate <= now AND (endDate IS NULL OR endDate >= now).
 * The `startDate` and `endDate` fields are the range filters.
 */
medicationSchema.index({ ownerId: 1, petId: 1, startDate: -1 });
medicationSchema.index({ ownerId: 1, petId: 1, endDate: 1 });
medicationSchema.pre(/^find/, function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
});
medicationSchema.pre('countDocuments', function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
});
export const MedicationModel = model('Medication', medicationSchema);
//# sourceMappingURL=Medication.js.map