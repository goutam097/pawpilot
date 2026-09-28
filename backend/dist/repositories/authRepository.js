import { Types } from 'mongoose';
import { UserModel } from '../models/User.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
export const authRepository = {
    // ---------- User ----------------------------------------------------------
    async findUserByEmail(email) {
        return UserModel.findOne({ email }).exec();
    },
    /**
     * Fetch a user INCLUDING the password hash.
     * Deliberately named so any call site is obviously opting into a sensitive read.
     */
    async findUserByEmailWithPassword(email) {
        return UserModel.findOne({ email }).select('+passwordHash').exec();
    },
    async findUserById(userId) {
        if (!Types.ObjectId.isValid(userId))
            return null;
        return UserModel.findById(userId).exec();
    },
    async createUser(data) {
        return UserModel.create(data);
    },
    async updateUserName(userId, name) {
        if (!Types.ObjectId.isValid(userId))
            return null;
        return UserModel.findByIdAndUpdate(userId, { $set: { name } }, { new: true, runValidators: true }).exec();
    },
    // ---------- Refresh tokens ------------------------------------------------
    async createRefreshToken(data) {
        return RefreshTokenModel.create(data);
    },
    async findRefreshTokenByHash(hash) {
        return RefreshTokenModel.findOne({ tokenHash: hash }).exec();
    },
    async deleteRefreshTokenByHash(hash) {
        await RefreshTokenModel.deleteOne({ tokenHash: hash }).exec();
    },
    async deleteAllRefreshTokensForUser(userId) {
        if (!Types.ObjectId.isValid(userId))
            return;
        await RefreshTokenModel.deleteMany({ userId }).exec();
    },
};
//# sourceMappingURL=authRepository.js.map