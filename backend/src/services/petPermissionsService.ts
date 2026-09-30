import { Types } from 'mongoose';
import { PetModel, type PetDocument } from '../models/Pet.js';
import { FamilyMemberModel, type PetRole } from '../models/FamilyMember.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

/**
 * Permissions.
 *
 * These are coarse-grained capabilities. A service method asks
 * `require(userId, petId, 'records:write')` and gets either access info or
 * a thrown error. The permission names encode INTENT, not the specific
 * endpoint — a new endpoint that edits a reminder uses `records:write`,
 * not a bespoke permission.
 *
 * Why coarse? Because fine-grained permissions (per-resource-type) would
 * multiply the matrix without a product reason. "Caregivers can edit
 * records" is easier to reason about than "caregivers can edit reminders
 * but not weights."
 */
export type Permission =
  | 'pet:read'
  | 'pet:update'
  | 'pet:delete'
  | 'records:read'
  | 'records:write'
  | 'records:delete'
  | 'members:view'
  | 'members:invite'
  | 'members:manage';

/**
 * Role → permission matrix.
 *
 * Read this top-to-bottom as the security policy for the app.
 * Any change here is a security change.
 */
const ROLE_PERMISSIONS: Record<PetRole, readonly Permission[]> = {
  owner: [
    'pet:read',
    'pet:update',
    'pet:delete',
    'records:read',
    'records:write',
    'records:delete',
    'members:view',
    'members:invite',
    'members:manage',
  ],
  admin: [
    'pet:read',
    'pet:update',
    // no pet:delete — only the owner can destroy the pet
    'records:read',
    'records:write',
    'records:delete',
    'members:view',
    'members:invite',
    'members:manage',
  ],
  caregiver: [
    'pet:read',
    // no pet:update — a caregiver can't rename or re-photo the pet
    'records:read',
    'records:write',
    // no records:delete
    'members:view',
    // no members:invite, no members:manage
  ],
  viewer: [
    'pet:read',
    'records:read',
    'members:view',
  ],
};

export interface PetAccess {
  pet: PetDocument;
  role: PetRole;
  permissions: readonly Permission[];
}

export function roleHasPermission(role: PetRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Get the user's access to a pet.
 *
 * Throws PET_ACCESS_DENIED (404) if the user has no access. We use 404, not
 * 403, to avoid leaking the existence of pets a user doesn't have access to.
 * This matches the pattern established in Phase 7 for pets.
 */
export async function getAccess(userId: string, petId: string): Promise<PetAccess> {
  if (!Types.ObjectId.isValid(petId)) {
    throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
  }

  const userObjectId = new Types.ObjectId(userId);
  const petObjectId = new Types.ObjectId(petId);

  // Resolve membership first (cheap, indexed).
  const member = await FamilyMemberModel.findOne({
    petId: petObjectId,
    userId: userObjectId,
  }).exec();

  if (!member) {
    throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
  }

  // Now fetch the pet itself. If the pet has been soft-deleted, treat as 404.
  const pet = await PetModel.findById(petObjectId).exec();
  if (!pet) {
    throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
  }

  return {
    pet,
    role: member.role as PetRole,
    permissions: ROLE_PERMISSIONS[member.role as PetRole],
  };
}

/**
 * Require a specific permission on a pet.
 *
 * Returns the access info if allowed; throws INSUFFICIENT_PERMISSIONS (403)
 * if the user has access to the pet but not this capability.
 *
 * Note the two error codes:
 * - PET_ACCESS_DENIED (404): the user has no relationship with this pet.
 * - INSUFFICIENT_PERMISSIONS (403): the user has a relationship but not enough rights.
 *
 * The distinction matters: a caregiver trying to delete a pet deserves a
 * clear "you don't have permission" message. A stranger deserves silence.
 */
export async function require(
  userId: string,
  petId: string,
  permission: Permission,
): Promise<PetAccess> {
  const access = await getAccess(userId, petId);
  if (!roleHasPermission(access.role, permission)) {
    throw new AppError(
      'You do not have permission to perform this action',
      HTTP_STATUS.FORBIDDEN,
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    );
  }
  return access;
}

/**
 * Does the user have any access to the pet?
 * Returns the role or null. Never throws.
 *
 * Used by the pets list to build the "role" field for each pet.
 */
export async function getRole(
  userId: Types.ObjectId,
  petId: Types.ObjectId,
): Promise<PetRole | null> {
  const member = await FamilyMemberModel.findOne({
    petId,
    userId,
  }).exec();
  return (member?.role as PetRole) ?? null;
}

/**
 * Bulk-resolve roles for a list of pets. Used by the pets list endpoint.
 * Returns a map from petId (string) to role.
 */
export async function getRolesForPets(
  userId: Types.ObjectId,
  petIds: Types.ObjectId[],
): Promise<Map<string, PetRole>> {
  if (petIds.length === 0) return new Map();

  const members = await FamilyMemberModel.find({
    userId,
    petId: { $in: petIds },
  }).exec();

  const result = new Map<string, PetRole>();
  for (const m of members) {
    result.set(m.petId.toString(), m.role as PetRole);
  }
  return result;
}