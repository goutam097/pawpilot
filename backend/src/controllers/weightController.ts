import type { Request, Response } from 'express';
import { weightService, serializeWeight } from '../services/weightService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateWeightInput,
  UpdateWeightInput,
  ListWeightsQuery,
} from '../validators/weightValidators.js';

export const weightController = {
  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as ListWeightsQuery;
    const { records, petUnit } = await weightService.list(userId, petId, query);
    ok(res, { weights: records.map((r) => serializeWeight(r, petUnit)) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, weightId } = req.params as { petId: string; weightId: string };
    const { record, petUnit } = await weightService.getOne(userId, petId, weightId);
    ok(res, { weight: serializeWeight(record, petUnit) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateWeightInput;
    const record = await weightService.create(userId, petId, input);
    // Serialize with the pet's unit. The service returned the record; we
    // need the pet unit. We could re-fetch, but there's a cheaper way: the
    // service already loaded the pet; we could return the unit. Let's just
    // accept the extra query for now — weight creation is rare.
    const fresh = await weightService.getOne(userId, petId, record._id.toString());
    ok(res, { weight: serializeWeight(fresh.record, fresh.petUnit) }, HTTP_STATUS.CREATED);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, weightId } = req.params as { petId: string; weightId: string };
    const input = req.body as UpdateWeightInput;
    await weightService.update(userId, petId, weightId, input);
    const fresh = await weightService.getOne(userId, petId, weightId);
    ok(res, { weight: serializeWeight(fresh.record, fresh.petUnit) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, weightId } = req.params as { petId: string; weightId: string };
    await weightService.remove(userId, petId, weightId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};