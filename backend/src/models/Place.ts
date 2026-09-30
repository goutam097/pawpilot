import {
  Schema,
  model,
  type HydratedDocument,
  type Model,
} from 'mongoose';

/**
 * Place types — the categories of pet-friendly locations we support.
 *
 * Adding a new type requires:
 * 1. Adding to this enum.
 * 2. Adding the client-side label map.
 * 3. Nothing else — the model and query work generically.
 */
export const PLACE_TYPES = [
  'veterinarian',
  'dog_park',
  'groomer',
  'pet_store',
  'boarding',
  'pet_friendly_hotel',
  'pet_friendly_restaurant',
  'training',
  'other',
] as const;

export type PlaceType = (typeof PLACE_TYPES)[number];

export type PlaceDayName =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface PlaceRecord {
  externalId: string;
  name: string;
  type: PlaceType;
  location: { type: 'Point'; coordinates: [number, number] };
  address: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  phone: string | null;
  website: string | null;
  hours: Partial<Record<PlaceDayName, { open: string; close: string } | null>>;
  averageRating: number;
  reviewCount: number;
  description: string | null;
  isVerified: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single day's hours. `null` means closed that day.
 * Times are "HH:MM" in 24-hour format.
 */
const dayHoursSchema = new Schema(
  {
    open: { type: String, required: true },
    close: { type: String, required: true },
  },
  { _id: false },
);

const weeklyHoursSchema = new Schema(
  {
    monday: { type: dayHoursSchema, default: null },
    tuesday: { type: dayHoursSchema, default: null },
    wednesday: { type: dayHoursSchema, default: null },
    thursday: { type: dayHoursSchema, default: null },
    friday: { type: dayHoursSchema, default: null },
    saturday: { type: dayHoursSchema, default: null },
    sunday: { type: dayHoursSchema, default: null },
  },
  { _id: false },
);

/**
 * Place schema.
 *
 * Geospatial: `location` is a GeoJSON Point. Mongo's 2dsphere index supports
 * `$near`, `$geoWithin`, and `$geoIntersects`. Coordinates are stored as
 * [longitude, latitude] — the GeoJSON spec order, which is inverted from
 * how humans usually say "lat, lng".
 *
 * Address: free-form strings. We don't geocode — the location comes from the
 * seed data.
 */
const placeSchema = new Schema<PlaceRecord>(
  {
    /**
     * Stable external identifier used to make the seed script idempotent.
     * Never shown to users. If we ever integrate a real data source, this
     * would be its ID.
     */
    externalId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      required: true,
      enum: PLACE_TYPES,
      index: true,
    },
    /**
     * GeoJSON Point. Coordinates = [lng, lat] per GeoJSON spec.
     *
     * IMPORTANT: The order is [longitude, latitude], NOT [latitude, longitude].
     * Getting this wrong is a subtle bug — a place in California would appear
     * in the Indian Ocean.
     */
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (v: number[]) =>
            v.length === 2 &&
            v[0]! >= -180 && v[0]! <= 180 && // lng
            v[1]! >= -90 && v[1]! <= 90, // lat
          message: 'coordinates must be [lng, lat] with valid ranges',
        },
      },
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },
    city: { type: String, trim: true, maxlength: 100, default: null },
    region: { type: String, trim: true, maxlength: 100, default: null },
    postalCode: { type: String, trim: true, maxlength: 20, default: null },
    phone: { type: String, trim: true, maxlength: 40, default: null },
    website: { type: String, trim: true, maxlength: 500, default: null },
    hours: { type: weeklyHoursSchema, default: () => ({}) },
    /**
     * Denormalized review aggregate. Updated by the review service after
     * every review mutation. Read-heavy.
     */
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    /**
     * A short tagline shown on list rows.
     */
    description: { type: String, trim: true, maxlength: 500, default: null },
    /**
     * Convenience flags. Queryable for filtering.
     */
    isVerified: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null, select: false },
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
 * The geospatial index. `2dsphere` is required for `$near` queries.
 * No other index on `location` is needed.
 */
placeSchema.index({ location: '2dsphere' });

/**
 * Type + geospatial index for filtered searches.
 * Mongo can use a compound 2dsphere index but for our query pattern
 * (filter by type equality, then $near), the type index + geospatial index
 * is sufficient. Query planner will pick the better one.
 */
placeSchema.index({ type: 1, averageRating: -1 });

export type Place = PlaceRecord;
export type PlaceDocument = HydratedDocument<Place>;
export type PlaceModel = Model<Place>;

export const PlaceModel = model<Place>('Place', placeSchema);