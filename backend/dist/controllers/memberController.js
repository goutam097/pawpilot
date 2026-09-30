import { memberService, serializeMember, serializeInvitation, } from '../services/memberService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
export const memberController = {
    async listMembers(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const members = await memberService.listMembers(userId, petId);
        const users = await memberService.resolveMemberUsers(members);
        ok(res, {
            members: members.map((m) => serializeMember(m, users.get(m.userId.toString()) ?? null)),
        });
    },
    async listPendingInvitations(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const invitations = await memberService.listPendingInvitations(userId, petId);
        // For MVP, we don't resolve the inviter's name (it's the requester
        // themselves in most cases). Could add later.
        ok(res, { invitations: invitations.map((i) => serializeInvitation(i, null)) });
    },
    async createInvitation(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const input = req.body;
        const invitation = await memberService.createInvitation(userId, petId, {
            role: input.role,
            ...(input.invitedEmail !== undefined ? { invitedEmail: input.invitedEmail } : {}),
        });
        ok(res, { invitation: serializeInvitation(invitation, null) }, HTTP_STATUS.CREATED);
    },
    async revokeInvitation(req, res) {
        const { userId } = req;
        const { petId, invitationId } = req.params;
        await memberService.revokeInvitation(userId, petId, invitationId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
    async getInvitationByToken(req, res) {
        const { token } = req.params;
        const { invitation, pet, inviter } = await memberService.getInvitationByToken(token);
        ok(res, {
            invitation: serializeInvitation(invitation, inviter?.name ?? null),
            pet,
        });
    },
    async acceptInvitation(req, res) {
        const { userId } = req;
        const { token } = req.params;
        const result = await memberService.acceptInvitation(userId, token);
        ok(res, result);
    },
    async removeMember(req, res) {
        const { userId } = req;
        const { petId, memberUserId } = req.params;
        await memberService.removeMember(userId, petId, memberUserId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
    async changeRole(req, res) {
        const { userId } = req;
        const { petId, memberUserId } = req.params;
        const input = req.body;
        const member = await memberService.changeRole(userId, petId, memberUserId, input.role);
        const users = await memberService.resolveMemberUsers([member]);
        ok(res, { member: serializeMember(member, users.get(member.userId.toString()) ?? null) });
    },
};
//# sourceMappingURL=memberController.js.map