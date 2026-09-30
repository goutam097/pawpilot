import { Schema, model, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

/**
 * Roles on a pet.
 *
 * These are the ONLY roles. Adding one requires updating:
 * - `petPermissionsService` (permission matrix).
 * - The mobile role label map.
 * - The invite flow's role picker.
 */
export const PET_ROLES = ['owner', 'admin', 'caregiver', 'viewer'] as const;
export type PetRole = (typeof PET_ROLES)[number];

/**
 * A user's membership on a pet.
 *
 * One document per (pet, user). The compound unique index enforces this.
 *
 * Invariant: every pet has exactly one FamilyMember with role 'owner',
 * whose userId equals Pet.ownerId. Created when the pet is created.
 *
 * Access checks resolve via this collection. Queries against child records
 * (reminders, etc.) do not filter by user; they filter by petId, having
 * first resolved the user's access via this collection.
 */
const familyMemberSchema = new Schema(
  {
    petId: {
      type: Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      enum: PET_ROLES,
    },
    /**
     * Who invited this user. Null for the owner (created with the pet).
     */
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    joinedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

/**
 * One membership per (pet, user).
 */
familyMemberSchema.index({ petId: 1, userId: 1 }, { unique: true });

/**
 * List all members of a pet, sorted by join date.
 */
familyMemberSchema.index({ petId: 1, joinedAt: 1 });

/**
 * List all pets a user is a member of.
 */
familyMemberSchema.index({ userId: 1, joinedAt: -1 });

export type FamilyMember = InferSchemaType<typeof familyMemberSchema>;
export type FamilyMemberDocument = HydratedDocument<FamilyMember>;
export type FamilyMemberModel = Model<FamilyMember>;

export const FamilyMemberModel = model<FamilyMember>('FamilyMember', familyMemberSchema);