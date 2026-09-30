import {
  Schema,
  model,
  Types,
  type HydratedDocument,
  type Model,
  type Query,
} from 'mongoose';
import { TRIP_TYPES } from './TravelTemplate.js';

export interface TravelChecklistItem {
  _id: Types.ObjectId;
  label: string;
  description: string | null;
  completed: boolean;
  completedAt: Date | null;
  order: number;
  sourceTemplateItemId: Types.ObjectId | null;
}

export interface TravelPlan {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  name: string;
  tripType: (typeof TRIP_TYPES)[number];
  destination: string | null;
  departureDate: Date;
  returnDate: Date | null;
  notes: string | null;
  checklist: TravelChecklistItem[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A checklist item inside a travel plan.
 *
 * Embedded — never queried independently, always read with the plan.
 */
const checklistItemSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500, default: null },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    order: { type: Number, required: true },
    sourceTemplateItemId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
  },
  { _id: true },
);

/**
 * A user's travel plan for a pet.
 */
const travelPlanSchema = new Schema<TravelPlan>(
  {
    createdBy: {
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
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as { deletedAt?: Date }).deletedAt;
        return ret;
      },
    },
  },
);

/**
 * List query: "travel plans for a pet, newest first."
 */
travelPlanSchema.index({ petId: 1, departureDate: -1 });

/**
 * Dashboard query: "next upcoming trip for a pet."
 */
travelPlanSchema.index({ petId: 1, departureDate: 1 });

travelPlanSchema.pre(/^find/, function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
//   next();
});

travelPlanSchema.pre('countDocuments', function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
//   next();
});

export type TravelPlanDocument = HydratedDocument<TravelPlan>;
export type TravelPlanModel = Model<TravelPlan>;

export const TravelPlanModel = model<TravelPlan>('TravelPlan', travelPlanSchema);