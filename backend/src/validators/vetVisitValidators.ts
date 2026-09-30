import { z } from 'zod';

const visitDateSchema = z
  .string()
  .datetime({ message: 'visitDate must be an ISO 8601 string' })
  .transform((s) => new Date(s));

const vetNameSchema = z.string().trim().max(200).optional().nullable();
const clinicNameSchema = z.string().trim().max(200).optional().nullable();
const reasonSchema = z.string().trim().max(500).optional().nullable();
const diagnosisSchema = z.string().trim().max(2000).optional().nullable();
const treatmentSchema = z.string().trim().max(2000).optional().nullable();
const notesSchema = z.string().trim().max(2000).optional().nullable();

/**
 * Cost arrives as an integer number of cents.
 * The mobile app parses "45.99" → 4599 before sending.
 * We accept 0 (explicit zero) and null (not recorded), both meaning "no expense."
 */
const costCentsSchema = z
  .number()
  .int('costCents must be an integer')
  .min(0, 'costCents must be non-negative')
  .max(100_000_000, 'costCents is too large')
  .optional()
  .nullable();

export const createVetVisitSchema = z
  .object({
    visitDate: visitDateSchema,
    vetName: vetNameSchema,
    clinicName: clinicNameSchema,
    reason: reasonSchema,
    diagnosis: diagnosisSchema,
    treatment: treatmentSchema,
    costCents: costCentsSchema,
    notes: notesSchema,
    scheduled: z.boolean().optional(),
  })
  .strict();

export const updateVetVisitSchema = z
  .object({
    visitDate: visitDateSchema.optional(),
    vetName: vetNameSchema,
    clinicName: clinicNameSchema,
    reason: reasonSchema,
    diagnosis: diagnosisSchema,
    treatment: treatmentSchema,
    costCents: costCentsSchema,
    notes: notesSchema,
    scheduled: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

export const listVetVisitsQuerySchema = z
  .object({
    /**
     * Filter: 'scheduled' returns only scheduled visits, 'completed' only
     * completed. Absent = all.
     */
    status: z.enum(['scheduled', 'completed']).optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n > 0 && n <= 100)
      .optional(),
  })
  .strict();

export type CreateVetVisitInput = z.infer<typeof createVetVisitSchema>;
export type UpdateVetVisitInput = z.infer<typeof updateVetVisitSchema>;
export type ListVetVisitsQuery = z.infer<typeof listVetVisitsQuerySchema>;