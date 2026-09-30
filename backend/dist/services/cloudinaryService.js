import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Cloudinary service — the ONLY place we touch the Cloudinary SDK.
 *
 * Why a wrapper?
 * - Swapping to S3 or another provider later is a change to this file only.
 * - The Cloudinary SDK's error handling is inconsistent; we normalize.
 * - We enforce our own size and type limits here, not in the route.
 *
 * API shape:
 * - `uploadFile(buffer, options)` → returns a normalized asset result.
 * - `deleteFile(publicId)` → removes an asset.
 *
 * The `folder` option groups assets in the Cloudinary dashboard. We always
 * prefix with env.cloudinaryFolder so PawPilot assets are separated from
 * anything else in the same Cloudinary account.
 */
cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
});
/**
 * Upload a buffer to Cloudinary.
 *
 * Buffers, not file paths, because we use multer's memory storage.
 *
 * The `upload_stream` API takes a callback and a buffer via a writable
 * stream. We wrap it in a Promise for async/await ergonomics.
 */
export async function uploadFile(buffer, options) {
    const folder = `${env.cloudinaryFolder}/${options.subfolder}`;
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            folder,
            resource_type: options.resourceType ?? 'auto',
            // Overwrite is off; Cloudinary generates unique public IDs.
            overwrite: false,
            // Invalidate CDN caches when a file with the same public ID is re-uploaded.
            // Not relevant with unique IDs, but harmless and safer if we ever enable overwrite.
            invalidate: true,
        }, (error, result) => {
            if (error || !result) {
                reject(new AppError(`Upload failed: ${error?.message ?? 'unknown error'}`, HTTP_STATUS.BAD_GATEWAY, ERROR_CODES.INTERNAL_ERROR));
                return;
            }
            resolve(normalizeUploadResult(result));
        });
        stream.end(buffer);
    });
}
/**
 * Delete a file from Cloudinary by public ID.
 *
 * Best-effort: if the file doesn't exist, we don't error. Deletion of a
 * Mongo document should not fail because Cloudinary is already cleaned up.
 */
export async function deleteFile(publicId, resourceType = 'image') {
    try {
        await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
            invalidate: true,
        });
    }
    catch (err) {
        // Log but don't throw. The Mongo document is the source of truth;
        // Cloudinary cleanup failure is logged for investigation.
        console.warn(JSON.stringify({
            level: 'warn',
            type: 'cloudinary',
            msg: 'delete failed',
            publicId,
            error: err instanceof Error ? err.message : String(err),
        }));
    }
}
function normalizeUploadResult(result) {
    // Cloudinary's `resource_type` type is broader than ours; narrow it.
    const rt = result.resource_type;
    const resourceType = rt === 'image' || rt === 'video' || rt === 'raw' ? rt : 'raw';
    return {
        url: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
        format: result.format,
        resourceType,
    };
}
//# sourceMappingURL=cloudinaryService.js.map