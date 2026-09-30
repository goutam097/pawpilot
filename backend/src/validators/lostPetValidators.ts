import { z } from 'zod';
import { CONTACT_METHODS } from '../models/LostPetReport.js';

const lastSeenAtSchema = z
  .string()
  .datetime({ message: 'lastSeenAt must be an ISO 8601 string' })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() <= Date.now() + 60_000, {
    message: 'lastSeenAt cannot be in the future',
  });

/**
 * Location: free-text. We deliberately do NOT allow the field to be empty —
 * a lost-pet report without a location is useless.
 *
 * The client UI warns against entering a full street address. We can't enforce
 * this server-side (there's no reliable way to detect "this is a home address"),
 * but the warning shifts the norm.
 */
const lastSeenLocationSchema = z
  .string()
  .trim()
  .min(2, 'Please provide a location where the pet was last seen')
  .max(300, 'Location is too long');

const descriptionSchema = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable();

const rewardOfferedSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable();

const contactMethodSchema = z.enum(CONTACT_METHODS);

export const createLostPetReportSchema = z
  .object({
    lastSeenAt: lastSeenAtSchema,
    lastSeenLocation: lastSeenLocationSchema,
    description: descriptionSchema,
    contactMethod: contactMethodSchema.optional(),
    contactPhone: z.string().trim().max(40).optional().nullable(),
    contactEmail: z.string().trim().email('Please provide a valid email').max(200).optional().nullable(),
    rewardOffered: rewardOfferedSchema,
  })
  .strict()
  .refine(
    (obj) => {
      // If contactMethod is 'phone', contactPhone must be provided.
      if (obj.contactMethod === 'phone' && !obj.contactPhone) return false;
      if (obj.contactMethod === 'email' && !obj.contactEmail) return false;
      return true;
    },
    {
      message: 'Contact info required for the chosen contact method',
    },
  );

export const updateLostPetReportSchema = z
  .object({
    lastSeenAt: lastSeenAtSchema.optional(),
    lastSeenLocation: lastSeenLocationSchema.optional(),
    description: descriptionSchema,
    rewardOffered: rewardOfferedSchema,
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateLostPetReportInput = z.infer<typeof createLostPetReportSchema>;
export type UpdateLostPetReportInput = z.infer<typeof updateLostPetReportSchema>;