import { Types } from 'mongoose';
import { MedicationModel, type MedicationDocument, type MedicationFrequency } from '../models/Medication.js';

export interface CreateMedicationData {
  createdBy: Types.ObjectId;
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
    petId: Types.ObjectId,
    onlyActive: boolean,
    now: Date,
    limit: number,
  ): Promise<MedicationDocument[]> {
    const filter: Record<string, unknown> = { petId };

    if (onlyActive) {
      filter.startDate = { $lte: now };
      filter.$or = [{ endDate: null }, { endDate: { $gte: now } }];
    }

    return MedicationModel.find(filter)
      .sort({ startDate: -1 })
      .limit(limit)
      .exec();
  },

  async findByIdAndPet(
    medicationId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<MedicationDocument | null> {
    if (!Types.ObjectId.isValid(medicationId)) return null;
    return MedicationModel.findOne({ _id: medicationId, petId }).exec();
  },

  async create(data: CreateMedicationData): Promise<MedicationDocument> {
    return MedicationModel.create(data);
  },

  async updateById(
    medicationId: string | Types.ObjectId,
    petId: Types.ObjectId,
    data: UpdateMedicationData,
  ): Promise<MedicationDocument | null> {
    if (!Types.ObjectId.isValid(medicationId)) return null;
    return MedicationModel.findOneAndUpdate(
      { _id: medicationId, petId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  async softDeleteById(
    medicationId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<MedicationDocument | null> {
    if (!Types.ObjectId.isValid(medicationId)) return null;
    return MedicationModel.findOneAndUpdate(
      { _id: medicationId, petId },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' },
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
    petId: Types.ObjectId,
    now: Date,
  ): Promise<number> {
    return MedicationModel.countDocuments({
      petId,
      startDate: { $lte: now },
      $or: [{ endDate: null }, { endDate: { $gte: now } }],
    }).exec();
  },
};