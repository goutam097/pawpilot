import { Types } from 'mongoose';
import { MedicationModel, type MedicationDocument, type MedicationFrequency } from '../models/Medication.js';

export interface CreateMedicationData {
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  name: string;
  dosage: string | null;
  frequency: MedicationFrequency;
  startDate: Date;
  endDate: Date | null;
  timeOfDay: string;
  instructions: string | null;
  prescribedBy: string | null;
  notificationsEnabled: boolean;
}

export interface UpdateMedicationData {
  name?: string;
  dosage?: string | null;
  frequency?: MedicationFrequency;
  startDate?: Date;
  endDate?: Date | null;
  timeOfDay?: string;
  instructions?: string | null;
  prescribedBy?: string | null;
  notificationsEnabled?: boolean;
}

export const medicationRepository = {
  async listForPet(
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    onlyActive: boolean,
    now: Date,
    limit: number,
  ): Promise<MedicationDocument[]> {
    const filter: Record<string, unknown> = { ownerId, petId };

    if (onlyActive) {
      filter.startDate = { $lte: now };
      filter.$or = [{ endDate: null }, { endDate: { $gte: now } }];
    }

    return MedicationModel.find(filter)
      .sort({ startDate: -1 })
      .limit(limit)
      .exec();
  },

  async findByIdForOwnerAndPet(
    medicationId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<MedicationDocument | null> {
    if (!Types.ObjectId.isValid(medicationId)) return null;
    return MedicationModel.findOne({ _id: medicationId, ownerId, petId }).exec();
  },

  async create(data: CreateMedicationData): Promise<MedicationDocument> {
    return MedicationModel.create(data);
  },

  async updateForOwner(
    medicationId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
    data: UpdateMedicationData,
  ): Promise<MedicationDocument | null> {
    if (!Types.ObjectId.isValid(medicationId)) return null;
    return MedicationModel.findOneAndUpdate(
      { _id: medicationId, ownerId },
      { $set: data },
      { new: true, runValidators: true },
    ).exec();
  },

  async softDeleteForOwner(
    medicationId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<MedicationDocument | null> {
    if (!Types.ObjectId.isValid(medicationId)) return null;
    return MedicationModel.findOneAndUpdate(
      { _id: medicationId, ownerId },
      { $set: { deletedAt: new Date() } },
      { new: true },
    ).exec();
  },

  /**
   * Count active medications for a pet.
   *
   * "Active" means:
   *   startDate <= now AND (endDate IS NULL OR endDate >= now)
   *
   * Used by the dashboard.
   */
  async countActiveForPet(
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    now: Date,
  ): Promise<number> {
    return MedicationModel.countDocuments({
      ownerId,
      petId,
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).exec();
  },
};