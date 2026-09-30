import { Types } from 'mongoose';
import { lostPetRepository, } from '../repositories/lostPetRepository.js';
import { petRepository } from '../repositories/petRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { serializePet } from './petService.js';
function toObjectId(id, fieldName = 'id') {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return new Types.ObjectId(id);
}
function reportNotFound() {
    return new AppError('Lost pet report not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.LOST_REPORT_NOT_FOUND);
}
function publicReportNotFound() {
    return new AppError('This lost pet report is not available', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PUBLIC_REPORT_NOT_FOUND);
}
/**
 * Serialize a report for the OWNER (in-app).
 *
 * Includes the share token so the owner can share it, plus internal fields.
 * This is NEVER returned by the public endpoint.
 */
export function serializeLostReportForOwner(report, pet) {
    const now = new Date();
    const isActive = report.foundAt === null && report.expiresAt > now;
    return {
        id: report._id.toString(),
        petId: report.petId.toString(),
        pet: pet ? serializePet(pet, 'owner') : null,
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
export function serializeLostReportForPublic(report, pet) {
    // If the pet record is gone (deleted), the report can't render.
    // Return null so the endpoint 404s.
    if (!pet)
        return null;
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
async function verifyPetOwnership(userId, petId) {
    const ownerId = toObjectId(userId, 'userId');
    const petObjectId = toObjectId(petId, 'petId');
    const pet = await petRepository.findByIdForOwner(petObjectId, ownerId);
    if (!pet) {
        throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
    }
    return pet;
}
export const lostPetService = {
    /**
     * Create a lost report.
     *
     * Policy: at most one active report per pet. If one exists, we update it
     * rather than creating a duplicate. This prevents fragmented audiences.
     */
    async createOrUpdate(userId, petId, input) {
        const pet = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const petObjectId = toObjectId(petId, 'petId');
        const existing = await lostPetRepository.findActiveForPet(ownerId, petObjectId);
        if (existing) {
            // Update the existing active report in place (keep the same token).
            const update = {
                lastSeenAt: input.lastSeenAt,
                lastSeenLocation: input.lastSeenLocation,
                description: input.description ?? null,
                rewardOffered: input.rewardOffered ?? null,
            };
            const updated = await lostPetRepository.updateForOwner(existing._id, ownerId, update);
            return { report: updated ?? existing, created: false, pet };
        }
        const data = {
            ownerId,
            petId: petObjectId,
            lastSeenAt: input.lastSeenAt,
            lastSeenLocation: input.lastSeenLocation,
            description: input.description ?? null,
            contactMethod: input.contactMethod ?? 'none',
            contactPhone: input.contactPhone ?? null,
            contactEmail: input.contactEmail ?? null,
            rewardOffered: input.rewardOffered ?? null,
        };
        const report = await lostPetRepository.create(data);
        return { report, created: true, pet };
    },
    async getActive(userId, petId) {
        const pet = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const petObjectId = toObjectId(petId, 'petId');
        const report = await lostPetRepository.findActiveForPet(ownerId, petObjectId);
        return { report, pet };
    },
    async getById(userId, reportId) {
        const ownerId = toObjectId(userId, 'userId');
        const report = await lostPetRepository.findByIdForOwner(reportId, ownerId);
        if (!report)
            throw reportNotFound();
        const pet = await petRepository.findByIdForOwner(report.petId, ownerId);
        return { report, pet };
    },
    async update(userId, reportId, input) {
        const ownerId = toObjectId(userId, 'userId');
        const reportObjectId = toObjectId(reportId, 'reportId');
        const existing = await lostPetRepository.findByIdForOwner(reportObjectId, ownerId);
        if (!existing)
            throw reportNotFound();
        const update = {};
        if (input.lastSeenAt !== undefined)
            update.lastSeenAt = input.lastSeenAt;
        if (input.lastSeenLocation !== undefined)
            update.lastSeenLocation = input.lastSeenLocation;
        if (input.description !== undefined)
            update.description = input.description ?? null;
        if (input.rewardOffered !== undefined)
            update.rewardOffered = input.rewardOffered ?? null;
        const updated = await lostPetRepository.updateForOwner(reportObjectId, ownerId, update);
        if (!updated)
            throw reportNotFound();
        const pet = await petRepository.findByIdForOwner(updated.petId, ownerId);
        return { report: updated, pet };
    },
    async markFound(userId, reportId) {
        const ownerId = toObjectId(userId, 'userId');
        const reportObjectId = toObjectId(reportId, 'reportId');
        const existing = await lostPetRepository.findByIdForOwner(reportObjectId, ownerId);
        if (!existing)
            throw reportNotFound();
        if (existing.foundAt) {
            throw new AppError('This report is already marked as found', HTTP_STATUS.CONFLICT, ERROR_CODES.LOST_REPORT_NOT_ACTIVE);
        }
        const updated = await lostPetRepository.markFound(reportObjectId, ownerId);
        if (!updated)
            throw reportNotFound();
        const pet = await petRepository.findByIdForOwner(updated.petId, ownerId);
        return { report: updated, pet };
    },
    async regenerateToken(userId, reportId) {
        const ownerId = toObjectId(userId, 'userId');
        const reportObjectId = toObjectId(reportId, 'reportId');
        const existing = await lostPetRepository.findByIdForOwner(reportObjectId, ownerId);
        if (!existing)
            throw reportNotFound();
        const updated = await lostPetRepository.regenerateToken(reportObjectId, ownerId);
        if (!updated)
            throw reportNotFound();
        const pet = await petRepository.findByIdForOwner(updated.petId, ownerId);
        return { report: updated, pet };
    },
    async remove(userId, reportId) {
        const ownerId = toObjectId(userId, 'userId');
        const reportObjectId = toObjectId(reportId, 'reportId');
        const existing = await lostPetRepository.findByIdForOwner(reportObjectId, ownerId);
        if (!existing)
            throw reportNotFound();
        await lostPetRepository.softDeleteForOwner(reportObjectId, ownerId);
    },
    /**
     * Public lookup — no auth.
     *
     * The report is returned regardless of active/found/expired state so the
     * public page can show an appropriate message. Only the fields in
     * `serializeLostReportForPublic` are exposed.
     */
    async getPublicByToken(token) {
        const report = await lostPetRepository.findByToken(token);
        if (!report)
            throw publicReportNotFound();
        // Fetch the pet WITHOUT an owner filter — we don't know the owner id.
        // We only expose the pet's name/species/photo via the strict allowlist
        // in serializeLostReportForPublic.
        const { PetModel } = await import('../models/Pet.js');
        const pet = await PetModel.findById(report.petId).exec();
        return { report, pet };
    },
};
//# sourceMappingURL=lostPetService.js.map