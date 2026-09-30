import { z } from 'zod';

/**
 * Validators for vaccination endpoints.
 */

const vaccineNameSchema = z
  .string()
  .trim()
  .min(1, 'Vaccine name is required')
  .max(120, 'Vaccine name is too long');

const givenAtSchema = z
  .string()
  .datetime({ message: 'givenAt must be an ISO 8601 string' })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() <= Date.now() + 60_000, {
    // Allow up to 1 minute in the future to handle clock skew.
    message: 'givenAt cannot be in the future',
  });

const nextDueAtSchema = z
  .string()
  .datetime({ message: 'nextDueAt must be an ISO 8601 string' })
  .transform((s) => new Date(s))
  .optional()
  .nullable();

const administeredBySchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable();

const lotNumberSchema = z
  .string()
  .trim()
  .max(60)
  .optional()
  .nullable();

const notesSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable();

export const createVaccinationSchema = z
  .object({
    vaccineName: vaccineNameSchema,
    givenAt: givenAtSchema,
    nextDueAt: nextDueAtSchema,
    administeredBy: administeredBySchema,
    lotNumber: lotNumberSchema,
    notes: notesSchema,
    createReminder: z.boolean().optional(),
  })
  .strict()
  .refine(
    (obj) => {
      // If nextDueAt is provided, it must be after givenAt.
      if (!obj.nextDueAt) return true;
      return obj.nextDueAt.getTime() > obj.givenAt.getTime();
    },
    {
      message: 'nextDueAt must be after givenAt',
      path: ['nextDueAt'],
    },
  );

export const updateVaccinationSchema = z
  .object({
    vaccineName: vaccineNameSchema.optional(),
    givenAt: givenAtSchema.optional(),
    nextDueAt: nextDueAtSchema,
    administeredBy: administeredBySchema,
    lotNumber: lotNumberSchema,
    notes: notesSchema,
    createReminder: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

export const listVaccinationsQuerySchema = z
  .object({
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, 'limit must be between 1 and 100')
      .optional(),
  })
  .strict();

export type CreateVaccinationInput = z.infer<typeof createVaccinationSchema>;
export type UpdateVaccinationInput = z.infer<typeof updateVaccinationSchema>;
export type ListVaccinationsQuery = z.infer<typeof listVaccinationsQuerySchema>;