import { z } from 'zod';
import { TRIP_TYPES } from '../models/TravelTemplate.js';

const nameSchema = z.string().trim().min(1, 'Name is required').max(120);
const destinationSchema = z.string().trim().max(200).optional().nullable();
const notesSchema = z.string().trim().max(2000).optional().nullable();

const tripTypeSchema = z.enum(TRIP_TYPES);

const departureDateSchema = z
  .string()
  .datetime({ message: 'departureDate must be an ISO 8601 string' })
  .transform((s) => new Date(s));

const returnDateSchema = z
  .string()
  .datetime({ message: 'returnDate must be an ISO 8601 string' })
  .transform((s) => new Date(s))
  .optional()
  .nullable();

export const createTravelPlanSchema = z
  .object({
    name: nameSchema,
    tripType: tripTypeSchema,
    destination: destinationSchema,
    departureDate: departureDateSchema,
    returnDate: returnDateSchema,
    notes: notesSchema,
  })
  .strict()
  .refine(
    (obj) => {
      if (!obj.returnDate) return true;
      return obj.returnDate.getTime() > obj.departureDate.getTime();
    },
    { message: 'returnDate must be after departureDate', path: ['returnDate'] },
  );

export const updateTravelPlanSchema = z
  .object({
    name: nameSchema.optional(),
    tripType: tripTypeSchema.optional(),
    destination: destinationSchema,
    departureDate: departureDateSchema.optional(),
    returnDate: returnDateSchema,
    notes: notesSchema,
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

export const addChecklistItemSchema = z
  .object({
    label: z.string().trim().min(1, 'Label is required').max(200),
    description: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const updateChecklistItemSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    completed: z.boolean().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

export const listTravelPlansQuerySchema = z
  .object({
    upcomingOnly: z
      .union([z.literal('true'), z.literal('false')])
      .optional()
      .transform((v) => v === 'true'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n > 0 && n <= 100)
      .optional(),
  })
  .strict();

export type CreateTravelPlanInput = z.infer<typeof createTravelPlanSchema>;
export type UpdateTravelPlanInput = z.infer<typeof updateTravelPlanSchema>;
export type AddChecklistItemInput = z.infer<typeof addChecklistItemSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type ListTravelPlansQuery = z.infer<typeof listTravelPlansQuerySchema>;