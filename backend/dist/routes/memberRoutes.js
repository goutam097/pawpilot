import { Router } from 'express';
import { z } from 'zod';
import { memberController } from '../controllers/memberController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createInvitationSchema, changeRoleSchema, invitationTokenParamsSchema, memberParamsSchema, } from '../validators/memberValidators.js';
const petIdParamsSchema = z.object({ petId: z.string().min(1) });
const invitationParamsSchema = z.object({
    petId: z.string().min(1),
    invitationId: z.string().min(1),
});
/**
 * Members and invitations for a specific pet.
 * Mounted under /pets/:petId/members and /pets/:petId/invitations.
 */
export const memberRouter = Router({ mergeParams: true });
memberRouter.use(authenticate);
memberRouter.get('/', validate({ params: petIdParamsSchema }), asyncHandler(memberController.listMembers));
memberRouter.delete('/:memberUserId', validate({ params: memberParamsSchema }), asyncHandler(memberController.removeMember));
memberRouter.patch('/:memberUserId', validate({ params: memberParamsSchema, body: changeRoleSchema }), asyncHandler(memberController.changeRole));
export const invitationRouter = Router({ mergeParams: true });
invitationRouter.use(authenticate);
invitationRouter.get('/', validate({ params: petIdParamsSchema }), asyncHandler(memberController.listPendingInvitations));
invitationRouter.post('/', validate({ params: petIdParamsSchema, body: createInvitationSchema }), asyncHandler(memberController.createInvitation));
invitationRouter.delete('/:invitationId', validate({ params: invitationParamsSchema }), asyncHandler(memberController.revokeInvitation));
/**
 * Public invitation endpoints — mounted at /invitations (no pet prefix).
 * The token in the URL is the authorization.
 *
 * `GET /invitations/:token` — preview (no auth needed; but the mobile app
 *   requires login before opening the link anyway).
 * `POST /invitations/:token/accept` — requires auth (must be logged in).
 */
export const publicInvitationRouter = Router();
publicInvitationRouter.get('/:token', validate({ params: invitationTokenParamsSchema }), asyncHandler(memberController.getInvitationByToken));
// The accept route is authenticated.
export const authenticatedInvitationRouter = Router();
authenticatedInvitationRouter.use(authenticate);
authenticatedInvitationRouter.post('/:token/accept', validate({ params: invitationTokenParamsSchema }), asyncHandler(memberController.acceptInvitation));
//# sourceMappingURL=memberRoutes.js.map