import { z } from 'zod';

export const timelineQuerySchema = z
  .object({
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, 'limit must be between 1 and 100')
      .optional(),
    before: z
      .string()
      .datetime()
      .transform((s) => new Date(s))
      .optional(),
  })
  .strict();