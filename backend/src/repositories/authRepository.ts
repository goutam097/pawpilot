import { Types } from 'mongoose';
import { UserModel, type UserDocument } from '../models/User.js';
import { RefreshTokenModel, type RefreshTokenDocument } from '../models/RefreshToken.js';

/**
 * Auth repository — the only place that queries User and RefreshToken models.
 *
 * Why a repository layer?
 * - Services express business rules ("if the email exists, fail") without
 *   knowing about Mongoose query syntax.
 * - If we ever swap Mongo for Postgres, or add a caching layer, we change
 *   the repository — services are untouched.
 * - Repositories are trivially mockable in unit tests.
 *
 * Rules:
 * - Repositories never throw AppError. They return data or null, and the
 *   service decides what a missing result means.
 * - Repositories never see `req` or `res`. They're pure data-access.
 */

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
}

export interface CreateRefreshTokenData {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}

export const authRepository = {
  // ---------- User ----------------------------------------------------------

  async findUserByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).exec();
  },

  /**
   * Fetch a user INCLUDING the password hash.
   * Deliberately named so any call site is obviously opting into a sensitive read.
   */
  async findUserByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).select('+passwordHash').exec();
  },

  async findUserById(userId: string | Types.ObjectId): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    return UserModel.findById(userId).exec();
  },

  async createUser(data: CreateUserData): Promise<UserDocument> {
    return UserModel.create(data);
  },

  async updateUserName(
    userId: string | Types.ObjectId,
    name: string,
  ): Promise<UserDocument | null> {
    if (!Types.ObjectId.isValid(userId)) return null;
    return UserModel.findByIdAndUpdate(
      userId,
      { $set: { name } },
      { new: true, runValidators: true },
    ).exec();
  },

  // ---------- Refresh tokens ------------------------------------------------

  async createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshTokenDocument> {
    return RefreshTokenModel.create(data);
  },

  async findRefreshTokenByHash(hash: string): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({ tokenHash: hash }).exec();
  },

  async deleteRefreshTokenByHash(hash: string): Promise<void> {
    await RefreshTokenModel.deleteOne({ tokenHash: hash }).exec();
  },

  async deleteAllRefreshTokensForUser(userId: Types.ObjectId | string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) return;
    await RefreshTokenModel.deleteMany({ userId }).exec();
  },
};