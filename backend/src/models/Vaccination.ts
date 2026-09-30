import {
  Schema,
  model,
  Types,
  type HydratedDocument,
  type Model,
  type Query,
} from 'mongoose';

/**
 * Vaccination record.
 *
 * Semantics:
 * - A vaccination is a FACT: "this vaccine was given on this date."
 * - `nextDueAt` is a derived suggestion: "the vet says the next one is due
 *   on this date." It's optional — some vaccines are one-time (e.g., a
 *   specific booster given after a bite, per state protocol).
 *
 * Ownership:
 * - `createdBy` records who created the vaccination.
 * - `petId` scopes the record to a specific pet.
 * - A reminder can be linked via sourceType/sourceId — see Reminder model.
 */
export interface Vaccination {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  vaccineName: string;
  givenAt: Date;
  nextDueAt: Date | null;
  administeredBy: string | null;
  lotNumber: string | null;
  notes: string | null;
  createReminder: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const vaccinationSchema = new Schema<Vaccination>(
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
    vaccineName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    /**
     * When the vaccine was administered. In the past (or today). Cannot
     * be in the future — you can't record a vaccination you haven't given.
     */
    givenAt: {
      type: Date,
      required: true,
    },
    /**
     * Next dose due. Optional; when present, a reminder may be linked.
     * Must be after `givenAt` (enforced in service, not schema, because
     * cross-field validation is awkward in Mongoose).
     */
    nextDueAt: {
      type: Date,
      default: null,
    },
    /**
     * The vet or clinic that administered the vaccine. Free-form string
     * (we don't have a Vet entity yet; Phase 13 might add one).
     */
    administeredBy: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    /**
     * Batch/lot number for the specific vial. Occasionally useful for
     * reporting adverse reactions.
     */
    lotNumber: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
    /**
     * Whether a reminder should be linked to `nextDueAt`.
     * Stored for UI round-tripping (the edit form shows the checkbox state).
     * The actual reminder is a separate document (see the service).
     */
    createReminder: {
      type: Boolean,
      default: true,
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
        const serialized = ret as { deletedAt?: Date };
        delete serialized.deletedAt;
        return ret;
      },
    },
  },
);

/**
 * List query: "vaccinations for a pet, newest first."
 */
vaccinationSchema.index({ petId: 1, givenAt: -1 });

/**
 * Dashboard health query: "latest vaccination for this pet" and
 * "earliest future nextDueAt."
 */
vaccinationSchema.index({ petId: 1, nextDueAt: 1 });

/**
 * Same soft-delete enforcement as other models.
 */
vaccinationSchema.pre(/^find/, function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
});

vaccinationSchema.pre('countDocuments', function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
});

export type VaccinationDocument = HydratedDocument<Vaccination>;
export type VaccinationModel = Model<Vaccination>;

export const VaccinationModel = model<Vaccination>('Vaccination', vaccinationSchema);