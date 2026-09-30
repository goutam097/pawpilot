import { Types } from 'mongoose';
import { documentRepository, } from '../repositories/documentRepository.js';
import { petRepository } from '../repositories/petRepository.js';
import { uploadFile, deleteFile } from './cloudinaryService.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Document service.
 *
 * Handles the full upload lifecycle:
 * 1. Verify pet ownership.
 * 2. Upload the buffer to Cloudinary.
 * 3. Create the Document record in Mongo.
 * 4. If Mongo fails, delete the Cloudinary asset (compensating action).
 */
function toObjectId(id, fieldName = 'id') {
    if (!Types.ObjectId.isValid(id)) {
        throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    }
    return new Types.ObjectId(id);
}
function documentNotFound() {
    return new AppError('Document not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.VALIDATION_ERROR);
}
export function serializeDocument(d) {
    return {
        id: d._id.toString(),
        petId: d.petId.toString(),
        documentType: d.documentType,
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        url: d.url,
        sourceType: d.sourceType ?? null,
        sourceId: d.sourceId ? d.sourceId.toString() : null,
        notes: d.notes ?? null,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
    };
}
async function verifyPetOwnership(userId, petId) {
    const ownerId = toObjectId(userId, 'userId');
    const petObjectId = toObjectId(petId, 'petId');
    const pet = await petRepository.findByIdForOwner(petObjectId, ownerId);
    if (!pet) {
        throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
    }
    return petObjectId;
}
export const documentService = {
    async upload(userId, petId, file, meta) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        // 1. Upload to Cloudinary.
        const uploaded = await uploadFile(file.buffer, {
            subfolder: 'documents',
            resourceType: 'auto',
        });
        // 2. Guard against unexpected resource types (video, etc.).
        if (uploaded.resourceType === 'video') {
            // Compensating delete before we reject.
            await deleteFile(uploaded.publicId, 'raw');
            throw new AppError('Video uploads are not supported.', HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE, ERROR_CODES.VALIDATION_ERROR);
        }
        // 3. Create the Document record.
        const data = {
            ownerId,
            petId: petObjectId,
            documentType: meta.documentType,
            originalFilename: file.originalFilename,
            mimeType: file.mimeType,
            sizeBytes: uploaded.bytes, // use Cloudinary's size (authoritative)
            url: uploaded.url,
            publicId: uploaded.publicId,
            resourceType: uploaded.resourceType,
            sourceType: meta.sourceType ?? null,
            sourceId: meta.sourceId ? new Types.ObjectId(meta.sourceId) : null,
            notes: meta.notes ?? null,
        };
        try {
            return await documentRepository.create(data);
        }
        catch (err) {
            // Compensating action: if Mongo fails, clean up Cloudinary so we
            // don't accumulate orphaned assets.
            await deleteFile(uploaded.publicId, uploaded.resourceType);
            throw err;
        }
    },
    async list(userId, petId, query) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const options = {
            ownerId,
            petId: petObjectId,
            limit: query.limit ?? 100,
        };
        if (query.documentType)
            options.documentType = query.documentType;
        if (query.sourceType && query.sourceId) {
            options.sourceType = query.sourceType;
            options.sourceId = new Types.ObjectId(query.sourceId);
        }
        return documentRepository.listForPet(options);
    },
    async getOne(userId, petId, documentId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const doc = await documentRepository.findByIdForOwnerAndPet(documentId, ownerId, petObjectId);
        if (!doc)
            throw documentNotFound();
        return doc;
    },
    async remove(userId, petId, documentId) {
        const petObjectId = await verifyPetOwnership(userId, petId);
        const ownerId = toObjectId(userId, 'userId');
        const existing = await documentRepository.findByIdForOwnerAndPet(documentId, ownerId, petObjectId);
        if (!existing)
            throw documentNotFound();
        // Best-effort Cloudinary delete. If it fails, the Document is still
        // soft-deleted (the user no longer sees it). Orphaned Cloudinary assets
        // can be cleaned up by a background job later.
        await deleteFile(existing.publicId, existing.resourceType);
        await documentRepository.softDeleteForOwner(existing._id, ownerId);
    },
    /**
     * Sync the set of documents linked to a source record.
     *
     * Called by vaccination/vet-visit services after create/update.
     *
     * Diff algorithm:
     * - desired: the array of document ids the client sent.
     * - current: the documents currently linked to this source.
     * - toLink: in desired but not in current.
     * - toUnlink: in current but not in desired.
     */
    async syncSourceDocuments(userId, sourceType, sourceId, desiredIds) {
        const ownerId = toObjectId(userId, 'userId');
        const current = await documentRepository.findLinkedToSource(ownerId, sourceType, sourceId);
        const currentIdSet = new Set(current.map((d) => d._id.toString()));
        const desiredIdSet = new Set(desiredIds.map((id) => id.toString()));
        const toLink = desiredIds.filter((id) => !currentIdSet.has(id.toString()));
        const toUnlink = current.filter((d) => !desiredIdSet.has(d._id.toString())).map((d) => d._id);
        if (toLink.length > 0) {
            const result = await documentRepository.linkToSource(toLink, ownerId, sourceType, sourceId);
            if (result.matched !== result.requested) {
                console.warn(JSON.stringify({
                    level: 'warn',
                    type: 'documents',
                    msg: 'some documents were not linked (not owned or missing)',
                    requested: result.requested,
                    matched: result.matched,
                }));
            }
        }
        if (toUnlink.length > 0) {
            await documentRepository.unlinkDocuments(toUnlink, ownerId);
        }
    },
};
//# sourceMappingURL=documentService.js.map