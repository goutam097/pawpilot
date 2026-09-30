import type { Types } from 'mongoose';
import { VaccinationModel } from '../models/Vaccination.js';
import { MedicationModel } from '../models/Medication.js';
import { VetVisitModel } from '../models/VetVisit.js';
import { WeightRecordModel } from '../models/WeightRecord.js';
import { ReminderModel } from '../models/Reminder.js';
import { convertWeight, type WeightUnit } from '../utils/weightUnits.js';
import type { TimelineEvent } from '../types/timeline.js';
import { require as requirePermission } from './petPermissionsService.js';

/**
 * Timeline service.
 *
 * Fetches "the most recent N events for a pet across all sources."
 *
 * Strategy:
 * - Query all sources in parallel (Promise.all).
 * - Each source query filters `date < before` and `ORDER BY date DESC LIMIT limit`.
 * - Merge, sort by date descending, slice to `limit`.
 *
 * Why fetch `limit` from each source and not `limit / numSources`?
 *   Because we don't know the distribution. A user might have 100 weight
 *   records and 2 vaccinations. If we fetched limit/5 from each, we'd miss
 *   weight records. Fetching `limit` from each ensures the top-N is correct
 *   after merging.
 *
 * Cost: 5 parallel queries, each returning at most `limit` docs.
 * For limit=50, that's up to 250 documents fetched per request.
 * Merge cost is trivial. Query cost is dominated by index seeks.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Fetch vaccinations as timeline events.
 * Date = `givenAt`.
 */
