import { Types } from 'mongoose';
import {
  vaccinationRepository,
  type CreateVaccinationData,
  type UpdateVaccinationData,
} from '../repositories/vaccinationRepository.js';
import { ReminderModel } from '../models/Reminder.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { require as requirePermission } from './petPermissionsService.js';
import type { VaccinationDocument } from '../models/Vaccination.js';
import type {
  CreateVaccinationInput,
  UpdateVaccinationInput,
  ListVaccinationsQuery,
} from '../validators/vaccinationValidators.js';

/**
 * Vaccination service.
 *
 * Beyond CRUD, this service manages the LINKED REMINDER for a vaccination
 * with a nextDueAt. The lifecycle:
 *
 * - Create: if nextDueAt + createReminder, insert a Reminder with
 *   sourceType='vaccination', sourceId=vaccination._id.
 * - Update: if nextDueAt changed and a reminder exists, update its dueAt.
 *   If createReminder flipped false and a reminder exists, delete it.
 *   If nextDueAt cleared and a reminder exists, delete it.
 *   If createReminder flipped true and nextDueAt set but no reminder exists,
 *   create one. (Edge case: user previously unchecked, now rechecks.)
 * - Delete: soft-delete the vaccination AND delete the linked reminder.
 *   The reminder's soft-delete is used (deletedAt) so the notification
 *   pipeline can't fire it.
 *
 * Invariants enforced:
 * - If nextDueAt is null, no linked reminder exists.
 * - If createReminder is false, no linked reminder exists.
 * - If both are set, at most ONE linked reminder exists.
 */

const DEFAULT_NOTIFY_OFFSET_MINUTES = 24 * 60; // 1 day before

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function vaccinationNotFound(): AppError {
  return new AppError(
    'Vaccination not found',
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.VACCINATION_NOT_FOUND,
  );
}

function computeNotifyAt(dueAt: Date, offsetMinutes: number): Date {
  return new Date(dueAt.getTime() - offsetMinutes * 60_000);
}

