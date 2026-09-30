import type { Request, Response } from 'express';
import { vaccinationService, serializeVaccination } from '../services/vaccinationService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateVaccinationInput,
  UpdateVaccinationInput,
  ListVaccinationsQuery,
} from '../validators/vaccinationValidators.js';

export const vaccinationController = {
  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as ListVaccinationsQuery;
    const vaccinations = await vaccinationService.list(userId, petId, query);
    ok(res, { vaccinations: vaccinations.map(serializeVaccination) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, vaccinationId } = req.params as { petId: string; vaccinationId: string };
    const vaccination = await vaccinationService.getOne(userId, petId, vaccinationId);
    ok(res, { vaccination: serializeVaccination(vaccination) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateVaccinationInput;
    const vaccination = await vaccinationService.create(userId, petId, input);
    ok(res, { vaccination: serializeVaccination(vaccination) }, HTTP_STATUS.CREATED);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, vaccinationId } = req.params as { petId: string; vaccinationId: string };
    const input = req.body as UpdateVaccinationInput;
    const vaccination = await vaccinationService.update(userId, petId, vaccinationId, input);
    ok(res, { vaccination: serializeVaccination(vaccination) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, vaccinationId } = req.params as { petId: string; vaccinationId: string };
    await vaccinationService.remove(userId, petId, vaccinationId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};