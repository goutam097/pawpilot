import { z } from 'zod';
import { PET_SPECIES, PET_GENDERS, PET_WEIGHT_UNITS } from '../models/Pet.js';

/**
 * Zod schemas for pet endpoints.
 *
 * Notice the source of truth: PET_SPECIES / PET_GENDERS / PET_WEIGHT_UNITS
 * are imported from the model. If we add a species, the validator picks it
 * up automatically. Never duplicate enums between layers — that's how you
 * end up with a species that saves fine but fails validation, or vice versa.
 */

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(60, 'Name is too long');

const speciesSchema = z.enum(PET_SPECIES);
const genderSchema = z.enum(PET_GENDERS);
const weightUnitSchema = z.enum(PET_WEIGHT_UNITS);

const breedSchema = z
  .string()
  .trim()
  .max(80, 'Breed is too long')
  .optional()
  .nullable();

const colorSchema = z
  .string()
  .trim()
  .max(60, 'Color is too long')
  .optional()
  .nullable();

const microchipSchema = z
  .string()
  .trim()
  .max(40, 'Microchip number is too long')
  .optional()
  .nullable();

const notesSchema = z
  .string()
  .trim()
  .max(2000, 'Notes are too long')
  .optional()
  .nullable();

/**
 * Dates arrive as ISO strings from the client. We coerce them to Date
 * objects so the service and repository never deal with strings.
 *
 * `.refine` for "not in the future" — a pet can't be born tomorrow.
 */
const dobSchema = z
  .string()
  .datetime({ message: 'dateOfBirth must be an ISO 8601 string' })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() <= Date.now(), {
    message: 'dateOfBirth cannot be in the future',
  })
  .optional()
  .nullable();

const weightSchema = z
  .number()
  .min(0, 'Weight must be non-negative')
  .max(500, 'Weight looks too large')
  .optional()
  .nullable();

/**
 * photoUrl accepts either an https URL (for future Cloudinary uploads) or
 * a data: URI (for the current dev flow where we stub uploads).
 * Phase 17 will tighten this to "must be an https Cloudinary URL".
 */
const photoUrlSchema = z
  .string()
  .trim()
  .max(500_000, 'Photo payload too large') // data URIs can be big
  .refine(
    (s) => s.startsWith('https://') || s.startsWith('data:image/'),
    'photoUrl must be an https URL or a data:image/* URI',
  )
  .optional()
  .nullable();

export const createPetSchema = z
  .object({
    name: nameSchema,
    species: speciesSchema,
    breed: breedSchema,
    gender: genderSchema.optional(),
    dateOfBirth: dobSchema,
    weight: weightSchema,
    weightUnit: weightUnitSchema.optional(),
    color: colorSchema,
    microchipNumber: microchipSchema,
    notes: notesSchema,
    photoUrl: photoUrlSchema,
  })
  .strict();

/**
 * Update schema: all fields optional, plus a `.refine` so an empty body
 * is rejected. Empty PATCH is a client bug, not a no-op.
 */
export const updatePetSchema = z
  .object({
    name: nameSchema.optional(),
    species: speciesSchema.optional(),
    breed: breedSchema,
    gender: genderSchema.optional(),
    dateOfBirth: dobSchema,
    weight: weightSchema,
    weightUnit: weightUnitSchema.optional(),
    color: colorSchema,
    microchipNumber: microchipSchema,
    notes: notesSchema,
    photoUrl: photoUrlSchema,
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

/**
 * List query params: pagination + archived filter.
 * Both fields are optional; defaults applied in the service.
 */
export const listPetsQuerySchema = z
  .object({
    includeArchived: z
      .union([z.literal('true'), z.literal('false')])
      .optional()
      .transform((v) => v === 'true'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, 'limit must be between 1 and 100')
      .optional(),
    cursor: z.string().optional(),
  })
  .strict();

export type CreatePetInput = z.infer<typeof createPetSchema>;
export type UpdatePetInput = z.infer<typeof updatePetSchema>;
export type ListPetsQuery = z.infer<typeof listPetsQuerySchema>;