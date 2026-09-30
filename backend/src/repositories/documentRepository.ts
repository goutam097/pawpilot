import { Types } from 'mongoose';
import { DocumentModel, type DocumentDocument, type DocumentType, type DocumentSourceType } from '../models/Document.js';

export interface CreateDocumentData {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  documentType: DocumentType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  publicId: string;
  resourceType: 'image' | 'raw';
  sourceType: DocumentSourceType | null;
  sourceId: Types.ObjectId | null;
  notes: string | null;
}

export interface ListDocumentsOptions {
  petId: Types.ObjectId;
  documentType?: DocumentType;
  sourceType?: DocumentSourceType;
  sourceId?: Types.ObjectId;
  limit: number;
}

export const documentRepository = {
  async create(data: CreateDocumentData): Promise<DocumentDocument> {
    return DocumentModel.create(data);
  },

  async findByIdAndPet(
    documentId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<DocumentDocument | null> {
    if (!Types.ObjectId.isValid(documentId)) return null;
    return DocumentModel.findOne({ _id: documentId, petId }).exec();
  },

  async listForPet(options: ListDocumentsOptions): Promise<DocumentDocument[]> {
    const filter: Record<string, unknown> = {
      petId: options.petId,
    };
    if (options.documentType) filter.documentType = options.documentType;
    if (options.sourceType) filter.sourceType = options.sourceType;
    if (options.sourceId) filter.sourceId = options.sourceId;

    return DocumentModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .exec();
  },

  async softDeleteById(
    documentId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<void> {
    await DocumentModel.updateOne(
      { _id: documentId, petId },
      { $set: { deletedAt: new Date() } },
    ).exec();
  },

  /**
   * Find documents currently linked to a source.
   */
  async findLinkedToSource(
    petId: Types.ObjectId,
    sourceType: DocumentSourceType,
    sourceId: Types.ObjectId,
  ): Promise<DocumentDocument[]> {
    return DocumentModel.find({ petId, sourceType, sourceId }).exec();
  },

  /**
   * Bulk link documents to a source. Used when a vaccination or vet visit
   * is created/updated with `documentIds`.
   *
  * The caller authorizes access to the pet before this pet-scoped update.
   */
  async linkToSource(
    documentIds: Types.ObjectId[],
    petId: Types.ObjectId,
    sourceType: DocumentSourceType,
    sourceId: Types.ObjectId,
  ): Promise<{ requested: number; matched: number }> {
    if (documentIds.length === 0) return { requested: 0, matched: 0 };
    const result = await DocumentModel.updateMany(
      { _id: { $in: documentIds }, petId },
      { $set: { sourceType, sourceId } },
    ).exec();
    return { requested: documentIds.length, matched: result.matchedCount };
  },

  /**
   * Unlink documents (set sourceType/sourceId to null).
   */
  async unlinkDocuments(
    documentIds: Types.ObjectId[],
    petId: Types.ObjectId,
  ): Promise<void> {
    if (documentIds.length === 0) return;
    await DocumentModel.updateMany(
      { _id: { $in: documentIds }, petId },
      { $set: { sourceType: null, sourceId: null } },
    ).exec();
  },
};