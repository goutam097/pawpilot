import { Schema, model, } from 'mongoose';
/**
 * Expense — a single financial record for a pet.
 *
 * Design choices:
 * - Amount stored in CENTS as an integer. Floats are a bug factory for money.
 * - Currency stored as an ISO 4217 code. USD only for MVP, but the field
 *   exists so we can add multi-currency later without a migration.
 * - `category` is an enum, closed for now, extensible.
 * - `sourceType`/`sourceId` link auto-created expenses back to their source
 *   (a vet visit, a grooming appointment, etc.). Same pattern as Reminder.
 *
 * This is the minimal version for Phase 13 (vet visit integration).
 * Phase 16 will add: recurring expenses, budgeting, richer analytics.
 */
export const EXPENSE_CATEGORIES = [
    'food',
    'vet',
    'medication',
    'grooming',
    'toys',
    'boarding',
    'insurance',
    'training',
    'other',
];
export const EXPENSE_SOURCE_TYPES = [
    'vet_visit',
    'grooming',
    'boarding',
];
const expenseSchema = new Schema({
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
     * Amount in the smallest currency unit (cents for USD).
     * Always positive. Signed values are a "refund" concept we don't support.
     */
    amountCents: {
        type: Number,
        required: true,
        min: 0,
        max: 100_000_000, // $1,000,000 — sanity cap
    },
    currency: {
        type: String,
        required: true,
        enum: ['USD'],
        default: 'USD',
    },
    category: {
        type: String,
        required: true,
        enum: EXPENSE_CATEGORIES,
    },
    /**
     * When the expense was incurred (typically the same day as the service).
     * Full instant for consistency; display uses the date portion.
     */
    date: {
        type: Date,
        required: true,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    sourceType: {
        type: String,
        enum: EXPENSE_SOURCE_TYPES,
        default: null,
    },
    sourceId: {
        type: Schema.Types.ObjectId,
        default: null,
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
 * Primary list query: "expenses for a pet, newest first."
 */
expenseSchema.index({ petId: 1, date: -1 });
/**
 * Analytics query: "expenses in a date range, by category."
 * The leading `petId` narrows, `date` supports the range.
 */
expenseSchema.index({ ownerId: 1, petId: 1, category: 1, date: -1 });
/**
 * Link lookup: "find the expense linked to this source."
 */
expenseSchema.index({ sourceType: 1, sourceId: 1 }, { partialFilterExpression: { sourceId: { $ne: null } } });
expenseSchema.pre(/^find/, function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
expenseSchema.pre('countDocuments', function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
export const ExpenseModel = model('Expense', expenseSchema);
//# sourceMappingURL=Expense.js.map