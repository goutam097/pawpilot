import type { Request, Response } from 'express';
import { documentService, serializeDocument } from '../services/documentService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { AppError } from '../utils/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateDocumentMetaInput,
  ListDocumentsQuery,
} from '../validators/documentValidators.js';

export const documentController = {
  async upload(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };

    // Multer populates req.file (the file) and req.body (text fields).
    if (!req.file) {
      throw new AppError(
        'No file provided. Include a file in the "file" field.',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const meta = req.body as CreateDocumentMetaInput;

    const doc = await documentService.upload(
      userId,
      petId,
      {
        buffer: req.file.buffer,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
      },
      meta,
    );

    ok(res, { document: serializeDocument(doc) }, HTTP_STATUS.CREATED);
  },

  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as ListDocumentsQuery;
    const documents = await documentService.list(userId, petId, query);
    ok(res, { documents: documents.map(serializeDocument) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, documentId } = req.params as { petId: string; documentId: string };
    const doc = await documentService.getOne(userId, petId, documentId);
    ok(res, { document: serializeDocument(doc) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, documentId } = req.params as { petId: string; documentId: string };
    await documentService.remove(userId, petId, documentId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};