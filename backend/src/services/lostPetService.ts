import { Types } from 'mongoose';
import {
  lostPetRepository,
  type CreateLostReportData,
} from '../repositories/lostPetRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import type {
  LostPetReportDocument,
  ContactMethod,
} from '../models/LostPetReport.js';
import type {
  CreateLostPetReportInput,
  UpdateLostPetReportInput,
} from '../validators/lostPetValidators.js';
import { serializePet } from './petService.js';
import type { PetDocument } from '../models/Pet.js';
import type { PetRole } from '../models/FamilyMember.js';
import { require as requirePermission } from './petPermissionsService.js';

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function reportNotFound(): AppError {
  return new AppError(
    'Lost pet report not found',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.LOST_REPORT_NOT_FOUND,
  );
}

function publicReportNotFound(): AppError {
  return new AppError(
    'This lost pet report is not available',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.PUBLIC_REPORT_NOT_FOUND,
  );
}

/**
 * Serialize a report for the OWNER (in-app).
 *
 * Includes the share token so the owner can share it, plus internal fields.
 * This is NEVER returned by the public endpoint.
 */
export function serializeLostReportForOwner(
  report: LostPetReportDocument,
  pet: PetDocument | null,
  role: PetRole,
) {
  const now = new Date();
  const isActive = report.foundAt === null && report.expiresAt > now;

  return {
    id: report._id.toString(),
    petId: report.petId.toString(),
    pet: pet ? serializePet(pet, role) : null,
    shareToken: report.shareToken,
    shareUrl: `${process.env.PUBLIC_APP_URL ?? 'https://pawpilot.app'}/lost/${report.shareToken}`,
    lastSeenAt: report.lastSeenAt.toISOString(),
    lastSeenLocation: report.lastSeenLocation,
    description: report.description ?? null,
    rewardOffered: report.rewardOffered ?? null,
    contactMethod: report.contactMethod,
    foundAt: report.foundAt ? report.foundAt.toISOString() : null,
    expiresAt: report.expiresAt.toISOString(),
    isActive,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

/**
 * Serialize a report for the PUBLIC.
 *
 * Strict allowlist. NEVER add a field here without a privacy review.
 * The rule: any field a stranger can use to find the pet belongs here;
 * anything that could be used to find the OWNER or abuse the pet's identity
 * does not.
 */
export function serializeLostReportForPublic(
  report: LostPetReportDocument,
  pet: PetDocument | null,
): {
  found: boolean;
  expired: boolean;
  petName: string;
  species: string;
  breed: string | null;
  color: string | null;
  gender: string;
  photoUrl: string | null;
  description: string | null;
  lastSeenAt: string;
  lastSeenLocation: string;
  rewardOffered: string | null;
  contactMethod: ContactMethod;
  contactPhone: string | null;
  contactEmail: string | null;
  reportedAt: string;
} | null {
  // If the pet record is gone (deleted), the report can't render.
  // Return null so the endpoint 404s.
  if (!pet) return null;

  const now = new Date();
  const expired = report.expiresAt <= now;
  const found = report.foundAt !== null;

  // If found or expired, we still return a minimal state (so the page can
  // say "found!" or "expired") but strip the pet's details.
  if (found || expired) {
    return {
      found,
      expired,
      petName: pet.name,
      species: pet.species,
      breed: null,
      color: null,
      gender: 'unknown',
      photoUrl: null,
      description: null,
      lastSeenAt: report.lastSeenAt.toISOString(),
      lastSeenLocation: '',
      rewardOffered: null,
      contactMethod: 'none',
      contactPhone: null,
      contactEmail: null,
      reportedAt: report.createdAt.toISOString(),
    };
  }

  // Active report: expose the findability fields.
  return {
    found: false,
    expired: false,
    petName: pet.name,
    species: pet.species,
    breed: pet.breed ?? null,
    color: pet.color ?? null,
    gender: pet.gender ?? 'unknown',
    photoUrl: pet.photoUrl ?? null,
    description: report.description ?? null,
    lastSeenAt: report.lastSeenAt.toISOString(),
    lastSeenLocation: report.lastSeenLocation,
    rewardOffered: report.rewardOffered ?? null,
    contactMethod: report.contactMethod,
    // Contact fields exposed ONLY when the owner opted in. For MVP, always
    // null because contactMethod is always 'none'.
    contactPhone: report.contactMethod === 'phone' ? report.contactPhone : null,
    contactEmail: report.contactMethod === 'email' ? report.contactEmail : null,
    reportedAt: report.createdAt.toISOString(),
  };
  // Note: We deliberately OMIT:
  // - petId, ownerId, reportId (internal ids)
  // - shareToken (the client already has it — it's the URL)
  // - pet.dateOfBirth, microchipNumber, notes (medical/identity)
  // - pet.weight, weightUnit (unnecessary)
  // - Any contact info unless explicitly opted in
}

async function requirePetAccess(
  userId: string,
  petId: string,
  permission: 'records:read' | 'records:write' | 'records:delete',
) {
  return requirePermission(userId, petId, permission);
}

export const lostPetService = {
  /**
   * Create a lost report.
   *
   * Policy: at most one active report per pet. If one exists, we update it
   * rather than creating a duplicate. This prevents fragmented audiences.
   */
  async createOrUpdate(
    userId: string,
    petId: string,
    input: CreateLostPetReportInput,
  ): Promise<{ report: LostPetReportDocument; created: boolean; pet: PetDocument; role: PetRole }> {
    const access = await requirePetAccess(userId, petId, 'records:write');
    const { pet, role } = access;
    const ownerId = toObjectId(userId, 'userId');
    const petObjectId = pet._id;

    const existing = await lostPetRepository.findActiveForPet(petObjectId);

    if (existing) {
      // Update the existing active report in place (keep the same token).
      const update: Partial<CreateLostReportData> = {
        lastSeenAt: input.lastSeenAt,
        lastSeenLocation: input.lastSeenLocation,
        description: input.description ?? null,
        rewardOffered: input.rewardOffered ?? null,
      };
      const updated = await lostPetRepository.updateById(existing._id, petObjectId, update);
      return { report: updated ?? existing, created: false, pet, role };
    }

    const data: CreateLostReportData = {
      ownerId,
      petId: petObjectId,
      lastSeenAt: input.lastSeenAt,
      lastSeenLocation: input.lastSeenLocation,
      description: input.description ?? null,
      contactMethod: (input.contactMethod as ContactMethod) ?? 'none',
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      rewardOffered: input.rewardOffered ?? null,
    };

    const report = await lostPetRepository.create(data);
    return { report, created: true, pet, role };
  },

  async getActive(
    userId: string,
    petId: string,
  ): Promise<{ report: LostPetReportDocument | null; pet: PetDocument; role: PetRole }> {
    const access = await requirePetAccess(userId, petId, 'records:read');
    const report = await lostPetRepository.findActiveForPet(access.pet._id);
    return { report, pet: access.pet, role: access.role };
  },

  async getById(
    userId: string,
    reportId: string,
  ): Promise<{ report: LostPetReportDocument; pet: PetDocument | null; role: PetRole }> {
    const report = await lostPetRepository.findById(reportId);
    if (!report) throw reportNotFound();
    const access = await requirePetAccess(userId, report.petId.toString(), 'records:read');
    return { report, pet: access.pet, role: access.role };
  },

  async update(
    userId: string,
    reportId: string,
    input: UpdateLostPetReportInput,
  ): Promise<{ report: LostPetReportDocument; pet: PetDocument | null; role: PetRole }> {
    const reportObjectId = toObjectId(reportId, 'reportId');

    const existing = await lostPetRepository.findById(reportObjectId);
    if (!existing) throw reportNotFound();
    const access = await requirePetAccess(userId, existing.petId.toString(), 'records:write');

    const update: Partial<CreateLostReportData> = {};
    if (input.lastSeenAt !== undefined) update.lastSeenAt = input.lastSeenAt;
    if (input.lastSeenLocation !== undefined) update.lastSeenLocation = input.lastSeenLocation;
    if (input.description !== undefined) update.description = input.description ?? null;
    if (input.rewardOffered !== undefined) update.rewardOffered = input.rewardOffered ?? null;

    const updated = await lostPetRepository.updateById(reportObjectId, access.pet._id, update);
    if (!updated) throw reportNotFound();

    return { report: updated, pet: access.pet, role: access.role };
  },

  async markFound(
    userId: string,
    reportId: string,
  ): Promise<{ report: LostPetReportDocument; pet: PetDocument | null; role: PetRole }> {
    const reportObjectId = toObjectId(reportId, 'reportId');

    const existing = await lostPetRepository.findById(reportObjectId);
    if (!existing) throw reportNotFound();
    const access = await requirePetAccess(userId, existing.petId.toString(), 'records:write');

    if (existing.foundAt) {
      throw new AppError(
        'This report is already marked as found',
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.LOST_REPORT_NOT_ACTIVE,
      );
    }

    const updated = await lostPetRepository.markFound(reportObjectId, access.pet._id);
    if (!updated) throw reportNotFound();
    return { report: updated, pet: access.pet, role: access.role };
  },

  async regenerateToken(
    userId: string,
    reportId: string,
  ): Promise<{ report: LostPetReportDocument; pet: PetDocument | null; role: PetRole }> {
    const reportObjectId = toObjectId(reportId, 'reportId');

    const existing = await lostPetRepository.findById(reportObjectId);
    if (!existing) throw reportNotFound();
    const access = await requirePetAccess(userId, existing.petId.toString(), 'records:write');

    const updated = await lostPetRepository.regenerateToken(reportObjectId, access.pet._id);
    if (!updated) throw reportNotFound();
    return { report: updated, pet: access.pet, role: access.role };
  },

  async remove(userId: string, reportId: string): Promise<void> {
    const reportObjectId = toObjectId(reportId, 'reportId');
    const existing = await lostPetRepository.findById(reportObjectId);
    if (!existing) throw reportNotFound();
    const access = await requirePetAccess(userId, existing.petId.toString(), 'records:delete');
    await lostPetRepository.softDeleteById(reportObjectId, access.pet._id);
  },

  /**
   * Public lookup — no auth.
   *
   * The report is returned regardless of active/found/expired state so the
   * public page can show an appropriate message. Only the fields in
   * `serializeLostReportForPublic` are exposed.
   */
  async getPublicByToken(token: string): Promise<{
    report: LostPetReportDocument;
    pet: PetDocument | null;
  }> {
    const report = await lostPetRepository.findByToken(token);
    if (!report) throw publicReportNotFound();

    // Fetch the pet WITHOUT an owner filter — we don't know the owner id.
    // We only expose the pet's name/species/photo via the strict allowlist
    // in serializeLostReportForPublic.
    const { PetModel } = await import('../models/Pet.js');
    const pet = await PetModel.findById(report.petId).exec();

    return { report, pet };
  },
};