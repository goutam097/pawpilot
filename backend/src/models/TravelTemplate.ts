import { Schema, model, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

/**
 * Trip types — the categories of travel PawPilot knows about.
 *
 * Adding a new one requires:
 * 1. Adding it here.
 * 2. Seeding the corresponding template (see scripts/seedTravelTemplates.ts).
 * 3. Updating the mobile template picker.
 *
 * Kept as an enum so templates have a canonical key. Free-form trip types
 * would make template lookup impossible.
 */
export const TRIP_TYPES = [
  'domestic_flight',
  'international_flight',
  'road_trip',
  'boarding',
  'other',
] as const;

export type TripType = (typeof TRIP_TYPES)[number];

/**
 * A single checklist item in a template.
 */
const templateItemSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: null },
    /** Ordering hint — items appear in this order when a plan is created. */
    order: { type: Number, required: true },
  },
  { _id: true },
);

/**
 * Travel template.
 *
 * A template defines a starter checklist for a trip type. When a user creates
 * a travel plan of a given type, the template's items are COPIED into the
 * plan's checklist. Later edits to the template do NOT propagate to existing
 * plans — this is intentional (see copy-on-create rationale in the phase notes).
 *
 * Templates are seeded by a script and rarely change. Each has a version so
 * we can track when they were updated.
 */
const travelTemplateSchema = new Schema(
  {
    tripType: {
      type: String,
      required: true,
      enum: TRIP_TYPES,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    items: {
      type: [templateItemSchema],
      required: true,
      validate: [(arr: unknown[]) => arr.length > 0, 'Template must have at least one item'],
    },
    /** Semantic version of the template. Bumped when items change. */
    version: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type TravelTemplate = InferSchemaType<typeof travelTemplateSchema>;
export type TravelTemplateDocument = HydratedDocument<TravelTemplate>;
export type TravelTemplateModel = Model<TravelTemplate>;

export const TravelTemplateModel = model<TravelTemplate>('TravelTemplate', travelTemplateSchema);