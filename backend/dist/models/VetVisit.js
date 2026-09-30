import { Schema, model, } from 'mongoose';
/**
 * Vet visit record.
 *
 * Semantics:
 * - A visit is a FACT: "we went to the vet on this date; here's what
 *   happened."
 * - The `cost` field, when non-zero, creates a linked Expense.
 *
 * `diagnosis` and `treatment` are USER-ENTERED free text. They are what
 * the user wrote down from the vet's explanation. We never generate,
 * interpret, or suggest these.
 */
const vetVisitSchema = new Schema({
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
    /**
     * Full datetime. Some visits are scheduled appointments with a time;
     * some are walk-ins recorded after the fact. We store the instant; the
     * UI displays date-only by default.
     */
    visitDate: {
        type: Date,
        required: true,
    },
    vetName: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
    },
    clinicName: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
    },
    reason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
    },
    /**
     * What the vet said (user-entered). Named `diagnosis` for findability
     * but the UI labels it carefully — see the mobile form.
     */
    diagnosis: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    treatment: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    /**
     * Cost in cents. If > 0, a linked Expense is created.
     * If null or 0, no expense is created.
     */
    costCents: {
        type: Number,
        min: 0,
        max: 100_000_000,
        default: null,
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    /**
     * Whether the visit is a scheduled future appointment (true) or a
     * completed record (false). Users can create either from the same form.
     *
     * Auto-set on create based on visitDate: future → scheduled, past → completed.
     * Editable by the user for edge cases ("I forgot to mark it complete").
     */
    scheduled: {
        type: Boolean,
        default: false,
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
            delete ret.deletedAt;
            return ret;
        },
    },
});
/**
 * List query: "vet visits for a pet, newest first."
 */
vetVisitSchema.index({ petId: 1, visitDate: -1 });
/**
 * Dashboard upcoming query: "scheduled vet visits in the future."
 */
vetVisitSchema.index({ ownerId: 1, petId: 1, scheduled: 1, visitDate: 1 });
vetVisitSchema.pre(/^find/, function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
vetVisitSchema.pre('countDocuments', function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
export const VetVisitModel = model('VetVisit', vetVisitSchema);
//# sourceMappingURL=VetVisit.js.map