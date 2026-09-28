import { Schema, model } from 'mongoose';
/**
 * Weight record — a single weight measurement for a pet.
 *
 * Why a separate collection and not just a `weight` field on Pet?
 * - History is the point. Owners want to see "27.5 → 28.0 → 28.2". A single
 *   field can't express that.
 * - Pet.weight is the CURRENT weight — a denormalized convenience field that
 *   we update on each weight record insert. Phase 14 will keep them in sync.
 * - The dashboard reads the latest N records to compute current/previous/change.
 */
const weightRecordSchema = new Schema({
    petId: {
        type: Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true,
    },
    /**
     * Denormalized owner — used by the dashboard's "read this pet's weight
     * history" query without a join. Set from the pet's ownerId on insert.
     * Phase 14's service enforces that ownerId matches the pet's owner.
     */
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    weight: {
        type: Number,
        required: true,
        min: 0,
        max: 500,
    },
    unit: {
        type: String,
        enum: ['kg', 'lb'],
        default: 'kg',
    },
    recordedAt: {
        type: Date,
        required: true,
        default: () => new Date(),
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
/**
 * The hot query for the dashboard: "latest N weight records for this pet,
 * newest first." This index supports it directly.
 */
weightRecordSchema.index({ petId: 1, recordedAt: -1 });
export const WeightRecordModel = model('WeightRecord', weightRecordSchema);
//# sourceMappingURL=WeightRecord.js.map