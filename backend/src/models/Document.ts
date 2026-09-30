import {
  Schema,
  model,
  Types,
  type InferSchemaType,
  type HydratedDocument,
  type Model,
  type Query,
} from 'mongoose';

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
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

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
] as const;

export type DocumentSourceType = (typeof DOCUMENT_SOURCE_TYPES)[number];

export interface DocumentRecord {
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
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
const documentSchema = new Schema<DocumentRecord>(
  {
    createdBy: {
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
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as { deletedAt?: Date }).deletedAt;
        return ret;
      },
    },
  },
);

/**
 * List query: "documents for a pet, newest first."
 */
documentSchema.index({ petId: 1, createdAt: -1 });

/**
 * Filter by documentType.
 */
documentSchema.index({ petId: 1, documentType: 1, createdAt: -1 });

/**
 * Lookup by source: "give me all documents linked to this vaccination."
 */
documentSchema.index(
  { sourceType: 1, sourceId: 1 },
  { partialFilterExpression: { sourceId: { $ne: null } } },
);

documentSchema.pre(/^find/, function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
//   next();
});

documentSchema.pre('countDocuments', function (this: Query<unknown, unknown>) {
  const opts = this.getOptions() as { includeDeleted?: boolean };
  if (!opts.includeDeleted) {
    this.where({ deletedAt: null });
  }
//   next();
});

export type DocumentModelType = InferSchemaType<typeof documentSchema>;
export type DocumentDocument = HydratedDocument<DocumentModelType>;
export type DocumentModel = Model<DocumentModelType>;

export const DocumentModel = model<DocumentModelType>('Document', documentSchema);