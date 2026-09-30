import { Types } from 'mongoose';
import { deviceRepository } from '../repositories/deviceRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import type {
  RegisterDeviceInput,
  UnregisterDeviceInput,
} from '../validators/deviceValidators.js';
import type { DeviceTokenDocument } from '../models/DeviceToken.js';

function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid user id', HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }
  return new Types.ObjectId(id);
}

export function serializeDevice(device: DeviceTokenDocument) {
  return {
    id: device._id.toString(),
    platform: device.platform,
    deviceModel: device.deviceModel ?? null,
    appVersion: device.appVersion ?? null,
    createdAt: device.createdAt.toISOString(),
    lastUsedAt: device.lastUsedAt ? device.lastUsedAt.toISOString() : null,
  };
  // Note: we deliberately do NOT return the pushToken. The client already
  // has it (it registered it). Exposing tokens on read isn't useful and
  // could leak device identities in log dumps.
}

export const deviceService = {
  async register(userId: string, input: RegisterDeviceInput): Promise<DeviceTokenDocument> {
    const userObjectId = toObjectId(userId);
    return deviceRepository.upsertForUser({
      userId: userObjectId,
      pushToken: input.pushToken,
      platform: input.platform,
      deviceModel: input.deviceModel ?? null,
      appVersion: input.appVersion ?? null,
    });
  },

  async unregister(userId: string, input: UnregisterDeviceInput): Promise<void> {
    const userObjectId = toObjectId(userId);
    // Silent success if the token doesn't exist — logout must be idempotent.
    await deviceRepository.deleteForUser(userObjectId, input.pushToken);
  },
};