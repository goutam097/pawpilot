import { Types } from 'mongoose';
import { VaccinationModel, type VaccinationDocument } from '../models/Vaccination.js';

export interface CreateVaccinationData {
  ownerId: Types.ObjectId;
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
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    limit: number,
  ): Promise<VaccinationDocument[]> {
    return VaccinationModel.find({ ownerId, petId })
      .sort({ givenAt: -1 })
      .limit(limit)
      .exec();
  },

  async findByIdForOwnerAndPet(
    vaccinationId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<VaccinationDocument | null> {
    if (!Types.ObjectId.isValid(vaccinationId)) return null;
    return VaccinationModel.findOne({ _id: vaccinationId, ownerId, petId }).exec();
  },

  async create(data: CreateVaccinationData): Promise<VaccinationDocument> {
    return VaccinationModel.create(data);
  },

  async updateForOwner(
    vaccinationId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
    data: UpdateVaccinationData,
  ): Promise<VaccinationDocument | null> {
    if (!Types.ObjectId.isValid(vaccinationId)) return null;
    return VaccinationModel.findOneAndUpdate(
      { _id: vaccinationId, ownerId },
      { $set: data },
      { new: true, runValidators: true },
    ).exec();
  },

  async softDeleteForOwner(
    vaccinationId: string | Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<VaccinationDocument | null> {
    if (!Types.ObjectId.isValid(vaccinationId)) return null;
    return VaccinationModel.findOneAndUpdate(
      { _id: vaccinationId, ownerId },
      { $set: { deletedAt: new Date() } },
      { new: true },
    ).exec();
  },

  /**
   * The most recent vaccination for a pet (any type).
   * Used by the dashboard's `lastVaccinationAt`.
   */
  async latestForPet(
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<VaccinationDocument | null> {
    return VaccinationModel.findOne({ ownerId, petId })
      .sort({ givenAt: -1 })
      .exec();
  },

  /**
   * The earliest future `nextDueAt` for a pet.
   * Used by the dashboard's `nextVaccinationDueAt`.
   */
  async nextDueForPet(
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    now: Date,
  ): Promise<VaccinationDocument | null> {
    return VaccinationModel.findOne({
      ownerId,
      petId,
      nextDueAt: { $gte: now },
    })
      .sort({ nextDueAt: 1 })
      .exec();
  },
};