export function serializeVaccination(v: VaccinationDocument) {
  return {
    id: v._id.toString(),
    petId: v.petId.toString(),
    vaccineName: v.vaccineName,
    givenAt: v.givenAt.toISOString(),
    nextDueAt: v.nextDueAt ? v.nextDueAt.toISOString() : null,
    administeredBy: v.administeredBy ?? null,
    lotNumber: v.lotNumber ?? null,
    notes: v.notes ?? null,
    createReminder: v.createReminder,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

/**
 * Verify the pet exists and belongs to the user.
 */
async function verifyPetOwnership(
  userId: string,
  petId: string,
  permission: 'records:read' | 'records:write' | 'records:delete',
): Promise<Types.ObjectId> {
  const access = await requirePermission(userId, petId, permission);
  return access.pet._id;
}

/**
 * Find the linked reminder for a vaccination.
 * Uses the sourceType/sourceId index.
 */
async function findLinkedReminder(
  petId: Types.ObjectId,
  vaccinationId: Types.ObjectId,
) {
  return ReminderModel.findOne({
    petId,
    sourceType: 'vaccination',
    sourceId: vaccinationId,
  }).exec();
}

/**
 * Create a linked reminder for a vaccination.
 * Assumes the vaccination has nextDueAt.
 */
async function createLinkedReminder(
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  vaccination: VaccinationDocument,
): Promise<void> {
  if (!vaccination.nextDueAt) return;

  await ReminderModel.create({
    createdBy: ownerId,
    petId,
    title: `${vaccination.vaccineName} due`,
    description: `Next dose for ${vaccination.vaccineName}.`,
    type: 'vaccination',
    dueAt: vaccination.nextDueAt,
    notifyAt: computeNotifyAt(vaccination.nextDueAt, DEFAULT_NOTIFY_OFFSET_MINUTES),
    repeatRule: { kind: 'none' }, // Vaccination reminders are one-shot; the user creates a new vaccination record when done.
    notificationEnabled: true,
    notifyAtOffsetMinutes: DEFAULT_NOTIFY_OFFSET_MINUTES,
    sourceType: 'vaccination',
    sourceId: vaccination._id,
  });
}

/**
 * Update the linked reminder's dueAt to match the vaccination.
 */
async function updateLinkedReminder(
  reminderId: Types.ObjectId,
  petId: Types.ObjectId,
  nextDueAt: Date,
): Promise<void> {
  await ReminderModel.updateOne(
    { _id: reminderId, petId },
    {
      $set: {
        dueAt: nextDueAt,
        notifyAt: computeNotifyAt(nextDueAt, DEFAULT_NOTIFY_OFFSET_MINUTES),
        // Reset notification state — a new due date means the previous
        // notification (if any) is obsolete.
        lastNotifiedForDueAt: null,
      },
    },
  );
}

/**
 * Soft-delete a linked reminder.
 */
async function deleteLinkedReminder(reminderId: Types.ObjectId, petId: Types.ObjectId): Promise<void> {
  await ReminderModel.updateOne(
    { _id: reminderId, petId },
    { $set: { deletedAt: new Date() } },
  );
}

export const vaccinationService = {
  async list(
    userId: string,
    petId: string,
    query: ListVaccinationsQuery,
  ): Promise<VaccinationDocument[]> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:read');
    return vaccinationRepository.listForPet(petObjectId, query.limit ?? 100);
  },

  async getOne(
    userId: string,
    petId: string,
    vaccinationId: string,
  ): Promise<VaccinationDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:read');
    const vaccination = await vaccinationRepository.findByIdAndPet(vaccinationId, petObjectId);
    if (!vaccination) throw vaccinationNotFound();
    return vaccination;
  },

  async create(
    userId: string,
    petId: string,
    input: CreateVaccinationInput,
  ): Promise<VaccinationDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    const data: CreateVaccinationData = {
      createdBy,
      petId: petObjectId,
      vaccineName: input.vaccineName,
      givenAt: input.givenAt,
      nextDueAt: input.nextDueAt ?? null,
      administeredBy: input.administeredBy ?? null,
      lotNumber: input.lotNumber ?? null,
      notes: input.notes ?? null,
      createReminder: input.createReminder ?? true,
    };

    const vaccination = await vaccinationRepository.create(data);

    // Create the linked reminder if applicable.
    if (vaccination.createReminder && vaccination.nextDueAt) {
      await createLinkedReminder(createdBy, petObjectId, vaccination);
    }

    return vaccination;
  },

  async update(
    userId: string,
    petId: string,
    vaccinationId: string,
    input: UpdateVaccinationInput,
  ): Promise<VaccinationDocument> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    const existing = await vaccinationRepository.findByIdAndPet(vaccinationId, petObjectId);
    if (!existing) throw vaccinationNotFound();

    // Build the update payload.
    const update: UpdateVaccinationData = {};
    if (input.vaccineName !== undefined) update.vaccineName = input.vaccineName;
    if (input.givenAt !== undefined) update.givenAt = input.givenAt;
    if (input.nextDueAt !== undefined) update.nextDueAt = input.nextDueAt ?? null;
    if (input.administeredBy !== undefined) update.administeredBy = input.administeredBy ?? null;
    if (input.lotNumber !== undefined) update.lotNumber = input.lotNumber ?? null;
    if (input.notes !== undefined) update.notes = input.notes ?? null;
    if (input.createReminder !== undefined) update.createReminder = input.createReminder;

    // Cross-field validation on the MERGED result. Since the update might
    // change givenAt or nextDueAt independently, we need to check the
    // combination that would result after the update.
    const mergedGivenAt = input.givenAt ?? existing.givenAt;
    const mergedNextDueAt =
      input.nextDueAt !== undefined ? input.nextDueAt : existing.nextDueAt;
    if (mergedNextDueAt && mergedNextDueAt.getTime() <= mergedGivenAt.getTime()) {
      throw new AppError(
        'nextDueAt must be after givenAt',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const updated = await vaccinationRepository.updateById(
      vaccinationId,
      petObjectId,
      update,
    );
    if (!updated) throw vaccinationNotFound();

    // Reconcile the linked reminder with the new state.
    await reconcileLinkedReminder(createdBy, petObjectId, updated, existing);

    return updated;
  },

  async remove(userId: string, petId: string, vaccinationId: string): Promise<void> {
    const petObjectId = await verifyPetOwnership(userId, petId, 'records:delete');

    const existing = await vaccinationRepository.findByIdAndPet(vaccinationId, petObjectId);
    if (!existing) throw vaccinationNotFound();

    // Delete the linked reminder first (or after — order doesn't matter
    // much, but doing it first means a failure leaves us in a clean state
    // where the reminder is gone and the vaccination remains, which the
    // user can retry).
    const linkedReminder = await findLinkedReminder(petObjectId, existing._id);
    if (linkedReminder) {
      await deleteLinkedReminder(linkedReminder._id, petObjectId);
    }

    await vaccinationRepository.softDeleteById(vaccinationId, petObjectId);
  },
};

/**
 * Reconcile the linked reminder with the vaccination's current state.
 *
 * Rules:
 * - If shouldHaveReminder (createReminder && nextDueAt) and reminder exists:
 *   update its dueAt if changed.
 * - If shouldHaveReminder and no reminder exists: create one. This handles
 *   the case where the user previously had createReminder=false, or the
 *   reminder was deleted manually, and now wants it back.
 * - If !shouldHaveReminder and reminder exists: delete it.
 * - If !shouldHaveReminder and no reminder: no-op.
 */
async function reconcileLinkedReminder(
  createdBy: Types.ObjectId,
  petId: Types.ObjectId,
  updated: VaccinationDocument,
  previous: VaccinationDocument,
): Promise<void> {
  const shouldHaveReminder = updated.createReminder && !!updated.nextDueAt;
  const existingReminder = await findLinkedReminder(petId, updated._id);

  if (shouldHaveReminder) {
    if (existingReminder) {
      // Update if the due date changed.
      const dueChanged =
        !previous.nextDueAt ||
        !updated.nextDueAt ||
        previous.nextDueAt.getTime() !== updated.nextDueAt.getTime();

      if (dueChanged && updated.nextDueAt) {
        await updateLinkedReminder(existingReminder._id, petId, updated.nextDueAt);
      }

      // Also update the title if the vaccine name changed.
      if (previous.vaccineName !== updated.vaccineName) {
        await ReminderModel.updateOne(
          { _id: existingReminder._id },
          { $set: { title: `${updated.vaccineName} due` } },
        );
      }
    } else if (updated.nextDueAt) {
      await createLinkedReminder(createdBy, petId, updated);
    }
  } else if (existingReminder) {
    await deleteLinkedReminder(existingReminder._id, petId);
  }
}