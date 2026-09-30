import { z } from 'zod';
import { REMINDER_TYPES } from '../models/Reminder.js';

/**
 * Zod schemas for reminder endpoints.
 *
 * The repeatRule schema is a discriminated union, which mirrors the TypeScript
 * `RepeatRule` type exactly. This is the boundary that prevents malformed
 * rules from ever reaching the database.
 */

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(120, 'Title is too long');

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Description is too long')
  .optional()
  .nullable();

const typeSchema = z.enum(REMINDER_TYPES);

/**
 * Repeat rule schema.
 *
 * Why a discriminated union and not a single object with optional fields?
 * - We want `{ kind: 'daily', interval: 1 }` to be valid and complete.
 * - We want `{ kind: 'daily' }` (missing interval) to be invalid.
 * - We want `{ kind: 'none', interval: 1 }` to be invalid (interval is
 *   meaningless for non-recurring).
 *
 * Zod's `discriminatedUnion` gives us exactly this.
 */
const intervalSchema = z
  .number()
  .int('Interval must be an integer')
  .min(1, 'Interval must be at least 1')
  .max(365, 'Interval is too large'); // sanity cap

const repeatRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('daily'), interval: intervalSchema }).strict(),
  z.object({ kind: z.literal('weekly'), interval: intervalSchema }).strict(),
  z.object({ kind: z.literal('monthly'), interval: intervalSchema }).strict(),
  z.object({ kind: z.literal('yearly'), interval: intervalSchema }).strict(),
]);

/**
 * dueAt arrives as ISO 8601. We transform to a Date for the service.
 */
const dueAtSchema = z
  .string()
  .datetime({ message: 'dueAt must be an ISO 8601 string' })
  .transform((s) => new Date(s));

const notificationEnabledSchema = z.boolean().optional();

const notifyAtOffsetSchema = z
  .number()
  .int('Offset must be an integer')
  .min(0, 'Offset must be non-negative')
  .max(60 * 24 * 30, 'Offset cannot exceed 30 days')
  .optional();

export const createReminderSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema,
    type: typeSchema,
    dueAt: dueAtSchema,
    repeatRule: repeatRuleSchema.optional(),
    notificationEnabled: notificationEnabledSchema,
    notifyAtOffsetMinutes: notifyAtOffsetSchema,
  })
  .strict();

/**
 * Update schema — all fields optional, plus a refine for "at least one."
 * Note that `completed` is NOT updatable via PATCH; completion is its own
 * endpoint (`PATCH /:id/complete`) because it has side effects (advancing
 * recurring reminders). Letting it be set via generic update would let
 * clients bypass the recurrence logic.
 */
export const updateReminderSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema,
    type: typeSchema.optional(),
    dueAt: dueAtSchema.optional(),
    repeatRule: repeatRuleSchema.optional(),
    notificationEnabled: notificationEnabledSchema,
    notifyAtOffsetMinutes: notifyAtOffsetSchema,
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

export const listRemindersQuerySchema = z
  .object({
    /**
     * Filter by completion status.
     *   'false' (default) — only pending reminders
     *   'true'            — only completed
     *   'all'             — everything
     */
    completed: z
      .enum(['false', 'true', 'all'])
      .optional()
      .transform((v) => v ?? 'false'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n > 0 && n <= 100, 'limit must be between 1 and 100')
      .optional(),
  })
  .strict();

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type ListRemindersQuery = z.infer<typeof listRemindersQuerySchema>;