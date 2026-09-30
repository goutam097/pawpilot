import { Types } from 'mongoose';
import {
  FamilyMemberModel,
  PET_ROLES,
  type FamilyMemberDocument,
  type PetRole,
} from '../models/FamilyMember.js';
import { InvitationModel, INVITABLE_ROLES, type InvitationDocument } from '../models/Invitation.js';
import { PetModel } from '../models/Pet.js';
import { UserModel } from '../models/User.js';
import { require as requirePermission, getAccess } from './petPermissionsService.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { env } from '../config/env.js';

/**
 * Membership and invitation service.
 *
 * This service owns:
 * - Listing a pet's members.
 * - Inviting new members (creating invitations).
 * - Accepting invitations (creating FamilyMember records).
 * - Removing members.
 * - Changing roles.
 *
 * Permission checks are delegated to `petPermissionsService`. This service
 * only decides "what happens after the check passes."
 */

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

export function serializeMember(member: FamilyMemberDocument, user: { name: string; email: string } | null) {
  return {
    id: member._id.toString(),
    userId: member.userId.toString(),
    role: member.role,
    name: user?.name ?? null,
    email: user?.email ?? null,
    joinedAt: member.joinedAt.toISOString(),
  };
}

export function serializeInvitation(
  invitation: InvitationDocument,
  invitedByName: string | null,
) {
  const now = new Date();
  const isExpired = invitation.expiresAt < now;
  const isAccepted = invitation.acceptedAt !== null;

  return {
    id: invitation._id.toString(),
    role: invitation.role,
    invitedEmail: invitation.invitedEmail ?? null,
    invitedByName,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null,
    isExpired,
    isAccepted,
    isActive: !isExpired && !isAccepted,
    inviteUrl: `${env.publicAppUrl}/invite/${invitation.token}`,
  };
}

