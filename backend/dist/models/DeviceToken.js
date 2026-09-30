import { Schema, model } from 'mongoose';
/**
 * DeviceToken — one document per (user, device).
 *
 * Why not store tokens as an array on the User document?
 * - Tokens need their own metadata (platform, last seen, app version). Arrays
 *   of subdocuments work but are harder to index and query.
 * - Deleting a token = deleting one document. With an array, it's $pull
 *   with the right conditions — more error-prone.
 * - A separate collection can be queried for "all tokens on iOS" or "tokens
 *   that haven't been seen in 90 days" without touching the User collection.
 *
 * Uniqueness: the `pushToken` itself is globally unique (Expo tokens are).
 * If a device re-registers, we upsert on `pushToken` — updating `userId`
 * if the same device logged in as a different user.
 */
const PLATFORMS = ['ios', 'android', 'web'];
const deviceTokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    /**
     * The Expo push token (format: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
     * or "ExpoPushToken[...]" in newer SDKs).
     * Unique globally: a device has one token at a time.
     */
    pushToken: {
        type: String,
        required: true,
        unique: true,
    },
    platform: {
        type: String,
        enum: PLATFORMS,
        required: true,
    },
    /**
     * Optional metadata for debugging and cleanup. Not used for logic yet.
     */
    deviceModel: { type: String, default: null },
    appVersion: { type: String, default: null },
    /**
     * When this token was last used to successfully send a notification.
     * Used to detect and clean up stale tokens (device uninstalled without
     * unregistering, or a token that Expo reports as "DeviceNotRegistered").
     */
    lastUsedAt: { type: Date, default: null },
    /**
     * Set when Expo's receipts report this token as invalid
     * (DeviceNotRegistered). We keep the record for a while to avoid
     * re-adding it on the next app launch, then hard-delete via a cleanup job.
     */
    invalidatedAt: { type: Date, default: null },
}, {
    timestamps: true,
    versionKey: false,
});
/**
 * The hot query for the notifier: "give me all valid tokens for this user."
 */
deviceTokenSchema.index({ userId: 1, invalidatedAt: 1 });
export const DeviceTokenModel = model('DeviceToken', deviceTokenSchema);
//# sourceMappingURL=DeviceToken.js.map