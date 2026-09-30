import { Router } from 'express';
import { deviceController } from '../controllers/deviceController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validateBody } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  registerDeviceSchema,
  unregisterDeviceSchema,
} from '../validators/deviceValidators.js';

export const deviceRouter = Router();

deviceRouter.use(authenticate);

deviceRouter.post(
  '/register',
  validateBody(registerDeviceSchema),
  asyncHandler(deviceController.register),
);

deviceRouter.delete(
  '/unregister',
  validateBody(unregisterDeviceSchema),
  asyncHandler(deviceController.unregister),
);