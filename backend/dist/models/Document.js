import { Schema, model, } from 'mongoose';
/**
 * Document types — user-classified.
 */
export const DOCUMENT_TYPES = [
    'vaccination_record',
    'vet_invoice',
    'prescription',
    'insurance',
    'adoption_paper',
    'microchip_record',
    'lab_result',
    'other',
];
/**
 * Source types — a document can be linked to a record.
 *
 * Same values as Expense.sourceType, Reminder.sourceType. Consistency
 * matters: "everything attached to a vaccination has sourceType='vaccination'".
 */
export const DOCUMENT_SOURCE_TYPES = [
    'vaccination',
    'medication',
    'vet_visit',
];
/**
 * A stored file.
 *
 * File storage: Cloudinary. We keep:
 * - `url`: the HTTPS URL to the asset.
 * - `publicId`: the Cloudinary public ID (for deletion).
 * - `resourceType`: 'image' | 'raw' — used for the delete call.
 *
 * We never store file bytes in Mongo. Only metadata.
 */
const documentSchema = new Schema({
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    petId: {
        type: Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true,
    },
    /** User-facing label: "vaccination record", "vet invoice", etc. */
    documentType: {
        type: String,
        required: true,
        enum: DOCUMENT_TYPES,
    },
    /** The original filename as uploaded. */
    originalFilename: {
        type: String,
        required: true,
        trim: true,
        maxlength: 255,
    },
    /** MIME type from the client. May differ from Cloudinary's `format`. */
    mimeType: {
        type: String,
        required: true,
    },
    /** Size in bytes. */
    sizeBytes: {
        type: Number,
        required: true,
        min: 0,
    },
    /** Cloudinary HTTPS URL. */
    url: {
        type: String,
        required: true,
    },
    /** Cloudinary public ID for deletion. */
    publicId: {
        type: String,
        required: true,
    },
    /** Cloudinary resource type: 'image' | 'raw'. */
    resourceType: {
        type: String,
        required: true,
        enum: ['image', 'raw'],
    },
    /** Optional link to a source record (e.g. a vaccination). */
    sourceType: {
        type: String,
        enum: DOCUMENT_SOURCE_TYPES,
        default: null,
    },
    sourceId: {
        type: Schema.Types.ObjectId,
        default: null,
    },
    /** Free-form notes about this document. */
    notes: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    deletedAt: {
        type: Date,
        default: null,
        select: false,
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform(_doc, ret) {
            delete ret.deletedAt;
            return ret;
        },
    },
});
/**
 * List query: "documents for a pet, newest first."
 */
documentSchema.index({ petId: 1, createdAt: -1 });
/**
 * Filter by documentType.
 */
documentSchema.index({ ownerId: 1, petId: 1, documentType: 1, createdAt: -1 });
/**
 * Lookup by source: "give me all documents linked to this vaccination."
 */
documentSchema.index({ sourceType: 1, sourceId: 1 }, { partialFilterExpression: { sourceId: { $ne: null } } });
documentSchema.pre(/^find/, function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
documentSchema.pre('countDocuments', function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
export const DocumentModel = model('Document', documentSchema);
//# sourceMappingURL=Document.js.map