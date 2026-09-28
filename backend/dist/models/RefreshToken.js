import { Schema, model, Types } from 'mongoose';
/**
 * RefreshToken schema.
 *
 * We store a HASH of the token, never the token itself. If the DB leaks,
 * the attacker gets hashes they cannot use.
 *
 * Lifecycle:
 * - On login: insert a new row { userId, tokenHash, expiresAt, userAgent, ip }.
 * - On refresh: verify the presented token, delete it (rotation), insert a new one.
 * - On logout: delete the matching row.
 * - On logout-all: delete all rows for the user.
 *
 * TTL index on `expiresAt` lets Mongo auto-remove expired rows. This runs
 * roughly every 60 seconds in the background; it's not precise, and we also
 * check expiry in code as a defense.
 */
const refreshTokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    // Optional metadata — useful for "your devices" UI later.
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
}, {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
});
// TTL index — Mongo auto-deletes documents once `expiresAt` is in the past.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Support "log out all devices" and per-user listing.
refreshTokenSchema.index({ userId: 1, createdAt: -1 });
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
// Re-export Types so consumers don't need to import mongoose directly.
export { Types };
//# sourceMappingURL=RefreshToken.js.map