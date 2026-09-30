import { Types } from 'mongoose';
import {
  travelRepository,
  type CreateTravelPlanData,
  type UpdateTravelPlanData,
} from '../repositories/travelRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { require as requirePermission } from './petPermissionsService.js';
import type { TravelPlanDocument } from '../models/TravelPlan.js';
import type { TravelTemplateDocument, TripType } from '../models/TravelTemplate.js';
import type {
  CreateTravelPlanInput,
  UpdateTravelPlanInput,
  AddChecklistItemInput,
  UpdateChecklistItemInput,
  ListTravelPlansQuery,
} from '../validators/travelValidators.js';

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function planNotFound(): AppError {
  return new AppError(
    'Travel plan not found',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.TRAVEL_PLAN_NOT_FOUND,
  );
}

function itemNotFound(): AppError {
  return new AppError(
    'Checklist item not found',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.CHECKLIST_ITEM_NOT_FOUND,
  );
}

export function serializeChecklistItem(item: {
  _id: Types.ObjectId;
  label: string;
  description?: string | null;
  completed?: boolean;
  completedAt?: Date | null;
  order: number;
  sourceTemplateItemId?: Types.ObjectId | null;
}) {
  return {
    id: item._id.toString(),
    label: item.label,
    description: item.description ?? null,
    completed: item.completed ?? false,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    order: item.order,
    fromTemplate: item.sourceTemplateItemId !== null && item.sourceTemplateItemId !== undefined,
  };
}

export function serializeTravelPlan(plan: TravelPlanDocument) {
  const checklist = plan.checklist
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(serializeChecklistItem);

  const completedCount = checklist.filter((i) => i.completed).length;

  return {
    id: plan._id.toString(),
    petId: plan.petId.toString(),
    name: plan.name,
    tripType: plan.tripType,
    destination: plan.destination ?? null,
    departureDate: plan.departureDate.toISOString(),
    returnDate: plan.returnDate ? plan.returnDate.toISOString() : null,
    notes: plan.notes ?? null,
    checklist,
    checklistProgress: {
      completed: completedCount,
      total: checklist.length,
    },
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function serializeTemplate(t: TravelTemplateDocument) {
  return {
    id: t._id.toString(),
    tripType: t.tripType,
    name: t.name,
    description: t.description,
    itemCount: t.items.length,
    version: t.version,
  };
}

async function requirePetAccess(
  userId: string,
  petId: string,
  permission: 'records:read' | 'records:write' | 'records:delete',
): Promise<Types.ObjectId> {
  const access = await requirePermission(userId, petId, permission);
  return access.pet._id;
}

/**
 * Materialize a template's items into a plan's checklist.
 */
function templateToChecklist(
  template: TravelTemplateDocument | null,
): CreateTravelPlanData['checklist'] {
  if (!template) return [];

  return template.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      label: item.label,
      description: item.description ?? null,
      completed: false,
      completedAt: null,
      order: index,
      sourceTemplateItemId: item._id ?? null,
    }));
}

