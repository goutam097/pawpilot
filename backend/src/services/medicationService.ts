import { Types } from 'mongoose';
import {
  medicationRepository,
  type CreateMedicationData,
  type UpdateMedicationData,
} from '../repositories/medicationRepository.js';
import { ReminderModel } from '../models/Reminder.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { require as requirePermission } from './petPermissionsService.js';
import type { MedicationDocument, MedicationFrequency } from '../models/Medication.js';
import type {
  CreateMedicationInput,
  UpdateMedicationInput,
  ListMedicationsQuery,
} from '../validators/medicationValidators.js';

function toObjectId(id: string, fieldName = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName}`, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }
  return new Types.ObjectId(id);
}

function medicationNotFound(): AppError {
  return new AppError('Medication not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.MEDICATION_NOT_FOUND);
}

function frequencyToRepeatRule(frequency: MedicationFrequency) {
  switch (frequency) {
    case 'daily':
      return { kind: 'daily' as const, interval: 1 };
    case 'every_other_day':
      return { kind: 'daily' as const, interval: 2 };
    case 'weekly':
      return { kind: 'weekly' as const, interval: 1 };
    case 'monthly':
      return { kind: 'monthly' as const, interval: 1 };
    case 'as_needed':
      return null;
  }
}

export function serializeMedication(m: MedicationDocument) {
  return {
    id: m._id.toString(),
    petId: m.petId.toString(),
    name: m.name,
    dosage: m.dosage ?? null,
    frequency: m.frequency,
    startDate: m.startDate.toISOString(),
    endDate: m.endDate ? m.endDate.toISOString() : null,
    instructions: m.instructions ?? null,
    prescribedBy: m.prescribedBy ?? null,
    notificationsEnabled: m.notificationsEnabled,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
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

async function findLinkedReminder(petId: Types.ObjectId, medicationId: Types.ObjectId) {
  return ReminderModel.findOne({
    petId,
    sourceType: 'medication',
    sourceId: medicationId,
  }).exec();
}

function buildMedicationReminderCopy(m: MedicationDocument): {
  title: string;
  description: string;
} {
  const dosePart = m.dosage ? `${m.dosage} of ` : '';
  const instructionsPart = m.instructions ? ` ${m.instructions}` : '';
  return {
    title: m.name,
    description: `Give ${dosePart}${m.name}.${instructionsPart}`,
  };
}

async function createLinkedReminder(
  ownerId: Types.ObjectId,
  petId: Types.ObjectId,
  medication: MedicationDocument,
): Promise<void> {
  const rule = frequencyToRepeatRule(medication.frequency);
  if (!rule) return;

  const dueAt = medication.startDate;
  const copy = buildMedicationReminderCopy(medication);
  const notifyAtOffsetMinutes = 0;
  const notifyAt = dueAt;

  await ReminderModel.create({
    createdBy: ownerId,
    petId,
    title: copy.title,
    description: copy.description,
    type: 'medication',
    dueAt,
    notifyAt,
    repeatRule: rule,
    notificationEnabled: true,
    notifyAtOffsetMinutes,
    sourceType: 'medication',
    sourceId: medication._id,
  });
}

async function updateLinkedReminder(
  reminderId: Types.ObjectId,
  medication: MedicationDocument,
): Promise<void> {
  const rule = frequencyToRepeatRule(medication.frequency);
  if (!rule) return;

  const dueAt = medication.startDate;
  const copy = buildMedicationReminderCopy(medication);

  await ReminderModel.updateOne(
    { _id: reminderId },
    {
      $set: {
        title: copy.title,
        description: copy.description,
        dueAt,
        notifyAt: dueAt,
        repeatRule: rule,
        lastNotifiedForDueAt: null,
      },
    },
  );
}

async function deleteLinkedReminder(reminderId: Types.ObjectId, petId: Types.ObjectId): Promise<void> {
  await ReminderModel.updateOne(
    { _id: reminderId, petId },
    { $set: { deletedAt: new Date() } },
  );
}

async function reconcileLinkedReminder(
  createdBy: Types.ObjectId,
  petId: Types.ObjectId,
  medication: MedicationDocument,
): Promise<void> {
  const shouldHaveReminder =
    medication.notificationsEnabled && medication.frequency !== 'as_needed';

  const existingReminder = await findLinkedReminder(petId, medication._id);

  if (shouldHaveReminder) {
    if (existingReminder) {
      await updateLinkedReminder(existingReminder._id, medication);
    } else {
      await createLinkedReminder(createdBy, petId, medication);
    }
  } else if (existingReminder) {
    await deleteLinkedReminder(existingReminder._id, petId);
  }
}

export const medicationService = {
  async list(
    userId: string,
    petId: string,
    query: ListMedicationsQuery,
  ): Promise<MedicationDocument[]> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:read');
    return medicationRepository.listForPet(
      petObjectId,
      query.active ?? false,
      new Date(),
      query.limit ?? 100,
    );
  },

  async getOne(
    userId: string,
    petId: string,
    medicationId: string,
  ): Promise<MedicationDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:read');
    const medication = await medicationRepository.findByIdAndPet(medicationId, petObjectId);
    if (!medication) throw medicationNotFound();
    return medication;
  },

  async create(
    userId: string,
    petId: string,
    input: CreateMedicationInput,
  ): Promise<MedicationDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    const data: CreateMedicationData = {
      createdBy,
      petId: petObjectId,
      name: input.name,
      dosage: input.dosage ?? null,
      frequency: input.frequency as MedicationFrequency,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      timeOfDay: input.timeOfDay,
      instructions: input.instructions ?? null,
      prescribedBy: input.prescribedBy ?? null,
      notificationsEnabled: input.notificationsEnabled ?? true,
    };

    const medication = await medicationRepository.create(data);

    if (medication.notificationsEnabled && medication.frequency !== 'as_needed') {
      await createLinkedReminder(createdBy, petObjectId, medication);
    }

    return medication;
  },

  async update(
    userId: string,
    petId: string,
    medicationId: string,
    input: UpdateMedicationInput,
  ): Promise<MedicationDocument> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:write');
    const createdBy = toObjectId(userId, 'userId');

    const existing = await medicationRepository.findByIdAndPet(medicationId, petObjectId);
    if (!existing) throw medicationNotFound();

    const update: UpdateMedicationData = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.dosage !== undefined) update.dosage = input.dosage ?? null;
    if (input.frequency !== undefined) update.frequency = input.frequency as MedicationFrequency;
    if (input.startDate !== undefined) update.startDate = input.startDate;
    if (input.endDate !== undefined) update.endDate = input.endDate ?? null;
    if (input.timeOfDay !== undefined) update.timeOfDay = input.timeOfDay;
    if (input.instructions !== undefined) update.instructions = input.instructions ?? null;
    if (input.prescribedBy !== undefined) update.prescribedBy = input.prescribedBy ?? null;
    if (input.notificationsEnabled !== undefined) update.notificationsEnabled = input.notificationsEnabled;

    const mergedStart = input.startDate ?? existing.startDate;
    const mergedEnd = input.endDate !== undefined ? input.endDate : existing.endDate;
    if (mergedEnd && mergedEnd.getTime() <= mergedStart.getTime()) {
      throw new AppError(
        'endDate must be after startDate',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const updated = await medicationRepository.updateById(medicationId, petObjectId, update);
    if (!updated) throw medicationNotFound();

    await reconcileLinkedReminder(createdBy, petObjectId, updated);

    return updated;
  },

  async remove(userId: string, petId: string, medicationId: string): Promise<void> {
    const petObjectId = await requirePetAccess(userId, petId, 'records:delete');

    const existing = await medicationRepository.findByIdAndPet(medicationId, petObjectId);
    if (!existing) throw medicationNotFound();

    const linkedReminder = await findLinkedReminder(petObjectId, existing._id);
    if (linkedReminder) {
      await deleteLinkedReminder(linkedReminder._id, petObjectId);
    }

    await medicationRepository.softDeleteById(medicationId, petObjectId);
  },
};