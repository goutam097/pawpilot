import { z } from 'zod';
import { EXPENSE_CATEGORIES } from '../models/Expense.js';

const amountCentsSchema = z
  .number()
  .int('amountCents must be an integer')
  .positive('Amount must be positive')
  .max(100_000_000, 'Amount is too large');

const categorySchema = z.enum(EXPENSE_CATEGORIES);

const dateSchema = z
  .string()
  .datetime({ message: 'date must be an ISO 8601 string' })
  .transform((s) => new Date(s))
  .refine((d) => d.getTime() <= Date.now() + 60_000, {
    message: 'date cannot be in the future',
  });

const descriptionSchema = z.string().trim().max(200).optional().nullable();
const notesSchema = z.string().trim().max(2000).optional().nullable();

export const createExpenseSchema = z
  .object({
    amountCents: amountCentsSchema,
    category: categorySchema,
    date: dateSchema,
    description: descriptionSchema,
    notes: notesSchema,
  })
  .strict();

/**
 * Update schema. Note: `notes` is the only field editable on auto-created
 * expenses; the service enforces that. The schema itself accepts all fields;
 * the service refuses based on `sourceType`.
 */
export const updateExpenseSchema = z
  .object({
    amountCents: amountCentsSchema.optional(),
    category: categorySchema.optional(),
    date: dateSchema.optional(),
    description: descriptionSchema,
    notes: notesSchema,
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

export const listExpensesQuerySchema = z
  .object({
    category: categorySchema.optional(),
    from: z
      .string()
      .datetime()
      .transform((s) => new Date(s))
      .optional(),
    to: z
      .string()
      .datetime()
      .transform((s) => new Date(s))
      .optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n > 0 && n <= 200, 'limit must be between 1 and 200')
      .optional(),
    includeSummary: z
      .union([z.literal('true'), z.literal('false')])
      .optional()
      .transform((v) => v !== 'false'), // default true
  })
  .strict();

export const statsQuerySchema = z
  .object({
    from: z
      .string()
      .datetime()
      .transform((s) => new Date(s))
      .optional(),
    to: z
      .string()
      .datetime()
      .transform((s) => new Date(s))
      .optional(),
  })
  .strict();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type StatsQuery = z.infer<typeof statsQuerySchema>;