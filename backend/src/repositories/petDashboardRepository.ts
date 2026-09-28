import { Types } from 'mongoose';
import { WeightRecordModel } from '../models/WeightRecord.js';

/**
 * Lean version of a weight record.
 *
 * `.lean()` returns plain objects. Their type in Mongoose is
 * `FlattenMaps<WeightRecord> & { _id: Types.ObjectId }`, which is close to
 * `WeightRecord` but not identical. Rather than cast everywhere, we define
 * the shape we actually receive.
 */
export interface LeanWeightRecord {
  _id: Types.ObjectId;
  petId: Types.ObjectId;
  ownerId: Types.ObjectId;
  weight: number;
  unit: 'kg' | 'lb';
  recordedAt: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const petDashboardRepository = {
  /**
   * Fetch the latest N weight records for a pet owned by this user.
   * Returns [] if the pet isn't owned by the user — the ownerId filter
   * enforces this at the query level.
   */
  async latestWeightRecords(
    ownerId: Types.ObjectId,
    petId: Types.ObjectId,
    limit: number,
  ): Promise<LeanWeightRecord[]> {
    const records = await WeightRecordModel.find({ ownerId, petId })
      .sort({ recordedAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    // `lean()` returns the object shape we declared; cast through unknown to
    // satisfy TS's FlattenMaps machinery without sprinkling casts downstream.
    return records as unknown as LeanWeightRecord[];
  },
};