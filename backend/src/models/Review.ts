import { Schema, model, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

/**
 * A user's review of a place.
 *
 * Constraints:
 * - One review per user per place. Enforced by a compound unique index.
 * - A user can update their review (same document, updated `rating`/`text`).
 * - Rating is an integer 1-5. No half-stars.
 */
const reviewSchema = new Schema(
  {
    placeId: {
      type: Schema.Types.ObjectId,
      ref: 'Place',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer',
      },
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * One review per user per place. The unique compound index enforces this.
 */
reviewSchema.index({ placeId: 1, userId: 1 }, { unique: true });

/**
 * For listing a place's reviews, newest first.
 */
reviewSchema.index({ placeId: 1, createdAt: -1 });

export type Review = InferSchemaType<typeof reviewSchema>;
export type ReviewDocument = HydratedDocument<Review>;
export type ReviewModel = Model<Review>;

export const ReviewModel = model<Review>('Review', reviewSchema);