import type { Request, Response } from 'express';
import {
  memberService,
  serializeMember,
  serializeInvitation,
} from '../services/memberService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateInvitationInput,
  ChangeRoleInput,
} from '../validators/memberValidators.js';

export const memberController = {
  async listMembers(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const members = await memberService.listMembers(userId, petId);
    const users = await memberService.resolveMemberUsers(members);
    ok(res, {
      members: members.map((m) => serializeMember(m, users.get(m.userId.toString()) ?? null)),
    });
  },

  async listPendingInvitations(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const invitations = await memberService.listPendingInvitations(userId, petId);
    // For MVP, we don't resolve the inviter's name (it's the requester
    // themselves in most cases). Could add later.
    ok(res, { invitations: invitations.map((i) => serializeInvitation(i, null)) });
  },

  async createInvitation(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateInvitationInput;
    const invitation = await memberService.createInvitation(userId, petId, {
      role: input.role,
      ...(input.invitedEmail !== undefined ? { invitedEmail: input.invitedEmail } : {}),
    });
    ok(res, { invitation: serializeInvitation(invitation, null) }, HTTP_STATUS.CREATED);
  },

  async revokeInvitation(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, invitationId } = req.params as { petId: string; invitationId: string };
    await memberService.revokeInvitation(userId, petId, invitationId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  async getInvitationByToken(req: Request, res: Response): Promise<void> {
    const { token } = req.params as { token: string };
    const { invitation, pet, inviter } = await memberService.getInvitationByToken(token);
    ok(res, {
      invitation: serializeInvitation(invitation, inviter?.name ?? null),
      pet,
    });
  },

  async acceptInvitation(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { token } = req.params as { token: string };
    const result = await memberService.acceptInvitation(userId, token);
    ok(res, result);
  },

  async removeMember(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, memberUserId } = req.params as { petId: string; memberUserId: string };
    await memberService.removeMember(userId, petId, memberUserId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  async changeRole(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, memberUserId } = req.params as { petId: string; memberUserId: string };
    const input = req.body as ChangeRoleInput;
    const member = await memberService.changeRole(userId, petId, memberUserId, input.role);
    const users = await memberService.resolveMemberUsers([member]);
    ok(res, { member: serializeMember(member, users.get(member.userId.toString()) ?? null) });
  },
};