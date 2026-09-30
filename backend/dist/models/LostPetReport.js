import crypto from 'node:crypto';
import { Schema, model, } from 'mongoose';
/**
 * Contact methods.
 *
 * For MVP, all reports use 'none' — the public page has no direct contact
 * mechanism. This field exists so we can add 'phone' / 'email' / 'in_app'
 * later without a migration.
 */
export const CONTACT_METHODS = ['none', 'phone', 'email', 'in_app'];
/**
 * Generate a URL-safe random token.
 *
 * 24 bytes = 192 bits of entropy. Base64url encoding gives 32 characters,
 * no padding, no special characters that need escaping in URLs.
 *
 * This is the ONLY thing standing between a stranger and the report's data,
 * so treat it as a bearer credential.
 */
function generateShareToken() {
    return crypto.randomBytes(24).toString('base64url');
}
/**
 * A lost pet report.
 *
 * Lifecycle:
 * - Created via POST /lost-pets (from the app).
 * - Becomes inactive when marked found, expires, or is deleted.
 * - Public page reads by shareToken (never by _id).
 */
const lostPetReportSchema = new Schema({
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    petId: {
        type: Schema.Types.ObjectId,
        ref: 'Pet',
        required: true,
        index: true,
    },
    /**
     * The public identifier. Never expose the _id publicly.
     * Unique + indexed because it's the primary lookup for the public page.
     */
    shareToken: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: generateShareToken,
    },
    /**
     * When the pet was last seen. Not necessarily the report creation time.
     */
    lastSeenAt: {
        type: Date,
        required: true,
    },
    /**
     * Free-text location. We display this on the public page.
     *
     * IMPORTANT: users are warned in the UI NOT to enter their home address.
     * We can't enforce this technically. The community norms of lost-pet
     * posting also discourage it.
     */
    lastSeenLocation: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
    },
    /**
     * Optional description of the pet's behavior/condition, or what a
     * finder should do. e.g. "Very shy, do not chase. Call me and I'll come."
     */
    description: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null,
    },
    /**
     * Public contact mechanism. See CONTACT_METHODS.
     * Currently always 'none' for MVP.
     */
    contactMethod: {
        type: String,
        enum: CONTACT_METHODS,
        default: 'none',
    },
    contactPhone: {
        type: String,
        trim: true,
        maxlength: 40,
        default: null,
    },
    contactEmail: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
    },
    rewardOffered: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null,
    },
    /**
     * When the pet was found. Null = still missing.
     */
    foundAt: {
        type: Date,
        default: null,
    },
    /**
     * Auto-expire the report after this date. Default 60 days after creation.
     *
     * Why expire? Because "lost pet" pages that are 6 months old are noise.
     * The community moves on. Better to have a clean "still missing" state
     * by renewal than a stale "missing since January" that nobody believes.
     */
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
    deletedAt: {
        type: Date,
        default: null,
        select: false,
    },
}, {
    timestamps: true,
    versionKey: false,
    toJSON: {
        transform(_doc, ret) {
            delete ret.deletedAt;
            // The share token is returned in API responses to the OWNER (so they
            // can share it). It's fine to include.
            return ret;
        },
    },
});
/**
 * Find the active report for a pet.
 * "Active" = not found, not expired, not deleted.
 */
lostPetReportSchema.index({ petId: 1, foundAt: 1, expiresAt: -1 });
/**
 * The public lookup by token. Unique index handles both lookup and collision
 * prevention (astronomically rare, but the constraint is free).
 */
// Already declared on the field itself (unique: true, index: true).
lostPetReportSchema.pre(/^find/, function () {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deletedAt: null });
    }
    //   next();
});
export const LostPetReportModel = model('LostPetReport', lostPetReportSchema);
//# sourceMappingURL=LostPetReport.js.map