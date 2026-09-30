import { Types } from 'mongoose';
import {
  LostPetReportModel,
  type LostPetReportDocument,
  type ContactMethod,
} from '../models/LostPetReport.js';

export interface CreateLostReportData {
  ownerId: Types.ObjectId;
  petId: Types.ObjectId;
  lastSeenAt: Date;
  lastSeenLocation: string;
  description: string | null;
  contactMethod: ContactMethod;
  contactPhone: string | null;
  contactEmail: string | null;
  rewardOffered: string | null;
}

export const lostPetRepository = {
  async create(data: CreateLostReportData): Promise<LostPetReportDocument> {
    return LostPetReportModel.create(data);
  },

  /**
   * Find the currently active report for a pet.
   * Active = not found, not expired.
   */
  async findActiveForPet(
    petId: Types.ObjectId,
  ): Promise<LostPetReportDocument | null> {
    const now = new Date();
    return LostPetReportModel.findOne({
      petId,
      foundAt: null,
      expiresAt: { $gt: now },
    }).exec();
  },

  async findById(
    reportId: string | Types.ObjectId,
  ): Promise<LostPetReportDocument | null> {
    if (!Types.ObjectId.isValid(reportId)) return null;
    return LostPetReportModel.findById(reportId).exec();
  },

  /**
   * Public lookup by token.
   * No ownerId filter — this is intentional. The token IS the authorization.
   * Rate limiting is the abuse mitigation.
   */
  async findByToken(token: string): Promise<LostPetReportDocument | null> {
    if (typeof token !== 'string' || token.length < 16 || token.length > 64) {
      return null;
    }
    return LostPetReportModel.findOne({ shareToken: token }).exec();
  },

  /**
   * Mark a report as found.
   */
  async markFound(
    reportId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<LostPetReportDocument | null> {
    return LostPetReportModel.findOneAndUpdate(
      { _id: reportId, petId },
      { $set: { foundAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
  },

  /**
   * Update report details (location, description, etc.).
   */
  async updateById(
    reportId: Types.ObjectId,
    petId: Types.ObjectId,
    data: Partial<CreateLostReportData>,
  ): Promise<LostPetReportDocument | null> {
    return LostPetReportModel.findOneAndUpdate(
      { _id: reportId, petId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  /**
   * Rotate the share token. The old token becomes invalid immediately.
   */
  async regenerateToken(
    reportId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<LostPetReportDocument | null> {
    // Import crypto here to avoid a top-level dependency just for this.
    const crypto = await import('node:crypto');
    const newToken = crypto.randomBytes(24).toString('base64url');

    return LostPetReportModel.findOneAndUpdate(
      { _id: reportId, petId },
      { $set: { shareToken: newToken } },
      { returnDocument: 'after' },
    ).exec();
  },

  async softDeleteById(
    reportId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<void> {
    await LostPetReportModel.updateOne(
      { _id: reportId, petId },
      { $set: { deletedAt: new Date() } },
    ).exec();
  },
};