async function fetchVaccinationEvents(
  petId: Types.ObjectId,
  before: Date,
  limit: number,
): Promise<TimelineEvent[]> {
  const docs = await VaccinationModel.find({
    petId,
    givenAt: { $lt: before },
  })
    .sort({ givenAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((v) => ({
    id: v._id.toString(),
    type: 'vaccination',
    date: v.givenAt.toISOString(),
    title: v.vaccineName,
    subtitle: v.administeredBy ?? null,
    meta: {
      nextDueAt: v.nextDueAt ? v.nextDueAt.toISOString() : null,
      lotNumber: v.lotNumber ?? null,
    },
  }));
}

/**
 * Fetch medication "started" events.
 * Date = `startDate`.
 */
async function fetchMedicationStartEvents(
  petId: Types.ObjectId,
  before: Date,
  limit: number,
): Promise<TimelineEvent[]> {
  const docs = await MedicationModel.find({
    petId,
    startDate: { $lt: before },
  })
    .sort({ startDate: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((m) => ({
    id: `${m._id.toString()}:started`,
    type: 'medication_started',
    date: m.startDate.toISOString(),
    title: `Started ${m.name}`,
    subtitle: m.dosage ?? null,
    meta: {
      medicationId: m._id.toString(),
      frequency: m.frequency,
      endDate: m.endDate ? m.endDate.toISOString() : null,
    },
  }));
}

/**
 * Fetch medication "ended" events for medications with a past `endDate`.
 */
async function fetchMedicationEndEvents(
  petId: Types.ObjectId,
  before: Date,
  limit: number,
): Promise<TimelineEvent[]> {
  const docs = await MedicationModel.find({
    petId,
    endDate: { $ne: null, $lt: before },
  })
    .sort({ endDate: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs
    .filter((m) => m.endDate != null)
    .map((m) => ({
      id: `${m._id.toString()}:ended`,
      type: 'medication_ended',
      date: m.endDate!.toISOString(),
      title: `Finished ${m.name}`,
      subtitle: null,
      meta: {
        medicationId: m._id.toString(),
      },
    }));
}

/**
 * Fetch vet visits.
 * Date = `visitDate`.
 * Only completed visits appear in the timeline — scheduled future visits
 * belong in the Upcoming card, not the history.
 */
async function fetchVetVisitEvents(
  petId: Types.ObjectId,
  before: Date,
  limit: number,
): Promise<TimelineEvent[]> {
  const docs = await VetVisitModel.find({
    petId,
    scheduled: false,
    visitDate: { $lt: before },
  })
    .sort({ visitDate: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((v) => {
    const title = v.clinicName ?? (v.vetName ? `Dr. ${v.vetName}` : 'Vet visit');
    return {
      id: v._id.toString(),
      type: 'vet_visit',
      date: v.visitDate.toISOString(),
      title,
      subtitle: v.reason ?? null,
      meta: {
        vetName: v.vetName ?? null,
        clinicName: v.clinicName ?? null,
        reason: v.reason ?? null,
        diagnosis: v.diagnosis ?? null,
        treatment: v.treatment ?? null,
        costCents: v.costCents ?? null,
      },
    };
  });
}

/**
 * Fetch weight records.
 * Date = `recordedAt`.
 * The weight is converted to the pet's current display unit.
 */
async function fetchWeightEvents(
  petId: Types.ObjectId,
  petUnit: WeightUnit,
  before: Date,
  limit: number,
): Promise<TimelineEvent[]> {
  const docs = await WeightRecordModel.find({
    petId,
    recordedAt: { $lt: before },
  })
    .sort({ recordedAt: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((w) => {
    const displayWeight = convertWeight(w.weight, w.unit as WeightUnit, petUnit);
    return {
      id: w._id.toString(),
      type: 'weight',
      date: w.recordedAt.toISOString(),
      title: `Weight: ${displayWeight.toFixed(1)} ${petUnit}`,
      subtitle: w.notes ?? null,
      meta: {
        weight: displayWeight,
        unit: petUnit,
      },
    };
  });
}

/**
 * Fetch completed reminders.
 *
 * For one-time reminders: `completedAt`.
 * For recurring reminders: `lastCompletedAt` (the most recent completion).
 *
 * The date used is the completion time, not the due time. This makes the
 * timeline reflect "when the user acted," which is more meaningful.
 */
async function fetchReminderCompletedEvents(
  petId: Types.ObjectId,
  before: Date,
  limit: number,
): Promise<TimelineEvent[]> {
  // Fetch both types and merge. We can't do a single query cleanly because
  // one-time and recurring use different fields.
  const [oneTime, recurring] = await Promise.all([
    ReminderModel.find({
      petId,
      completed: true,
      completedAt: { $ne: null, $lt: before },
    })
      .sort({ completedAt: -1 })
      .limit(limit)
      .lean()
      .exec(),
    ReminderModel.find({
      petId,
      completed: false,
      lastCompletedAt: { $ne: null, $lt: before },
    })
      .sort({ lastCompletedAt: -1 })
      .limit(limit)
      .lean()
      .exec(),
  ]);

  const events: TimelineEvent[] = [];

  for (const r of oneTime) {
    if (!r.completedAt) continue;
    events.push({
      id: r._id.toString(),
      type: 'reminder_completed',
      date: r.completedAt.toISOString(),
      title: r.title,
      subtitle: r.description ?? null,
      meta: {
        reminderType: r.type,
      },
    });
  }

  for (const r of recurring) {
    if (!r.lastCompletedAt) continue;
    events.push({
      id: r._id.toString(),
      type: 'reminder_completed',
      date: r.lastCompletedAt.toISOString(),
      title: r.title,
      subtitle: r.description ?? null,
      meta: {
        reminderType: r.type,
        isRecurring: true,
      },
    });
  }

  return events;
}

export interface TimelineParams {
  limit?: number;
  before?: Date;
}

export const timelineService = {
  async getTimeline(
    userId: string,
    petId: string,
    params: TimelineParams,
  ): Promise<{ events: TimelineEvent[]; hasMore: boolean }> {
    const access = await requirePermission(userId, petId, 'records:read');
    const pet = access.pet;
    const petObjectId = pet._id;

    const petUnit = (pet.weightUnit ?? 'kg') as WeightUnit;
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const before = params.before ?? new Date(Date.now() + 1000); // +1s to include events "right now"

    // Fetch all sources in parallel. Each returns up to `limit` events,
    // so worst case we merge 6*limit events and take the top `limit`.
    // Why 6? Medications produce two event types (started + ended).
    const [
      vaccinations,
      medicationStarts,
      medicationEnds,
      vetVisits,
      weights,
      reminderCompletions,
    ] = await Promise.all([
      fetchVaccinationEvents(petObjectId, before, limit),
      fetchMedicationStartEvents(petObjectId, before, limit),
      fetchMedicationEndEvents(petObjectId, before, limit),
      fetchVetVisitEvents(petObjectId, before, limit),
      fetchWeightEvents(petObjectId, petUnit, before, limit),
      fetchReminderCompletedEvents(petObjectId, before, limit),
    ]);

    // Merge and sort descending by date.
    const all = [
      ...vaccinations,
      ...medicationStarts,
      ...medicationEnds,
      ...vetVisits,
      ...weights,
      ...reminderCompletions,
    ];

    all.sort((a, b) => {
      const ta = new Date(a.date).getTime();
      const tb = new Date(b.date).getTime();
      if (tb !== ta) return tb - ta;
      // Tie-breaker: stable by id to avoid nondeterministic ordering across
      // identical timestamps.
      return a.id.localeCompare(b.id);
    });

    const events = all.slice(0, limit);
    // hasMore: if we found more than `limit` events total, the client can
    // request another page via `before = events[events.length - 1].date`.
    const hasMore = all.length > limit;

    return { events, hasMore };
  },
};