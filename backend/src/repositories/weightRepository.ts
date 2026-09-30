import { Types } from 'mongoose';
import { WeightRecordModel, type WeightRecordDocument } from '../models/WeightRecord.js';
import type { WeightUnit } from '../utils/weightUnits.js';

export interface CreateWeightData {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  weight: number;
  unit: WeightUnit;
  recordedAt: Date;
  notes: string | null;
}

export interface UpdateWeightData {
  weight?: number;
  unit?: WeightUnit;
  recordedAt?: Date;
  notes?: string | null;
}

export const weightRepository = {
  async listForPet(
    petId: Types.ObjectId,
    limit: number,
  ): Promise<WeightRecordDocument[]> {
    return WeightRecordModel.find({ petId })
      .sort({ recordedAt: -1 })
      .limit(limit)
      .exec();
  },

  async findByIdAndPet(
    recordId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<WeightRecordDocument | null> {
    if (!Types.ObjectId.isValid(recordId)) return null;
    return WeightRecordModel.findOne({ _id: recordId, petId }).exec();
  },

  async create(data: CreateWeightData): Promise<WeightRecordDocument> {
    return WeightRecordModel.create(data);
  },

  async updateById(
    recordId: string | Types.ObjectId,
    petId: Types.ObjectId,
    data: UpdateWeightData,
  ): Promise<WeightRecordDocument | null> {
    if (!Types.ObjectId.isValid(recordId)) return null;
    return WeightRecordModel.findOneAndUpdate(
      { _id: recordId, petId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  async softDeleteById(
    recordId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<WeightRecordDocument | null> {
    if (!Types.ObjectId.isValid(recordId)) return null;
    return WeightRecordModel.findOneAndUpdate(
      { _id: recordId, petId },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
  },

  /**
   * Latest N records for a pet — used by the pet service to sync the
   * `pet.weight` cache and by the dashboard.
   */
  async latestForPet(
    petId: Types.ObjectId,
    limit: number,
  ): Promise<WeightRecordDocument[]> {
    return WeightRecordModel.find({ petId })
      .sort({ recordedAt: -1 })
      .limit(limit)
      .exec();
  },
};