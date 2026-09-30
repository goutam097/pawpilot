import { Schema, model, Types, type HydratedDocument, type Model } from 'mongoose';

export interface WeightRecordData {
  petId: Types.ObjectId;
  createdBy: Types.ObjectId;
  weight: number;
  unit: 'kg' | 'lb';
  recordedAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Weight record — a single weight measurement for a pet.
 *
 * Why a separate collection and not just a `weight` field on Pet?
 * - History is the point. Owners want to see "27.5 → 28.0 → 28.2". A single
 *   field can't express that.
 * - Pet.weight is the CURRENT weight — a denormalized convenience field that
 *   the weight service recomputes after every mutation.
 * - The dashboard reads the latest N records to compute current/previous/change.
 */
const weightRecordSchema = new Schema<WeightRecordData>(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    /**
    * User who created this record. Authorization is resolved from pet
    * membership before repository access.
     */
    createdBy: {
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
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * The hot query for the dashboard: "latest N weight records for this pet,
 * newest first." This index supports it directly.
 */
weightRecordSchema.index({ petId: 1, recordedAt: -1 });

export type WeightRecord = WeightRecordData;
export type WeightRecordDocument = HydratedDocument<WeightRecord>;
export type WeightRecordModel = Model<WeightRecord>;

export const WeightRecordModel = model<WeightRecord>('WeightRecord', weightRecordSchema);