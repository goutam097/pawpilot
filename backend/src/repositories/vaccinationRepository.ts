import { Types } from 'mongoose';
import { VaccinationModel, type VaccinationDocument } from '../models/Vaccination.js';

export interface CreateVaccinationData {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  vaccineName: string;
  givenAt: Date;
  nextDueAt: Date | null;
  administeredBy: string | null;
  lotNumber: string | null;
  notes: string | null;
  createReminder: boolean;
}

export interface UpdateVaccinationData {
  vaccineName?: string;
  givenAt?: Date;
  nextDueAt?: Date | null;
  administeredBy?: string | null;
  lotNumber?: string | null;
  notes?: string | null;
  createReminder?: boolean;
}

export const vaccinationRepository = {
  async listForPet(
    petId: Types.ObjectId,
    limit: number,
  ): Promise<VaccinationDocument[]> {
    return VaccinationModel.find({ petId })
      .sort({ givenAt: -1 })
      .limit(limit)
      .exec();
  },

  async findByIdAndPet(
    vaccinationId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<VaccinationDocument | null> {
    if (!Types.ObjectId.isValid(vaccinationId)) return null;
    return VaccinationModel.findOne({ _id: vaccinationId, petId }).exec();
  },

  async create(data: CreateVaccinationData): Promise<VaccinationDocument> {
    return VaccinationModel.create(data);
  },

  async updateById(
    vaccinationId: string | Types.ObjectId,
    petId: Types.ObjectId,
    data: UpdateVaccinationData,
  ): Promise<VaccinationDocument | null> {
    if (!Types.ObjectId.isValid(vaccinationId)) return null;
    return VaccinationModel.findOneAndUpdate(
      { _id: vaccinationId, petId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  async softDeleteById(
    vaccinationId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<VaccinationDocument | null> {
    if (!Types.ObjectId.isValid(vaccinationId)) return null;
    return VaccinationModel.findOneAndUpdate(
      { _id: vaccinationId, petId },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
  },

  /**
   * The most recent vaccination for a pet (any type).
   * Used by the dashboard's `lastVaccinationAt`.
   */
  async latestForPet(
    petId: Types.ObjectId,
  ): Promise<VaccinationDocument | null> {
    return VaccinationModel.findOne({ petId })
      .sort({ givenAt: -1 })
      .exec();
  },

  /**
   * The earliest future `nextDueAt` for a pet.
   * Used by the dashboard's `nextVaccinationDueAt`.
   */
  async nextDueForPet(
    petId: Types.ObjectId,
    now: Date,
  ): Promise<VaccinationDocument | null> {
    return VaccinationModel.findOne({
      petId,
      nextDueAt: { $gte: now },
    })
      .sort({ nextDueAt: 1 })
      .exec();
  },
};