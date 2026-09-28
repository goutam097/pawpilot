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

/**
 * Pet controller — HTTP layer only. Every method assumes:
 * - The user is authenticated (route applies `authenticate`).
 * - The body/query is validated (route applies `validate*`).
 */

export const petController = {
  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const input = req.body as CreatePetInput;
    const pet = await petService.create(userId, input);
    ok(res, { pet: serializePet(pet) }, HTTP_STATUS.CREATED);
  },

  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const query = req.query as unknown as ListPetsQuery;
    const pets = await petService.list(userId, query);
    ok(res, { pets: pets.map(serializePet) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const pet = await petService.getOne(userId, petId);
    ok(res, { pet: serializePet(pet) });
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
    ok(res, { pet: serializePet(pet) });
  },

  async archive(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const pet = await petService.archive(userId, petId);
    ok(res, { pet: serializePet(pet) });
  },

  async unarchive(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const pet = await petService.unarchive(userId, petId);
    ok(res, { pet: serializePet(pet) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    await petService.softDelete(userId, petId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};