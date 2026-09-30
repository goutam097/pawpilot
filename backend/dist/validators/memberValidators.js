import { z } from 'zod';
const invitableRoleSchema = z.enum(['admin', 'caregiver', 'viewer']);
const changeableRoleSchema = z.enum(['admin', 'caregiver', 'viewer']);
export const createInvitationSchema = z
    .object({
    role: invitableRoleSchema,
    invitedEmail: z.string().trim().email('Please provide a valid email').max(254).optional().nullable(),
})
    .strict();
export const changeRoleSchema = z
    .object({
    role: changeableRoleSchema,
})
    .strict();
export const invitationTokenParamsSchema = z.object({
    token: z.string().min(16).max(64),
});
export const memberParamsSchema = z.object({
    petId: z.string().min(1),
    memberUserId: z.string().min(1),
});
//# sourceMappingURL=memberValidators.js.map