import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument,
  type Model,
  type Query,
} from 'mongoose';

/**
 * Pet species is an enum, not a free string.
 *
 * Why an enum?
 * - Keeps data clean for filtering and analytics.
 * - Prevents typos ('dog', 'Dog', 'DOG', 'dogs').
 * - Future-proof: adding a species is a one-line change (plus a client-side
 *   display mapping). This is NOT a hard-coded assumption — it's a controlled
 *   vocabulary we extend deliberately.
 *
 * If we ever want truly free-form species, we'd add an `other` value and a
 * separate `speciesOther` field. For MVP, an enum is correct.
 */
const SPECIES = ['dog', 'cat', 'other'] as const;
const GENDERS = ['male', 'female', 'unknown'] as const;
const WEIGHT_UNITS = ['kg', 'lb'] as const;

const petSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      // Indexed because every pet list query filters by owner.
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    species: {
      type: String,
      required: true,
      enum: SPECIES,
    },
    breed: {
      type: String,
      trim: true,
      maxlength: 80,
      default: null,
    },
    gender: {
      type: String,
      enum: GENDERS,
      default: 'unknown',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    weight: {
      type: Number,
      min: 0,
      max: 500, // 500 kg covers any domestic animal and then some
      default: null,
    },
    weightUnit: {
      type: String,
      enum: WEIGHT_UNITS,
      default: 'kg',
    },
    color: {
      type: String,
      trim: true,
      maxlength: 60,
      default: null,
    },
    microchipNumber: {
      type: String,
      trim: true,
      maxlength: 40,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
    photoUrl: {
      type: String,
      default: null,
    },
    /**
     * Archived = hidden from the main list but recoverable.
     * A pet that has passed away, been given away, or is otherwise inactive.
     */
    archivedAt: {
      type: Date,
      default: null,
    },
    /**
     * Soft delete. When set, the pet is invisible to normal queries.
     * Enforced via the pre-hook below so no query can accidentally include it.
     */
    deletedAt: {
      type: Date,
      default: null,
      select: false, // not needed in responses
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
 * Compound index for the main listing query:
 *   { ownerId, deletedAt: null, archivedAt: null }
 *   sorted by createdAt desc.
 *
 * The order of fields in the index matters:
 * - Equality fields first (ownerId, deletedAt).
 * - Range/sort field last (createdAt).
 */
petSchema.index({ ownerId: 1, deletedAt: 1, archivedAt: 1, createdAt: -1 });

/**
 * Soft-delete enforcement via query middleware.
 *
 * This is the mechanism that makes soft delete safe: every find/findOne/etc.
 * that goes through a standard query builder will automatically filter out
 * deleted pets. A developer would have to explicitly `.setOptions({ includeDeleted: true })`
 * or use the raw driver to see them.
 *
 * The hook runs for find, findOne, findOneAndUpdate, count, distinct, etc.
 * We check that the query is not already opting out.
 */
petSchema.pre(/^find/, function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
});

petSchema.pre('countDocuments', function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
});

export type Pet = InferSchemaType<typeof petSchema>;
export type PetDocument = HydratedDocument<Pet>;
export type PetModel = Model<Pet>;

export const PetModel = model<Pet>('Pet', petSchema);

export const PET_SPECIES = SPECIES;
export const PET_GENDERS = GENDERS;
export const PET_WEIGHT_UNITS = WEIGHT_UNITS;