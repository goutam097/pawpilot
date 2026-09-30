import { Types } from 'mongoose';
import {
  vetVisitRepository,
  type CreateVetVisitData,
  type UpdateVetVisitData,
} from '../repositories/vetVisitRepository.js';
import { expenseRepository } from '../repositories/expenseRepository.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { require as requirePermission } from './petPermissionsService.js';
import type { VetVisitDocument } from '../models/VetVisit.js';
import type {
  CreateVetVisitInput,
  UpdateVetVisitInput,
  ListVetVisitsQuery,
} from '../validators/vetVisitValidators.js';

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function vetVisitNotFound(): AppError {
  return new AppError(
    'Vet visit not found',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.VET_VISIT_NOT_FOUND,
  );
}

export function serializeVetVisit(v: VetVisitDocument) {
  return {
    id: v._id.toString(),
    petId: v.petId.toString(),
    visitDate: v.visitDate.toISOString(),
    vetName: v.vetName ?? null,
    clinicName: v.clinicName ?? null,
    reason: v.reason ?? null,
    diagnosis: v.diagnosis ?? null,
    treatment: v.treatment ?? null,
    costCents: v.costCents ?? null,
    notes: v.notes ?? null,
    scheduled: v.scheduled,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
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
 * Build the expense description for a vet visit.
 */
function buildExpenseDescription(v: VetVisitDocument): string {
  const parts: string[] = [];
  if (v.clinicName) parts.push(v.clinicName);
  else if (v.vetName) parts.push(`Dr. ${v.vetName}`);
  if (v.reason) parts.push(`- ${v.reason}`);
  return parts.length > 0 ? `Vet visit ${parts.join(' ')}` : 'Vet visit';
}

/**
 * Reconcile the linked expense for a vet visit.
 *
 * Rules:
 * - If costCents > 0: create or update the linked expense.
 * - If costCents is null or 0: delete the linked expense (if any).
 */
async function reconcileLinkedExpense(
  createdBy: Types.ObjectId,
  petId: Types.ObjectId,
  visit: VetVisitDocument,
): Promise<void> {
  const shouldHaveExpense = (visit.costCents ?? 0) > 0;

  const existingExpense = await expenseRepository.findLinked('vet_visit', visit._id);

  if (shouldHaveExpense) {
    const data = {
      createdBy,
      petId,
      amountCents: visit.costCents!,
      currency: 'USD' as const,
      category: 'vet' as const,
      date: visit.visitDate,
      description: buildExpenseDescription(visit),
      notes: null,
      sourceType: 'vet_visit' as const,
      sourceId: visit._id,
    };

    if (existingExpense) {
      await expenseRepository.updateById(existingExpense._id, petId, data);
    } else {
      await expenseRepository.create(data);
    }
  } else if (existingExpense) {
    await expenseRepository.softDeleteById(existingExpense._id, petId);
  }
}

export const vetVisitService = {
  async list(
    userId: string,
    petId: string,
    query: ListVetVisitsQuery,
  ): Promise<VetVisitDocument[]> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:read');
    return vetVisitRepository.listForPet(
      petObjectId,
      query.status ?? null,
      query.limit ?? 100,
    );
  },

  async getOne(userId: string, petId: string, visitId: string): Promise<VetVisitDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:read');
    const visit = await vetVisitRepository.findByIdAndPet(visitId, petObjectId);
    if (!visit) throw vetVisitNotFound();
    return visit;
  },

  async create(
    userId: string,
    petId: string,
    input: CreateVetVisitInput,
  ): Promise<VetVisitDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    // Auto-determine `scheduled` if the client didn't specify.
    const scheduled =
      input.scheduled ?? input.visitDate.getTime() > Date.now();

    const data: CreateVetVisitData = {
      createdBy,
      petId: petObjectId,
      visitDate: input.visitDate,
      vetName: input.vetName ?? null,
      clinicName: input.clinicName ?? null,
      reason: input.reason ?? null,
      diagnosis: input.diagnosis ?? null,
      treatment: input.treatment ?? null,
      costCents: input.costCents ?? null,
      notes: input.notes ?? null,
      scheduled,
    };

    const visit = await vetVisitRepository.create(data);

    await reconcileLinkedExpense(createdBy, petObjectId, visit);

    return visit;
  },

  async update(
    userId: string,
    petId: string,
    visitId: string,
    input: UpdateVetVisitInput,
  ): Promise<VetVisitDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    const update: UpdateVetVisitData = {};
    if (input.visitDate !== undefined) update.visitDate = input.visitDate;
    if (input.vetName !== undefined) update.vetName = input.vetName ?? null;
    if (input.clinicName !== undefined) update.clinicName = input.clinicName ?? null;
    if (input.reason !== undefined) update.reason = input.reason ?? null;
    if (input.diagnosis !== undefined) update.diagnosis = input.diagnosis ?? null;
    if (input.treatment !== undefined) update.treatment = input.treatment ?? null;
    if (input.costCents !== undefined) update.costCents = input.costCents ?? null;
    if (input.notes !== undefined) update.notes = input.notes ?? null;
    if (input.scheduled !== undefined) update.scheduled = input.scheduled;

    const updated = await vetVisitRepository.updateById(visitId, petObjectId, update);
    if (!updated) throw vetVisitNotFound();

    await reconcileLinkedExpense(createdBy, petObjectId, updated);

    return updated;
  },

  async remove(userId: string, petId: string, visitId: string): Promise<void> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:delete');

    const existing = await vetVisitRepository.findByIdAndPet(visitId, petObjectId);
    if (!existing) throw vetVisitNotFound();

    // Cascade: delete the linked expense before the visit.
    const linkedExpense = await expenseRepository.findLinked('vet_visit', existing._id);
    if (linkedExpense) {
      await expenseRepository.softDeleteById(linkedExpense._id, petObjectId);
    }

    await vetVisitRepository.softDeleteById(visitId, petObjectId);
  },

  /**
   * Upcoming scheduled visits — used by the dashboard.
   */
  async listUpcoming(
    userId: string,
    petId: string,
    limit: number,
  ): Promise<VetVisitDocument[]> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:read');
    return vetVisitRepository.listUpcomingScheduled(petObjectId, new Date(), limit);
  },
};