export const travelService = {
  async listTemplates(): Promise<TravelTemplateDocument[]> {
    return travelRepository.listTemplates();
  },

  async list(
    userId: string,
    petId: string,
    query: ListTravelPlansQuery,
  ): Promise<TravelPlanDocument[]> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:read');
    return travelRepository.listPlansForPet(
      petObjectId,
      query.upcomingOnly ?? false,
      new Date(),
      query.limit ?? 50,
    );
  },

  async getOne(userId: string, petId: string, planId: string): Promise<TravelPlanDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:read');
    const plan = await travelRepository.findPlanByIdAndPet(planId, petObjectId);
    if (!plan) throw planNotFound();
    return plan;
  },

  async create(
    userId: string,
    petId: string,
    input: CreateTravelPlanInput,
  ): Promise<TravelPlanDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    // Fetch the template for this trip type (may be null for 'other').
    const template = await travelRepository.findTemplateByType(input.tripType as TripType);
    const checklist = templateToChecklist(template);

    const data: CreateTravelPlanData = {
      createdBy,
      petId: petObjectId,
      name: input.name,
      tripType: input.tripType as TripType,
      destination: input.destination ?? null,
      departureDate: input.departureDate,
      returnDate: input.returnDate ?? null,
      notes: input.notes ?? null,
      checklist,
    };

    return travelRepository.createPlan(data);
  },

  async update(
    userId: string,
    petId: string,
    planId: string,
    input: UpdateTravelPlanInput,
  ): Promise<TravelPlanDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:write');

    const planObjectId = toObjectId(planId, 'planId');

    const update: UpdateTravelPlanData = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.tripType !== undefined) update.tripType = input.tripType as TripType;
    if (input.destination !== undefined) update.destination = input.destination ?? null;
    if (input.departureDate !== undefined) update.departureDate = input.departureDate;
    if (input.returnDate !== undefined) update.returnDate = input.returnDate ?? null;
    if (input.notes !== undefined) update.notes = input.notes ?? null;

    const updated = await travelRepository.updatePlan(planObjectId, petObjectId, update);
    if (!updated) throw planNotFound();
    return updated;
  },

  async remove(userId: string, petId: string, planId: string): Promise<void> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:delete');
    const planObjectId = toObjectId(planId, 'planId');

    const existing = await travelRepository.findPlanByIdAndPet(planObjectId, petObjectId);
    if (!existing) throw planNotFound();

    await travelRepository.softDeletePlan(planObjectId, petObjectId);
  },

  async addChecklistItem(
    userId: string,
    petId: string,
    planId: string,
    input: AddChecklistItemInput,
  ): Promise<TravelPlanDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:write');
    const planObjectId = toObjectId(planId, 'planId');

    const existing = await travelRepository.findPlanByIdAndPet(planObjectId, petObjectId);
    if (!existing) throw planNotFound();

    // New item goes at the end.
    const maxOrder = existing.checklist.reduce((m, item) => Math.max(m, item.order), -1);
    const nextOrder = maxOrder + 1;

    const updated = await travelRepository.addChecklistItem(planObjectId, petObjectId, {
      label: input.label,
      description: input.description ?? null,
      order: nextOrder,
    });
    if (!updated) throw planNotFound();
    return updated;
  },

  async updateChecklistItem(
    userId: string,
    petId: string,
    planId: string,
    itemId: string,
    input: UpdateChecklistItemInput,
  ): Promise<TravelPlanDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:write');
    const planObjectId = toObjectId(planId, 'planId');
    const itemObjectId = toObjectId(itemId, 'itemId');

    const updates: Record<string, unknown> = {};
    if (input.label !== undefined) updates.label = input.label;
    if (input.description !== undefined) updates.description = input.description ?? null;
    if (input.completed !== undefined) {
      updates.completed = input.completed;
      updates.completedAt = input.completed ? new Date() : null;
    }

    const existing = await travelRepository.findPlanByIdAndPet(planObjectId, petObjectId);
    if (!existing) throw planNotFound();
    if (!existing.checklist.some((item) => item._id.toString() === itemId)) throw itemNotFound();

    const updated = await travelRepository.updateChecklistItem(
      planObjectId,
      petObjectId,
      itemObjectId,
      updates,
    );
    if (!updated) throw planNotFound();

    // Verify the item still exists in the returned plan. If not, the item
    // wasn't found (update matched no array element).
    const hasItem = updated.checklist.some((i) => i._id.toString() === itemId);
    if (!hasItem) throw itemNotFound();

    return updated;
  },

  async deleteChecklistItem(
    userId: string,
    petId: string,
    planId: string,
    itemId: string,
  ): Promise<TravelPlanDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:delete');
    const planObjectId = toObjectId(planId, 'planId');
    const itemObjectId = toObjectId(itemId, 'itemId');

    const existing = await travelRepository.findPlanByIdAndPet(planObjectId, petObjectId);
    if (!existing) throw planNotFound();
    if (!existing.checklist.some((item) => item._id.toString() === itemId)) throw itemNotFound();

    const updated = await travelRepository.deleteChecklistItem(planObjectId, petObjectId, itemObjectId);
    if (!updated) throw planNotFound();
    return updated;
  },

  /**
   * Get the next upcoming trip — used by the dashboard.
   */
  async getNextUpcoming(
    userId: string,
    petId: string,
  ): Promise<TravelPlanDocument | null> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:read');
    return travelRepository.findNextUpcoming(petObjectId, new Date());
  },
};