import type { Request, Response } from 'express';
import { medicationService, serializeMedication } from '../services/medicationService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateMedicationInput,
  UpdateMedicationInput,
  ListMedicationsQuery,
} from '../validators/medicationValidators.js';

export const medicationController = {
  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as ListMedicationsQuery;
    const medications = await medicationService.list(userId, petId, query);
    ok(res, { medications: medications.map(serializeMedication) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, medicationId } = req.params as { petId: string; medicationId: string };
    const medication = await medicationService.getOne(userId, petId, medicationId);
    ok(res, { medication: serializeMedication(medication) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateMedicationInput;
    const medication = await medicationService.create(userId, petId, input);
    ok(res, { medication: serializeMedication(medication) }, HTTP_STATUS.CREATED);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, medicationId } = req.params as { petId: string; medicationId: string };
    const input = req.body as UpdateMedicationInput;
    const medication = await medicationService.update(userId, petId, medicationId, input);
    ok(res, { medication: serializeMedication(medication) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, medicationId } = req.params as { petId: string; medicationId: string };
    await medicationService.remove(userId, petId, medicationId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },
};