import { Schema, model } from 'mongoose';
/**
 * User schema.
 *
 * Design notes:
 * - `passwordHash` uses `select: false` so it's never returned by default.
 *   Code that needs it (login) must explicitly `.select('+passwordHash')`.
 *   This makes accidental password leakage in an API response essentially
 *   impossible — you'd have to opt in every single time.
 * - Email is lowercased and trimmed at the schema level so uniqueness is
 *   case-insensitive without a separate collation config.
 * - Indexes: email is `unique` (login lookup + uniqueness). createdAt for
 *   admin sorting later.
 * - `timestamps: true` gives `createdAt` and `updatedAt` for free.
 * - `versionKey: false` removes `__v`. We don't use Mongoose's versioning
 *   for optimistic concurrency; if we ever do, re-enable it.
 * - We do NOT store `password` (plaintext), ever. Only the hash.
 */
const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 254, // practical email length ceiling
    },
    passwordHash: {
        type: String,
        required: true,
        select: false,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    // Used to invalidate refresh tokens if a password changes (Phase 21+).
    // For now it's just the creation timestamp placeholder we can increment.
    passwordChangedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform(_doc, ret) {
            // Defense in depth: even if select:false is overridden somewhere,
            // strip passwordHash from any JSON output.
            const serialized = ret;
            delete serialized.passwordHash;
            return ret;
        },
    },
});
// Compound index used by future queries (e.g. "list newest users").
userSchema.index({ createdAt: -1 });
export const UserModel = model('User', userSchema);
//# sourceMappingURL=User.js.map