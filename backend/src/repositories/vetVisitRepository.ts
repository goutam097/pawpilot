import { Types } from 'mongoose';
import { VetVisitModel, type VetVisitDocument } from '../models/VetVisit.js';

export interface CreateVetVisitData {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  visitDate: Date;
  vetName: string | null;
  clinicName: string | null;
  reason: string | null;
  diagnosis: string | null;
  treatment: string | null;
  costCents: number | null;
  notes: string | null;
  scheduled: boolean;
}

export interface UpdateVetVisitData {
  visitDate?: Date;
  vetName?: string | null;
  clinicName?: string | null;
  reason?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  costCents?: number | null;
  notes?: string | null;
  scheduled?: boolean;
}

export const vetVisitRepository = {
  async listForPet(
    petId: Types.ObjectId,
    status: 'scheduled' | 'completed' | null,
    limit: number,
  ): Promise<VetVisitDocument[]> {
    const filter: Record<string, unknown> = { petId };
    if (status === 'scheduled') filter.scheduled = true;
    if (status === 'completed') filter.scheduled = false;

    return VetVisitModel.find(filter)
      .sort({ visitDate: -1 })
      .limit(limit)
      .exec();
  },

  async findByIdAndPet(
    visitId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<VetVisitDocument | null> {
    if (!Types.ObjectId.isValid(visitId)) return null;
    return VetVisitModel.findOne({ _id: visitId, petId }).exec();
  },

  async create(data: CreateVetVisitData): Promise<VetVisitDocument> {
    return VetVisitModel.create(data);
  },

  async updateById(
    visitId: string | Types.ObjectId,
    petId: Types.ObjectId,
    data: UpdateVetVisitData,
  ): Promise<VetVisitDocument | null> {
    if (!Types.ObjectId.isValid(visitId)) return null;
    return VetVisitModel.findOneAndUpdate(
      { _id: visitId, petId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  async softDeleteById(
    visitId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<VetVisitDocument | null> {
    if (!Types.ObjectId.isValid(visitId)) return null;
    return VetVisitModel.findOneAndUpdate(
      { _id: visitId, petId },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
  },

  /**
   * Scheduled visits in the future — for the dashboard's `upcoming`.
   */
  async listUpcomingScheduled(
    petId: Types.ObjectId,
    now: Date,
    limit: number,
  ): Promise<VetVisitDocument[]> {
    return VetVisitModel.find({
      petId,
      scheduled: true,
      visitDate: { $gte: now },
    })
      .sort({ visitDate: 1 })
      .limit(limit)
      .exec();
  },
};