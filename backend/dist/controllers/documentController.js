import { documentService, serializeDocument } from '../services/documentService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { AppError } from '../utils/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
export const documentController = {
    async upload(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        // Multer populates req.file (the file) and req.body (text fields).
        if (!req.file) {
            throw new AppError('No file provided. Include a file in the "file" field.', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
        }
        const meta = req.body;
        const doc = await documentService.upload(userId, petId, {
            buffer: req.file.buffer,
            originalFilename: req.file.originalname,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size,
        }, meta);
        ok(res, { document: serializeDocument(doc) }, HTTP_STATUS.CREATED);
    },
    async list(req, res) {
        const { userId } = req;
        const { petId } = req.params;
        const query = req.query;
        const documents = await documentService.list(userId, petId, query);
        ok(res, { documents: documents.map(serializeDocument) });
    },
    async getOne(req, res) {
        const { userId } = req;
        const { petId, documentId } = req.params;
        const doc = await documentService.getOne(userId, petId, documentId);
        ok(res, { document: serializeDocument(doc) });
    },
    async remove(req, res) {
        const { userId } = req;
        const { petId, documentId } = req.params;
        await documentService.remove(userId, petId, documentId);
        res.status(HTTP_STATUS.NO_CONTENT).send();
    },
};
//# sourceMappingURL=documentController.js.map