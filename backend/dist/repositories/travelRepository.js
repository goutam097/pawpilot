import { Types } from 'mongoose';
import { TravelPlanModel, } from '../models/TravelPlan.js';
import { TravelTemplateModel, } from '../models/TravelTemplate.js';
export const travelRepository = {
    async findTemplateByType(tripType) {
        return TravelTemplateModel.findOne({ tripType }).exec();
    },
    async listTemplates() {
        return TravelTemplateModel.find().sort({ tripType: 1 }).exec();
    },
    async createPlan(data) {
        return TravelPlanModel.create(data);
    },
    async listPlansForPet(ownerId, petId, upcomingOnly, now, limit) {
        const filter = { ownerId, petId };
        if (upcomingOnly) {
            // Include trips whose departure is in the future OR whose return is in
            // the future (a currently-in-progress trip counts as upcoming).
            filter.$or = [
                { departureDate: { $gte: now } },
                { returnDate: { $gte: now } },
            ];
        }
        return TravelPlanModel.find(filter)
            .sort({ departureDate: -1 })
            .limit(limit)
            .exec();
    },
    async findPlanByIdForOwnerAndPet(planId, ownerId, petId) {
        if (!Types.ObjectId.isValid(planId))
            return null;
        return TravelPlanModel.findOne({ _id: planId, ownerId, petId }).exec();
    },
    /**
     * Get the next upcoming trip for a pet (for the dashboard).
     * Returns the trip with the earliest departureDate >= now, or null.
     */
    async findNextUpcoming(ownerId, petId, now) {
        return TravelPlanModel.findOne({
            ownerId,
            petId,
            departureDate: { $gte: now },
        })
            .sort({ departureDate: 1 })
            .exec();
    },
    async updatePlan(planId, ownerId, data) {
        return TravelPlanModel.findOneAndUpdate({ _id: planId, ownerId }, { $set: data }, { new: true, runValidators: true }).exec();
    },
    async softDeletePlan(planId, ownerId) {
        await TravelPlanModel.updateOne({ _id: planId, ownerId }, { $set: { deletedAt: new Date() } }).exec();
    },
    /**
     * Add a checklist item.
     */
    async addChecklistItem(planId, ownerId, item) {
        return TravelPlanModel.findOneAndUpdate({ _id: planId, ownerId }, {
            $push: {
                checklist: {
                    label: item.label,
                    description: item.description,
                    completed: false,
                    completedAt: null,
                    order: item.order,
                    sourceTemplateItemId: null,
                },
            },
        }, { new: true }).exec();
    },
    /**
     * Update a checklist item using the positional $ operator.
     * `checklist.$` refers to the matched array element.
     */
    async updateChecklistItem(planId, ownerId, itemId, updates) {
        return TravelPlanModel.findOneAndUpdate({ _id: planId, ownerId, 'checklist._id': itemId }, {
            $set: Object.fromEntries(Object.entries(updates).map(([k, v]) => [`checklist.$.${k}`, v])),
        }, { new: true }).exec();
    },
    async deleteChecklistItem(planId, ownerId, itemId) {
        return TravelPlanModel.findOneAndUpdate({ _id: planId, ownerId }, { $pull: { checklist: { _id: itemId } } }, { new: true }).exec();
    },
};
//# sourceMappingURL=travelRepository.js.map