import { Types } from 'mongoose';
import {
  TravelPlanModel,
  type TravelPlanDocument,
} from '../models/TravelPlan.js';
import {
  TravelTemplateModel,
  type TravelTemplateDocument,
  type TripType,
} from '../models/TravelTemplate.js';

export interface CreateTravelPlanData {
  createdBy: Types.ObjectId;
  petId: Types.ObjectId;
  name: string;
  tripType: TripType;
  destination: string | null;
  departureDate: Date;
  returnDate: Date | null;
  notes: string | null;
  checklist: {
    label: string;
    description: string | null;
    completed: boolean;
    completedAt: Date | null;
    order: number;
    sourceTemplateItemId: Types.ObjectId | null;
  }[];
}

export interface UpdateTravelPlanData {
  name?: string;
  tripType?: TripType;
  destination?: string | null;
  departureDate?: Date;
  returnDate?: Date | null;
  notes?: string | null;
}

export const travelRepository = {
  async findTemplateByType(tripType: TripType): Promise<TravelTemplateDocument | null> {
    return TravelTemplateModel.findOne({ tripType }).exec();
  },

  async listTemplates(): Promise<TravelTemplateDocument[]> {
    return TravelTemplateModel.find().sort({ tripType: 1 }).exec();
  },

  async createPlan(data: CreateTravelPlanData): Promise<TravelPlanDocument> {
    return TravelPlanModel.create(data);
  },

  async listPlansForPet(
    petId: Types.ObjectId,
    upcomingOnly: boolean,
    now: Date,
    limit: number,
  ): Promise<TravelPlanDocument[]> {
    const filter: Record<string, unknown> = { petId };
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

  async findPlanByIdAndPet(
    planId: string | Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<TravelPlanDocument | null> {
    if (!Types.ObjectId.isValid(planId)) return null;
    return TravelPlanModel.findOne({ _id: planId, petId }).exec();
  },

  /**
   * Get the next upcoming trip for a pet (for the dashboard).
   * Returns the trip with the earliest departureDate >= now, or null.
   */
  async findNextUpcoming(
    petId: Types.ObjectId,
    now: Date,
  ): Promise<TravelPlanDocument | null> {
    return TravelPlanModel.findOne({
      petId,
      departureDate: { $gte: now },
    })
      .sort({ departureDate: 1 })
      .exec();
  },

  async updatePlan(
    planId: Types.ObjectId,
    petId: Types.ObjectId,
    data: UpdateTravelPlanData,
  ): Promise<TravelPlanDocument | null> {
    return TravelPlanModel.findOneAndUpdate(
      { _id: planId, petId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).exec();
  },

  async softDeletePlan(
    planId: Types.ObjectId,
    petId: Types.ObjectId,
  ): Promise<void> {
    await TravelPlanModel.updateOne(
      { _id: planId, petId },
      { $set: { deletedAt: new Date() } },
    ).exec();
  },

  /**
   * Add a checklist item.
   */
  async addChecklistItem(
    planId: Types.ObjectId,
    petId: Types.ObjectId,
    item: {
      label: string;
      description: string | null;
      order: number;
    },
  ): Promise<TravelPlanDocument | null> {
    return TravelPlanModel.findOneAndUpdate(
      { _id: planId, petId },
      {
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
      },
      { returnDocument: 'after' },
    ).exec();
  },

  /**
   * Update a checklist item using the positional $ operator.
   * `checklist.$` refers to the matched array element.
   */
  async updateChecklistItem(
    planId: Types.ObjectId,
    petId: Types.ObjectId,
    itemId: Types.ObjectId,
    updates: Record<string, unknown>,
  ): Promise<TravelPlanDocument | null> {
    return TravelPlanModel.findOneAndUpdate(
      { _id: planId, petId, 'checklist._id': itemId },
      {
        $set: Object.fromEntries(
          Object.entries(updates).map(([k, v]) => [`checklist.$.${k}`, v]),
        ),
      },
      { returnDocument: 'after' },
    ).exec();
  },

  async deleteChecklistItem(
    planId: Types.ObjectId,
    petId: Types.ObjectId,
    itemId: Types.ObjectId,
  ): Promise<TravelPlanDocument | null> {
    return TravelPlanModel.findOneAndUpdate(
      { _id: planId, petId },
      { $pull: { checklist: { _id: itemId } } },
      { returnDocument: 'after' },
    ).exec();
  },
};