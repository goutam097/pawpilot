import { Router } from 'express';
import { z } from 'zod';
import { documentController } from '../controllers/documentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { uploadSingleFile } from '../middlewares/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { createDocumentMetaSchema, listDocumentsQuerySchema, } from '../validators/documentValidators.js';
const petIdParamsSchema = z.object({ petId: z.string().min(1) });
const documentParamsSchema = z.object({
    petId: z.string().min(1),
    documentId: z.string().min(1),
});
export const documentRouter = Router({ mergeParams: true });
documentRouter.use(authenticate);
/**
 * Order matters for multipart routes:
 * 1. multer parses the body (populates req.body from text fields).
 * 2. validate runs on the parsed body.
 * 3. controller executes.
 *
 * If validate ran before multer, req.body would be empty (only the file
 * would be present), and validation would fail.
 */
documentRouter.post('/', validate({ params: petIdParamsSchema }), uploadSingleFile('file'), validate({ body: createDocumentMetaSchema }), asyncHandler(documentController.upload));
documentRouter.get('/', validate({ params: petIdParamsSchema, query: listDocumentsQuerySchema }), asyncHandler(documentController.list));
documentRouter.get('/:documentId', validate({ params: documentParamsSchema }), asyncHandler(documentController.getOne));
documentRouter.delete('/:documentId', validate({ params: documentParamsSchema }), asyncHandler(documentController.remove));
//# sourceMappingURL=documentRoutes.js.map