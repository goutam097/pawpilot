import { z } from 'zod';

/**
 * Zod schemas for auth request bodies.
 *
 * These are the ONLY place that defines what valid input looks like.
 * Controllers never check `if (!req.body.email)`. The validate middleware
 * runs a schema, and either produces a typed value or a 422.
 *
 * Design rules for these schemas:
 * - Be strict about shape (reject unknown keys) — protects against mass-assignment.
 * - Give clear messages — they surface to the user.
 * - Don't over-validate (e.g., no "must contain a digit" rules unless the
 *   product spec says so; they frustrate users and don't meaningfully
 *   improve password strength).
 */

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Please provide a valid email address')
  .max(254, 'Email is too long');

/**
 * Password policy:
 * - 8 characters minimum. Anything shorter is brute-forceable.
 * - 128 max. bcrypt has a 72-byte input limit; longer passwords get truncated
 *   silently, which is surprising. Rejecting >128 avoids the trap entirely.
 *
 * We do NOT require special characters, numbers, or mixed case. NIST 800-63B
 * (the modern guidance) explicitly recommends against such rules — they push
 * users toward weaker, more predictable passwords. Length is the only rule
 * that consistently helps.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name is too long');

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  });

// Types inferred from the schemas — used by services and controllers.
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;