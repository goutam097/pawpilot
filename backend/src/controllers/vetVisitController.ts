import type { Request, Response } from 'express';
import { vetVisitService, serializeVetVisit } from '../services/vetVisitService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateVetVisitInput,
  UpdateVetVisitInput,
  ListVetVisitsQuery,
} from '../validators/vetVisitValidators.js';

export const vetVisitController = {
  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as ListVetVisitsQuery;
    const visits = await vetVisitService.list(userId, petId, query);
    ok(res, { vetVisits: visits.map(serializeVetVisit) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, visitId } = req.params as { petId: string; visitId: string };
    const visit = await vetVisitService.getOne(userId, petId, visitId);
    ok(res, { vetVisit: serializeVetVisit(visit) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateVetVisitInput;
    const visit = await vetVisitService.create(userId, petId, input);
    ok(res, { vetVisit: serializeVetVisit(visit) }, HTTP_STATUS.CREATED);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, visitId } = req.params as { petId: string; visitId: string };
    const input = req.body as UpdateVetVisitInput;
    const visit = await vetVisitService.update(userId, petId, visitId, input);
    ok(res, { vetVisit: serializeVetVisit(visit) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, visitId } = req.params as { petId: string; visitId: string };
    await vetVisitService.remove(userId, petId, visitId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};