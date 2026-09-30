import { z } from 'zod';
const weightSchema = z
    .number()
    .positive('Weight must be positive')
    .max(500, 'Weight looks too large');
const unitSchema = z.enum(['kg', 'lb']);
const recordedAtSchema = z
    .string()
    .datetime({ message: 'recordedAt must be an ISO 8601 string' })
    .transform((s) => new Date(s))
    .refine((d) => d.getTime() <= Date.now() + 60_000, {
    message: 'recordedAt cannot be in the future',
});
const notesSchema = z.string().trim().max(500).optional().nullable();
export const createWeightSchema = z
    .object({
    weight: weightSchema,
    unit: unitSchema,
    recordedAt: recordedAtSchema.optional(),
    notes: notesSchema,
})
    .strict();
export const updateWeightSchema = z
    .object({
    weight: weightSchema.optional(),
    unit: unitSchema.optional(),
    recordedAt: recordedAtSchema.optional(),
    notes: notesSchema,
})
    .strict()
    .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
});
export const listWeightsQuerySchema = z
    .object({
    limit: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .refine((n) => n > 0 && n <= 100)
        .optional(),
})
    .strict();
//# sourceMappingURL=weightValidators.js.map