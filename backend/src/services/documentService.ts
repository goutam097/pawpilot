import { Types } from 'mongoose';
import {
  documentRepository,
  type CreateDocumentData,
  type ListDocumentsOptions,
} from '../repositories/documentRepository.js';
import { uploadFile, deleteFile } from './cloudinaryService.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { require as requirePermission } from './petPermissionsService.js';
import type {
  DocumentDocument,
  DocumentType,
  DocumentSourceType,
} from '../models/Document.js';
import type {
  CreateDocumentMetaInput,
  ListDocumentsQuery,
} from '../validators/documentValidators.js';

/**
 * Document service.
 *
 * Handles the full upload lifecycle:
 * 1. Verify pet ownership.
 * 2. Upload the buffer to Cloudinary.
 * 3. Create the Document record in Mongo.
 * 4. If Mongo fails, delete the Cloudinary asset (compensating action).
 */

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function documentNotFound(): AppError {
  return new AppError(
    'Document not found',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.VALIDATION_ERROR, // reuse
  );
}

export function serializeDocument(d: DocumentDocument) {
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

async function verifyPetOwnership(
  userId: string,
  petId: string,
  permission: 'records:read' | 'records:write' | 'records:delete',
): Promise<Types.ObjectId> {
  const access = await requirePermission(userId, petId, permission);
  return access.pet._id;
}

export interface UploadFileInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export const documentService = {
  async upload(
    userId: string,
    petId: string,
    file: UploadFileInput,
    meta: CreateDocumentMetaInput,
  ): Promise<DocumentDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    // 1. Upload to Cloudinary.
    const uploaded = await uploadFile(file.buffer, {
      subfolder: 'documents',
      resourceType: 'auto',
    });

    // 2. Guard against unexpected resource types (video, etc.).
    if (uploaded.resourceType === 'video') {
      // Compensating delete before we reject.
      await deleteFile(uploaded.publicId, 'raw');
      throw new AppError(
        'Video uploads are not supported.',
        HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    // 3. Create the Document record.
    const data: CreateDocumentData = {
      createdBy,
      petId: petObjectId,
      documentType: meta.documentType as DocumentType,
      originalFilename: file.originalFilename,
      mimeType: file.mimeType,
      sizeBytes: uploaded.bytes, // use Cloudinary's size (authoritative)
      url: uploaded.url,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType as 'image' | 'raw',
      sourceType: (meta.sourceType as DocumentSourceType | null | undefined) ?? null,
      sourceId: meta.sourceId ? new Types.ObjectId(meta.sourceId) : null,
      notes: meta.notes ?? null,
    };

    try {
      return await documentRepository.create(data);
    } catch (err) {
      // Compensating action: if Mongo fails, clean up Cloudinary so we
      // don't accumulate orphaned assets.
      await deleteFile(uploaded.publicId, uploaded.resourceType as 'image' | 'raw');
      throw err;
    }
  },

  async list(
    userId: string,
    petId: string,
    query: ListDocumentsQuery,
  ): Promise<DocumentDocument[]> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:read');

    const options: ListDocumentsOptions = {
      petId: petObjectId,
      limit: query.limit ?? 100,
    };
    if (query.documentType) options.documentType = query.documentType as DocumentType;
    if (query.sourceType && query.sourceId) {
      options.sourceType = query.sourceType as DocumentSourceType;
      options.sourceId = new Types.ObjectId(query.sourceId);
    }

    return documentRepository.listForPet(options);
  },

  async getOne(userId: string, petId: string, documentId: string): Promise<DocumentDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:read');
    const doc = await documentRepository.findByIdAndPet(documentId, petObjectId);
    if (!doc) throw documentNotFound();
    return doc;
  },

  async remove(userId: string, petId: string, documentId: string): Promise<void> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:delete');

    const existing = await documentRepository.findByIdAndPet(documentId, petObjectId);
    if (!existing) throw documentNotFound();

    // Best-effort Cloudinary delete. If it fails, the Document is still
    // soft-deleted (the user no longer sees it). Orphaned Cloudinary assets
    // can be cleaned up by a background job later.
    try {
      await deleteFile(existing.publicId, existing.resourceType as 'image' | 'raw');
    } catch (error) {
      console.warn(JSON.stringify({ level: 'warn', type: 'documents', msg: 'cloudinary delete failed', error: error instanceof Error ? error.message : String(error) }));
    }
    await documentRepository.softDeleteById(existing._id, petObjectId);
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
  async syncSourceDocuments(
    userId: string,
    petId: string,
    sourceType: DocumentSourceType,
    sourceId: Types.ObjectId,
    desiredIds: Types.ObjectId[],
  ): Promise<void> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:write');

    const current = await documentRepository.findLinkedToSource(petObjectId, sourceType, sourceId);
    const currentIdSet = new Set(current.map((d) => d._id.toString()));
    const desiredIdSet = new Set(desiredIds.map((id) => id.toString()));

    const toLink = desiredIds.filter((id) => !currentIdSet.has(id.toString()));
    const toUnlink = current.filter((d) => !desiredIdSet.has(d._id.toString())).map((d) => d._id);

    if (toLink.length > 0) {
      const result = await documentRepository.linkToSource(toLink, petObjectId, sourceType, sourceId);
      if (result.matched !== result.requested) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            type: 'documents',
            msg: 'some documents were not linked (not owned or missing)',
            requested: result.requested,
            matched: result.matched,
          }),
        );
      }
    }

    if (toUnlink.length > 0) {
      await documentRepository.unlinkDocuments(toUnlink, petObjectId);
    }
  },
};