import { z } from 'zod';
import { PLACE_TYPES } from '../models/Place.js';
const latSchema = z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'lat must be a number')
    .transform(Number)
    .refine((n) => n >= -90 && n <= 90, 'lat must be between -90 and 90');
const lngSchema = z
    .string()
    .regex(/^-?\d+(\.\d+)?$/, 'lng must be a number')
    .transform(Number)
    .refine((n) => n >= -180 && n <= 180, 'lng must be between -180 and 180');
const radiusSchema = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .refine((n) => n > 0 && n <= 50_000, 'radius must be between 1 and 50000 meters')
    .optional();
const typeSchema = z.enum(PLACE_TYPES);
export const searchPlacesQuerySchema = z
    .object({
    lat: latSchema,
    lng: lngSchema,
    radius: radiusSchema,
    type: typeSchema.optional(),
    openNow: z
        .union([z.literal('true'), z.literal('false')])
        .optional()
        .transform((v) => v === 'true'),
    minRating: z
        .string()
        .regex(/^\d+(\.\d+)?$/)
        .transform(Number)
        .refine((n) => n >= 0 && n <= 5)
        .optional(),
    limit: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .refine((n) => n > 0 && n <= 100)
        .optional(),
})
    .strict();
export const createOrUpdateReviewSchema = z
    .object({
    rating: z
        .number()
        .int('Rating must be a whole number')
        .min(1, 'Rating must be at least 1')
        .max(5, 'Rating must be at most 5'),
    text: z.string().trim().max(2000).optional().nullable(),
})
    .strict();
//# sourceMappingURL=placeValidators.js.map