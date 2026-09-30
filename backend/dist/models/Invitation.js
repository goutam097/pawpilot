import crypto from 'node:crypto';
import { Schema, model } from 'mongoose';
/**
 * Invitation role options — same as member roles EXCEPT `owner`.
 * You cannot invite someone to be the owner. Ownership transfers are
 * a separate flow (not in MVP).
 */
export const INVITABLE_ROLES = ['admin', 'caregiver', 'viewer'];
/**
 * An invitation for a user to join a pet's family.
 *
 * Lifecycle:
 * - Created by an owner/admin.
 * - Token is shared via a URL (user copies the link).
 * - Invitee opens the link, logs in (if needed), accepts.
 * - On accept: `acceptedAt` set, `acceptedBy` recorded, FamilyMember created.
 * - Expires after 7 days.
 * - Can be revoked (deleted) before acceptance.
 *
 * Email is optional. If provided, it's used for display purposes (to help
 * the owner remember who they invited). We do NOT send an email in MVP.
 */
const invitationSchema = new Schema({
    petId: {
        type: Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true,
    },
    invitedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    /**
     * The role the invitee will receive on acceptance.
     * Cannot be 'owner'.
     */
    role: {
        type: String,
        required: true,
        enum: INVITABLE_ROLES,
    },
    /**
     * Optional. If set, we can show it in the invitation for context.
     * Not used for authentication — anyone with the token can accept.
     */
    invitedEmail: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 254,
        default: null,
    },
    /**
     * Public token. Same generation scheme as lost-pet share tokens.
     */
    token: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: () => crypto.randomBytes(24).toString('base64url'),
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    acceptedAt: {
        type: Date,
        default: null,
    },
    acceptedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
/**
 * Find a user's pending invitations for a pet (to prevent dupes).
 */
invitationSchema.index({ petId: 1, acceptedAt: 1, expiresAt: 1 });
export const InvitationModel = model('Invitation', invitationSchema);
//# sourceMappingURL=Invitation.js.map