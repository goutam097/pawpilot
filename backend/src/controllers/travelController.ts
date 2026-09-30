import type { Request, Response } from 'express';
import {
  travelService,
  serializeTravelPlan,
  serializeTemplate,
} from '../services/travelService.js';
import { ok } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import type { AuthenticatedRequest } from '../middlewares/authenticate.js';
import type {
  CreateTravelPlanInput,
  UpdateTravelPlanInput,
  AddChecklistItemInput,
  UpdateChecklistItemInput,
  ListTravelPlansQuery,
} from '../validators/travelValidators.js';

export const travelController = {
  async listTemplates(_req: Request, res: Response): Promise<void> {
    const templates = await travelService.listTemplates();
    ok(res, { templates: templates.map(serializeTemplate) });
  },

  async list(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const query = req.query as unknown as ListTravelPlansQuery;
    const plans = await travelService.list(userId, petId, query);
    ok(res, { travelPlans: plans.map(serializeTravelPlan) });
  },

  async getOne(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, planId } = req.params as { petId: string; planId: string };
    const plan = await travelService.getOne(userId, petId, planId);
    ok(res, { travelPlan: serializeTravelPlan(plan) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId } = req.params as { petId: string };
    const input = req.body as CreateTravelPlanInput;
    const plan = await travelService.create(userId, petId, input);
    ok(res, { travelPlan: serializeTravelPlan(plan) }, HTTP_STATUS.CREATED);
  },

  async update(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, planId } = req.params as { petId: string; planId: string };
    const input = req.body as UpdateTravelPlanInput;
    const plan = await travelService.update(userId, petId, planId, input);
    ok(res, { travelPlan: serializeTravelPlan(plan) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, planId } = req.params as { petId: string; planId: string };
    await travelService.remove(userId, petId, planId);
    res.status(HTTP_STATUS.NO_CONTENT).send();
  },

  async addItem(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, planId } = req.params as { petId: string; planId: string };
    const input = req.body as AddChecklistItemInput;
    const plan = await travelService.addChecklistItem(userId, petId, planId, input);
    ok(res, { travelPlan: serializeTravelPlan(plan) }, HTTP_STATUS.CREATED);
  },

  async updateItem(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, planId, itemId } = req.params as {
      petId: string;
      planId: string;
      itemId: string;
    };
    const input = req.body as UpdateChecklistItemInput;
    const plan = await travelService.updateChecklistItem(userId, petId, planId, itemId, input);
    ok(res, { travelPlan: serializeTravelPlan(plan) });
  },

  async deleteItem(req: Request, res: Response): Promise<void> {
    const { userId } = req as AuthenticatedRequest;
    const { petId, planId, itemId } = req.params as {
      petId: string;
      planId: string;
      itemId: string;
    };
    const plan = await travelService.deleteChecklistItem(userId, petId, planId, itemId);
    ok(res, { travelPlan: serializeTravelPlan(plan) });
  },
};