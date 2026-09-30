import { Router } from 'express';
import { travelController } from '../controllers/travelController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const travelTemplateRouter = Router();

travelTemplateRouter.use(authenticate);

travelTemplateRouter.get('/', asyncHandler(travelController.listTemplates));