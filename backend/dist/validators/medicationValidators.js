import { z } from 'zod';
import { MEDICATION_FREQUENCIES } from '../models/Medication.js';
const nameSchema = z
    .string()
    .trim()
    .min(1, 'Medication name is required')
    .max(120, 'Medication name is too long');
const dosageSchema = z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable();
const frequencySchema = z.enum(MEDICATION_FREQUENCIES);
const startDateSchema = z
    .string()
    .datetime({ message: 'startDate must be an ISO 8601 string' })
    .transform((s) => new Date(s));
const endDateSchema = z
    .string()
    .datetime({ message: 'endDate must be an ISO 8601 string' })
    .transform((s) => new Date(s))
    .optional()
    .nullable();
const timeOfDaySchema = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'timeOfDay must be HH:MM (24-hour)');
const instructionsSchema = z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable();
const prescribedBySchema = z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable();
export const createMedicationSchema = z
    .object({
    name: nameSchema,
    dosage: dosageSchema,
    frequency: frequencySchema,
    startDate: startDateSchema,
    endDate: endDateSchema,
    timeOfDay: timeOfDaySchema,
    instructions: instructionsSchema,
    prescribedBy: prescribedBySchema,
    notificationsEnabled: z.boolean().optional(),
})
    .strict()
    .refine((obj) => {
    if (!obj.endDate)
        return true;
    return obj.endDate.getTime() > obj.startDate.getTime();
}, { message: 'endDate must be after startDate', path: ['endDate'] });
export const updateMedicationSchema = z
    .object({
    name: nameSchema.optional(),
    dosage: dosageSchema,
    frequency: frequencySchema.optional(),
    startDate: startDateSchema.optional(),
    endDate: endDateSchema,
    timeOfDay: timeOfDaySchema.optional(),
    instructions: instructionsSchema,
    prescribedBy: prescribedBySchema,
    notificationsEnabled: z.boolean().optional(),
})
    .strict()
    .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
});
export const listMedicationsQuerySchema = z
    .object({
    /**
     * Filter: 'active' returns only currently-active regimens.
     * Default (no filter) returns all.
     */
    active: z
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
//# sourceMappingURL=medicationValidators.js.map