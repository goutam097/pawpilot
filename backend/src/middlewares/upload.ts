import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../validators/documentValidators.js';

/**
 * Multer instance for document uploads.
 *
 * Config:
 * - memoryStorage: file is a Buffer, we forward directly to Cloudinary.
 * - limits.fileSize: 10MB. Multer enforces this by truncating the stream
 *   and emitting a LIMIT_FILE_SIZE error.
 * - limits.files: 1. One file per request.
 * - fileFilter: MIME type allowlist. Rejects anything not in ALLOWED_MIME_TYPES.
 *
 * The fileFilter gets the client-declared MIME. For defense-in-depth, we
 * ALSO validate the MIME on the server after upload... actually, Cloudinary
 * does this — it detects the real type. If Cloudinary says 'raw' for a file
 * that claimed 'image/jpeg', we still store it. The important thing is we
 * don't accept anything Cloudinary rejects.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `File type not allowed. Accepted: images (JPEG, PNG, HEIC, WebP) and PDFs.`,
          HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
          ERROR_CODES.VALIDATION_ERROR,
        ),
      );
    }
  },
});

/**
 * Wrap multer's callback-based middleware in Express-compatible error handling.
 *
 * Multer throws MulterError for limits violations. We catch and convert to
 * AppError so the centralized error handler produces our standard envelope.
 */
export const uploadSingleFile = (fieldName: string) => {
  const middleware = upload.single(fieldName);

  return (req: Request, res: Response, next: NextFunction): void => {
    middleware(req, res, (err: unknown) => {
      if (!err) return next();

      if (err instanceof AppError) {
        return next(err);
      }

      // Multer-specific errors.
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              `File is too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
              HTTP_STATUS.PAYLOAD_TOO_LARGE,
              ERROR_CODES.VALIDATION_ERROR,
            ),
          );
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(
            new AppError(
              'Only one file per upload is allowed.',
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR,
            ),
          );
        }
        return next(
          new AppError(
            `Upload error: ${err.message}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR,
          ),
        );
      }

      next(err);
    });
  };
};