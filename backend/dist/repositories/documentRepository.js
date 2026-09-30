import { Types } from 'mongoose';
import { DocumentModel } from '../models/Document.js';
export const documentRepository = {
    async create(data) {
        return DocumentModel.create(data);
    },
    async findByIdForOwnerAndPet(documentId, ownerId, petId) {
        if (!Types.ObjectId.isValid(documentId))
            return null;
        return DocumentModel.findOne({ _id: documentId, ownerId, petId }).exec();
    },
    async listForPet(options) {
        const filter = {
            ownerId: options.ownerId,
            petId: options.petId,
        };
        if (options.documentType)
            filter.documentType = options.documentType;
        if (options.sourceType)
            filter.sourceType = options.sourceType;
        if (options.sourceId)
            filter.sourceId = options.sourceId;
        return DocumentModel.find(filter)
            .sort({ createdAt: -1 })
            .limit(options.limit)
            .exec();
    },
    async softDeleteForOwner(documentId, ownerId) {
        await DocumentModel.updateOne({ _id: documentId, ownerId }, { $set: { deletedAt: new Date() } }).exec();
    },
    /**
     * Find documents currently linked to a source.
     */
    async findLinkedToSource(ownerId, sourceType, sourceId) {
        return DocumentModel.find({ ownerId, sourceType, sourceId }).exec();
    },
    /**
     * Bulk link documents to a source. Used when a vaccination or vet visit
     * is created/updated with `documentIds`.
     *
     * We scope by `ownerId` so a user can't link someone else's document.
     */
    async linkToSource(documentIds, ownerId, sourceType, sourceId) {
        if (documentIds.length === 0)
            return { requested: 0, matched: 0 };
        const result = await DocumentModel.updateMany({ _id: { $in: documentIds }, ownerId }, { $set: { sourceType, sourceId } }).exec();
        return { requested: documentIds.length, matched: result.matchedCount };
    },
    /**
     * Unlink documents (set sourceType/sourceId to null).
     */
    async unlinkDocuments(documentIds, ownerId) {
        if (documentIds.length === 0)
            return;
        await DocumentModel.updateMany({ _id: { $in: documentIds }, ownerId }, { $set: { sourceType: null, sourceId: null } }).exec();
    },
};
//# sourceMappingURL=documentRepository.js.map