import { Types } from 'mongoose';
import { DeviceTokenModel, type DeviceTokenDocument } from '../models/DeviceToken.js';

export interface UpsertDeviceData {
  userId: Types.ObjectId;
  pushToken: string;
  platform: 'ios' | 'android' | 'web';
  deviceModel: string | null;
  appVersion: string | null;
}

export const deviceRepository = {
  /**
   * Register or update a device token.
   *
   * Upsert semantics:
   * - If the token doesn't exist, create it.
   * - If it exists, update its `userId` (in case a different user logged in
   *   on the same device), platform, and metadata. Clear `invalidatedAt` —
   *   the token is valid again since the app is registering it.
   */
  async upsertForUser(data: UpsertDeviceData): Promise<DeviceTokenDocument> {
    return DeviceTokenModel.findOneAndUpdate(
      { pushToken: data.pushToken },
      {
        $set: {
          userId: data.userId,
          platform: data.platform,
          deviceModel: data.deviceModel,
          appVersion: data.appVersion,
          invalidatedAt: null,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).exec();
  },

  /**
   * Remove a token. Called on logout. Scoped by `userId` so a user can't
   * unregister someone else's device.
   */
  async deleteForUser(userId: Types.ObjectId, pushToken: string): Promise<void> {
    await DeviceTokenModel.deleteOne({ userId, pushToken }).exec();
  },

  /**
   * All valid tokens for a user. Used by the notifier when dispatching.
   * Filters out invalidated tokens — they've been reported as bad by Expo.
   */
  async findValidForUser(userId: Types.ObjectId): Promise<DeviceTokenDocument[]> {
    return DeviceTokenModel.find({ userId, invalidatedAt: null }).exec();
  },

  /**
   * Mark a token invalid. Called when Expo's receipt reports
   * `DeviceNotRegistered`. We keep the record but skip it in future sends.
   */
  async markInvalid(pushToken: string): Promise<void> {
    await DeviceTokenModel.updateOne(
      { pushToken },
      { $set: { invalidatedAt: new Date() } },
    ).exec();
  },

  /**
   * Update `lastUsedAt` after a successful send. Non-blocking — the notifier
   * doesn't await this (fire-and-forget for performance).
   */
  async touchLastUsed(pushToken: string): Promise<void> {
    await DeviceTokenModel.updateOne(
      { pushToken },
      { $set: { lastUsedAt: new Date() } },
    ).exec();
  },

  /**
   * How many valid devices does this user have?
   * Used for logging and a future "you have N devices" UI.
   */
  async countValidForUser(userId: Types.ObjectId): Promise<number> {
    return DeviceTokenModel.countDocuments({ userId, invalidatedAt: null }).exec();
  },
};