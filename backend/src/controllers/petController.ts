import type { Request, Response } from 'express';
import { petService, serializePet } from '../services/petService.js';
import { petDashboardService } from '../services/petDashboardService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreatePetInput,
  UpdatePetInput,
  ListPetsQuery,
} from '../validators/petValidators.js';
import { uploadFile, deleteFile } from '../services/cloudinaryService.js';
import { PetModel } from '../models/Pet.js';
import { AppError } from '../utils/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { require as requirePetPermission, getAccess } from '../services/petPermissionsService.js';

/**
 * Pet controller — HTTP layer only. Every method assumes:
 * - The user is authenticated (route applies `authenticate`).
 * - The body/query is validated (route applies `validate*`).
 */

function extractCloudinaryPublicId(url: string | null): string | null {
  if (!url) return null;
  const match = /res\.cloudinary\.com\/[^/]+\/(?:image|raw)\/upload\/v\d+\/(.+)\.\w+$/.exec(url);
  return match ? match[1]! : null;
}

export const petController = {
  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const input = req.body as CreatePetInput;
    const pet = await petService.create(userId, input);
    ok(res, { pet: serializePet(pet, 'owner') }, HTTP_STATUS.CREATED);
  },

  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const query = req.query as unknown as ListPetsQuery;
    const pets = await petService.list(userId, query);
    ok(res, { pets: pets.map(({ pet, role }) => serializePet(pet, role)) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const { pet, role } = await petService.getOne(userId, petId);
    ok(res, { pet: serializePet(pet, role) });
  },

  async getDashboard(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const dashboard = await petDashboardService.getDashboard(userId, petId);

    // Cache hint: dashboards are safe to cache on the client for a short
    // period. We set an HTTP header that mobile can use (though TanStack
    // Query's staleTime is what actually drives client cache). The header
    // is a nice signal and future-proofs us for CDN or intermediary caching.
    res.set('Cache-Control', 'private, max-age=30');
    ok(res, dashboard);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as UpdatePetInput;
    const pet = await petService.update(userId, petId, input);
    const access = await getAccess(userId, petId);
    ok(res, { pet: serializePet(pet, access.role) });
  },

  async archive(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const pet = await petService.archive(userId, petId);
    const access = await getAccess(userId, petId);
    ok(res, { pet: serializePet(pet, access.role) });
  },

  async unarchive(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const pet = await petService.unarchive(userId, petId);
    const access = await getAccess(userId, petId);
    ok(res, { pet: serializePet(pet, access.role) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    await petService.softDelete(userId, petId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  async uploadPhoto(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };

    if (!req.file) {
      throw new AppError(
        'No file provided.',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const access = await requirePetPermission(userId, petId, 'pet:update');
    const pet = access.pet;
    const petObjectId = pet._id;

    // Upload new photo.
    const uploaded = await uploadFile(req.file.buffer, {
      subfolder: 'pet-photos',
      resourceType: 'image',
    });

    if (uploaded.resourceType !== 'image') {
      await deleteFile(uploaded.publicId, 'raw');
      throw new AppError(
        'Only image files are accepted for pet photos.',
        HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    // If the pet had a previous photo, delete it from Cloudinary (best-effort).
    // Note: we can't easily tell if the old URL was a Cloudinary URL vs a data
    // URI vs a broken link. We only delete if it looks like a Cloudinary URL.
    const previousUrl = pet.photoUrl;
    const previousPublicId = extractCloudinaryPublicId(previousUrl);

    await PetModel.updateOne(
      { _id: petObjectId },
      { $set: { photoUrl: uploaded.url } },
    ).exec();

    if (previousPublicId) {
      void deleteFile(previousPublicId, 'image');
    }

    // Return the updated pet.
    const updated = await PetModel.findById(petObjectId).exec();
    if (!updated) {
      throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
    }
    ok(res, { pet: serializePet(updated, access.role) });
  },
};