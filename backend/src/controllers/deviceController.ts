import type { Request, Response } from 'express';
import { deviceService, serializeDevice } from '../services/deviceService.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ok } from '../utils/apiResponse.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  RegisterDeviceInput,
  UnregisterDeviceInput,
} from '../validators/deviceValidators.js';

export const deviceController = {
  async register(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const input = req.body as RegisterDeviceInput;
    const device = await deviceService.register(userId, input);
    ok(res, { device: serializeDevice(device) }, HTTP_STATUS.CREATED);
  },

  async unregister(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const input = req.body as UnregisterDeviceInput;
    await deviceService.unregister(userId, input);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};