export const memberService = {
  async listMembers(userId: string, petId: string): Promise<FamilyMemberDocument[]> {
    await requirePermission(userId, petId, 'members:view');
    const petObjectId = toObjectId(petId, 'petId');
    return FamilyMemberModel.find({ petId: petObjectId }).sort({ joinedAt: 1 }).exec();
  },

  /**
   * Bulk-resolve user info for a set of FamilyMember documents.
   * Used by the members list endpoint to attach names to roles.
   */
  async resolveMemberUsers(members: FamilyMemberDocument[]): Promise<Map<string, { name: string; email: string }>> {
    const userIds = members.map((m) => m.userId);
    const users = await UserModel.find({ _id: { $in: userIds } })
      .select('name email')
      .exec();
    const map = new Map<string, { name: string; email: string }>();
    for (const u of users) {
      map.set(u._id.toString(), { name: u.name, email: u.email });
    }
    return map;
  },

  /**
   * Create an invitation.
   * The inviter must have `members:invite`.
   * The role must be invitable (not 'owner').
   * If the invitee is already a member, we reject — no need to invite.
   */
  async createInvitation(
    userId: string,
    petId: string,
    input: { role: PetRole; invitedEmail?: string | null },
  ): Promise<InvitationDocument> {
    const access = await requirePermission(userId, petId, 'members:invite');

    if (!INVITABLE_ROLES.includes(input.role)) {
      throw new AppError(
        'This role cannot be assigned via invitation',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const petObjectId = toObjectId(petId, 'petId');

    // If an email is provided, check if that user is already a member.
    // (This is a UX convenience — not a security check. Anyone with the
    // token can accept regardless of email.)
    if (input.invitedEmail) {
      const invitedUser = await UserModel.findOne({ email: input.invitedEmail.toLowerCase() }).exec();
      if (invitedUser) {
        const existingMember = await FamilyMemberModel.findOne({
          petId: petObjectId,
          userId: invitedUser._id,
        }).exec();
        if (existingMember) {
          throw new AppError(
            'This person is already a member of this pet',
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.ALREADY_A_MEMBER,
          );
        }
      }
    }

    const invitation = await InvitationModel.create({
      petId: petObjectId,
      invitedBy: toObjectId(userId, 'userId'),
      role: input.role,
      invitedEmail: input.invitedEmail?.toLowerCase() ?? null,
    });

    // Silence unused var warning on `access`.
    void access;

    return invitation;
  },

  /**
   * List pending (active) invitations for a pet.
   */
  async listPendingInvitations(userId: string, petId: string): Promise<InvitationDocument[]> {
    await requirePermission(userId, petId, 'members:view');
    const petObjectId = toObjectId(petId, 'petId');
    const now = new Date();
    return InvitationModel.find({
      petId: petObjectId,
      acceptedAt: null,
      expiresAt: { $gt: now },
    })
      .sort({ createdAt: -1 })
      .exec();
  },

  /**
   * Revoke an invitation.
   */
  async revokeInvitation(userId: string, petId: string, invitationId: string): Promise<void> {
    await requirePermission(userId, petId, 'members:manage');
    const petObjectId = toObjectId(petId, 'petId');
    const invObjectId = toObjectId(invitationId, 'invitationId');

    const result = await InvitationModel.deleteOne({
      _id: invObjectId,
      petId: petObjectId,
    }).exec();

    if (result.deletedCount === 0) {
      throw new AppError(
        'Invitation not found',
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.INVITATION_NOT_FOUND,
      );
    }
  },

  /**
   * Get an invitation by token. Used to preview an invitation before
   * accepting. No auth required — the token IS the auth.
   *
   * Returns the invitation and the pet (limited info for display).
   */
  async getInvitationByToken(token: string): Promise<{
    invitation: InvitationDocument;
    pet: { id: string; name: string } | null;
    inviter: { name: string } | null;
  }> {
    if (typeof token !== 'string' || token.length < 16 || token.length > 64) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.INVITATION_NOT_FOUND);
    }

    const invitation = await InvitationModel.findOne({ token }).exec();
    if (!invitation) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.INVITATION_NOT_FOUND);
    }

    const pet = await PetModel.findById(invitation.petId).select('name').exec();
    const inviter = await UserModel.findById(invitation.invitedBy).select('name').exec();

    return {
      invitation,
      pet: pet ? { id: pet._id.toString(), name: pet.name } : null,
      inviter: inviter ? { name: inviter.name } : null,
    };
  },

  /**
   * Accept an invitation.
   *
   * Flow:
   * 1. Look up the invitation by token.
   * 2. Validate: not expired, not accepted, pet exists.
   * 3. Check if the user is already a member — if so, mark accepted but don't duplicate.
   * 4. Create the FamilyMember.
   * 5. Mark the invitation accepted.
   *
   * The user accepting is identified by their authenticated userId, NOT
   * by the invitation's email. This is deliberate: emails may not match
   * (invitee uses a different email), and requiring a match would create
   * friction with no security gain — the token is the credential.
   */
  async acceptInvitation(
    userId: string,
    token: string,
  ): Promise<{ petId: string; petName: string; role: PetRole; alreadyMember: boolean }> {
    const invitation = await InvitationModel.findOne({ token }).exec();
    if (!invitation) {
      throw new AppError('Invitation not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.INVITATION_NOT_FOUND);
    }

    const now = new Date();
    const pet = await PetModel.findById(invitation.petId).exec();
    if (!pet) {
      throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
    }

    const userObjectId = toObjectId(userId, 'userId');
    const petObjectId = pet._id;

    // Check for existing membership.
    const existing = await FamilyMemberModel.findOne({
      petId: petObjectId,
      userId: userObjectId,
    }).exec();

    if (invitation.acceptedAt !== null) {
      if (
        invitation.acceptedBy?.toString() === userObjectId.toString() &&
        existing
      ) {
        return {
          petId: petObjectId.toString(),
          petName: pet.name,
          role: existing.role as PetRole,
          alreadyMember: true,
        };
      }
      throw new AppError(
        'This invitation has already been used',
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.INVITATION_ALREADY_USED,
      );
    }

    if (invitation.expiresAt < now) {
      throw new AppError(
        'This invitation has expired',
        HTTP_STATUS.GONE,
        ERROR_CODES.INVITATION_EXPIRED,
      );
    }

    if (existing) {
      // Mark the invitation accepted (so it can't be used again).
      // Don't create a duplicate member.
      invitation.acceptedAt = now;
      invitation.acceptedBy = userObjectId;
      await invitation.save();

      return {
        petId: petObjectId.toString(),
        petName: pet.name,
        role: existing.role as PetRole,
        alreadyMember: true,
      };
    }

    // Create the member.
    await FamilyMemberModel.create({
      petId: petObjectId,
      userId: userObjectId,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      joinedAt: now,
    });

    invitation.acceptedAt = now;
    invitation.acceptedBy = userObjectId;
    await invitation.save();

    return {
      petId: petObjectId.toString(),
      petName: pet.name,
      role: invitation.role as PetRole,
      alreadyMember: false,
    };
  },

  /**
   * Remove a member.
   * Rules:
   * - The owner cannot be removed by anyone (including other owners — but
   *   there's only one owner, so this is a self-check).
   * - Anyone with `members:manage` can remove members.
   * - A member can remove themselves (leaving the pet).
   */
  async removeMember(
    userId: string,
    petId: string,
    memberUserId: string,
  ): Promise<void> {
    const petObjectId = toObjectId(petId, 'petId');
    const memberUserObjectId = toObjectId(memberUserId, 'userId');

    const isSelf = userId === memberUserId;
    const access = isSelf
      ? await getAccess(userId, petId)
      : await requirePermission(userId, petId, 'members:manage');

    const memberToRemove = await FamilyMemberModel.findOne({
      petId: petObjectId,
      userId: memberUserObjectId,
    }).exec();

    if (!memberToRemove) {
      throw new AppError('Member not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.MEMBER_NOT_FOUND);
    }

    if (memberToRemove.role === 'owner') {
      throw new AppError(
        'The owner cannot be removed. Transfer ownership first.',
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.CANNOT_REMOVE_OWNER,
      );
    }

    await FamilyMemberModel.deleteOne({ _id: memberToRemove._id }).exec();

    // Silence unused var warning.
    void access;
  },

  /**
   * Change a member's role.
   *
   * The owner's role cannot be changed (there's only one owner; changing
   * would require a transfer flow).
   * A member's role CAN be changed to/from admin, caregiver, viewer.
   */
  async changeRole(
    userId: string,
    petId: string,
    memberUserId: string,
    newRole: PetRole,
  ): Promise<FamilyMemberDocument> {
    await requirePermission(userId, petId, 'members:manage');

    if (newRole === 'owner') {
      throw new AppError(
        'Use the transfer-ownership flow to assign the owner role',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    if (!PET_ROLES.includes(newRole)) {
      throw new AppError('Invalid role', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }

    const petObjectId = toObjectId(petId, 'petId');
    const memberUserObjectId = toObjectId(memberUserId, 'userId');

    const member = await FamilyMemberModel.findOne({
      petId: petObjectId,
      userId: memberUserObjectId,
    }).exec();

    if (!member) {
      throw new AppError('Member not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.MEMBER_NOT_FOUND);
    }

    if (member.role === 'owner') {
      throw new AppError(
        'The owner\'s role cannot be changed. Transfer ownership first.',
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.CANNOT_CHANGE_OWNER_ROLE,
      );
    }

    member.role = newRole;
    return member.save();
  },
};

/**
 * Helper used by the pet create flow to seed the initial ownership record.
 * Not exposed to the API; internal to the pet lifecycle.
 */
export async function createOwnerMembership(
  petId: Types.ObjectId,
  ownerId: Types.ObjectId,
): Promise<void> {
  await FamilyMemberModel.create({
    petId,
    userId: ownerId,
    role: 'owner',
    invitedBy: null,
    joinedAt: new Date(),
  });
}