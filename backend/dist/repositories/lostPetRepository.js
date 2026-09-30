import { Types } from 'mongoose';
import { LostPetReportModel, } from '../models/LostPetReport.js';
export const lostPetRepository = {
    async create(data) {
        return LostPetReportModel.create(data);
    },
    /**
     * Find the currently active report for a pet.
     * Active = not found, not expired.
     */
    async findActiveForPet(ownerId, petId) {
        const now = new Date();
        return LostPetReportModel.findOne({
            ownerId,
            petId,
            foundAt: null,
            expiresAt: { $gt: now },
        }).exec();
    },
    async findByIdForOwner(reportId, ownerId) {
        if (!Types.ObjectId.isValid(reportId))
            return null;
        return LostPetReportModel.findOne({ _id: reportId, ownerId }).exec();
    },
    /**
     * Public lookup by token.
     * No ownerId filter — this is intentional. The token IS the authorization.
     * Rate limiting is the abuse mitigation.
     */
    async findByToken(token) {
        if (typeof token !== 'string' || token.length < 16 || token.length > 64) {
            return null;
        }
        return LostPetReportModel.findOne({ shareToken: token }).exec();
    },
    /**
     * Mark a report as found.
     */
    async markFound(reportId, ownerId) {
        return LostPetReportModel.findOneAndUpdate({ _id: reportId, ownerId }, { $set: { foundAt: new Date() } }, { new: true }).exec();
    },
    /**
     * Update report details (location, description, etc.).
     */
    async updateForOwner(reportId, ownerId, data) {
        return LostPetReportModel.findOneAndUpdate({ _id: reportId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    /**
     * Rotate the share token. The old token becomes invalid immediately.
     */
    async regenerateToken(reportId, ownerId) {
        // Import crypto here to avoid a top-level dependency just for this.
        const crypto = await import('node:crypto');
        const newToken = crypto.randomBytes(24).toString('base64url');
        return LostPetReportModel.findOneAndUpdate({ _id: reportId, ownerId }, { $set: { shareToken: newToken } }, { new: true }).exec();
    },
    async softDeleteForOwner(reportId, ownerId) {
        await LostPetReportModel.updateOne({ _id: reportId, ownerId }, { $set: { deletedAt: new Date() } }).exec();
    },
};
//# sourceMappingURL=lostPetRepository.js.map