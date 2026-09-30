import { Schema, model, } from 'mongoose';
import { TRIP_TYPES } from './TravelTemplate.js';
/**
 * A checklist item inside a travel plan.
 *
 * Embedded — never queried independently, always read with the plan.
 */
const checklistItemSchema = new Schema({
    label: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500, default: null },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    order: { type: Number, required: true },
    sourceTemplateItemId: {
        type: Schema.Types.ObjectId,
        default: null,
    },
}, { _id: true });
/**
 * A user's travel plan for a pet.
 */
const travelPlanSchema = new Schema({
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
    tripType: {
        type: String,
        required: true,
        enum: TRIP_TYPES,
    },
    destination: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
    },
    departureDate: {
        type: Date,
        required: true,
    },
    returnDate: {
        type: Date,
        default: null,
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    checklist: {
        type: [checklistItemSchema],
        default: [],
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
 * List query: "travel plans for a pet, newest first."
 */
travelPlanSchema.index({ petId: 1, departureDate: -1 });
/**
 * Dashboard query: "next upcoming trip for a pet."
 */
travelPlanSchema.index({ ownerId: 1, petId: 1, departureDate: 1 });
travelPlanSchema.pre(/^find/, function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
travelPlanSchema.pre('countDocuments', function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
export const TravelPlanModel = model('TravelPlan', travelPlanSchema);
//# sourceMappingURL=TravelPlan.js.map