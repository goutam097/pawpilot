import {
  Schema,
  model,
  Types,
  type HydratedDocument,
  type Model,
  type Query,
} from 'mongoose';

export interface VetVisit {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  visitDate: Date;
  vetName: string | null;
  clinicName: string | null;
  reason: string | null;
  diagnosis: string | null;
  treatment: string | null;
  costCents: number | null;
  notes: string | null;
  scheduled: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
const vetVisitSchema = new Schema<VetVisit>(
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
 * List query: "vet visits for a pet, newest first."
 */
vetVisitSchema.index({ petId: 1, visitDate: -1 });

/**
 * Dashboard upcoming query: "scheduled vet visits in the future."
 */
vetVisitSchema.index({ petId: 1, scheduled: 1, visitDate: 1 });

vetVisitSchema.pre(/^find/, function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
//   next();
});

vetVisitSchema.pre('countDocuments', function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
//   next();
});

export type VetVisitDocument = HydratedDocument<VetVisit>;
export type VetVisitModel = Model<VetVisit>;

export const VetVisitModel = model<VetVisit>('VetVisit', vetVisitSchema);