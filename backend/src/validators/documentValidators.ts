import { z } from 'zod';
import { DOCUMENT_TYPES, DOCUMENT_SOURCE_TYPES } from '../models/Document.js';

/**
 * File upload validation.
 *
 * The actual file is validated by multer (size, count) and by this schema
 * (metadata fields). Multer's `fileFilter` handles MIME allowlist.
 *
 * We also validate the file's presence explicitly: a request without a file
 * is a client bug, not a valid empty upload.
 */

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/pdf',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const documentTypeSchema = z.enum(DOCUMENT_TYPES);
const sourceTypeSchema = z.enum(DOCUMENT_SOURCE_TYPES);

/**
 * The create schema for document metadata (the file itself is multipart and
 * handled by multer, not Zod).
 *
 * `sourceType` and `sourceId` are optional; if provided, they must both be
 * provided or both absent. Enforced via .refine().
 */
export const createDocumentMetaSchema = z
  .object({
    documentType: documentTypeSchema,
    sourceType: sourceTypeSchema.optional().nullable(),
    sourceId: z.string().min(1).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict()
  .refine(
    (obj) => {
      const hasSourceType = !!obj.sourceType;
      const hasSourceId = !!obj.sourceId;
      return hasSourceType === hasSourceId;
    },
    { message: 'sourceType and sourceId must be provided together' },
  );

export const listDocumentsQuerySchema = z
  .object({
    documentType: documentTypeSchema.optional(),
    sourceType: sourceTypeSchema.optional(),
    sourceId: z.string().min(1).optional(),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((n) => n > 0 && n <= 200)
      .optional(),
  })
  .strict()
  .refine(
    (obj) => {
      // If filtering by source, both fields are required.
      const hasSourceType = !!obj.sourceType;
      const hasSourceId = !!obj.sourceId;
      return hasSourceType === hasSourceId;
    },
    { message: 'sourceType and sourceId must be provided together' },
  );

export type CreateDocumentMetaInput = z.infer<typeof createDocumentMetaSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;