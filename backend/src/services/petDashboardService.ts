import { petDashboardRepository } from "../repositories/petDashboardRepository.js";
import { reminderRepository } from "../repositories/reminderRepository.js";
import { medicationRepository } from "../repositories/medicationRepository.js";
import { serializePet } from "./petService.js";
import { vaccinationRepository } from "../repositories/vaccinationRepository.js";
import { vetVisitRepository } from "../repositories/vetVisitRepository.js";
import type {
  PetDashboard,
  DashboardWeight,
  UpcomingEvent,
  UpcomingEventType,
} from "../types/petDashboard.js";
import type { ReminderDocument } from "../models/Reminder.js";
import type { VetVisitDocument } from "../models/VetVisit.js";
import type { TravelPlanDocument } from "../models/TravelPlan.js";
import type { LostPetReportDocument } from "../models/LostPetReport.js";
import { require as requirePermission } from "./petPermissionsService.js";
import { travelRepository } from "../repositories/travelRepository.js";
import { lostPetRepository } from "../repositories/lostPetRepository.js";
import { expenseRepository } from "../repositories/expenseRepository.js";

/**
 * Pet dashboard service.
 *
 * Builds one aggregated view for a pet. Every section that isn't `pet` and
 * `weight` currently returns placeholder data (for phases we haven't built
 * yet) or real data (for reminders, which we just built).
 *
 * The sections are computed by dedicated functions and composed in
 * `getDashboard`. Adding a new section (e.g. vaccinations in Phase 11) is a
 * matter of adding one function and one line here.
 */

const UPCOMING_LIMIT = 5;
const MAX_UPCOMING_DAYS_AHEAD = 90;

function buildWeightSection(
  petWeight: number | null,
  petWeightUnit: "kg" | "lb",
  latest: { weight: number; unit: "kg" | "lb"; recordedAt: Date } | null,
  previous: { weight: number } | null,
): DashboardWeight {
  if (latest) {
    const change = previous
      ? Math.round((latest.weight - previous.weight) * 100) / 100
      : null;
    return {
      current: latest.weight,
      unit: latest.unit,
      previous: previous?.weight ?? null,
      change,
      recordedAt: latest.recordedAt.toISOString(),
    };
  }

  if (petWeight != null) {
    return {
      current: petWeight,
      unit: petWeightUnit,
      previous: null,
      change: null,
      recordedAt: null,
    };
  }

  return {
    current: null,
    unit: petWeightUnit,
    previous: null,
    change: null,
    recordedAt: null,
  };
}

/**
 * Convert a reminder document into an UpcomingEvent.
 *
 * The type mapping is straightforward for now — reminder.type is one of
 * vaccination/medication/vet_visit/grooming/feeding/custom, all of which
 * exist in UpcomingEventType.
 */
function reminderToUpcomingEvent(
  reminder: ReminderDocument,
  now: Date,
): UpcomingEvent {
  const dueAt = reminder.dueAt;
  return {
    id: reminder._id.toString(),
    type: reminder.type as UpcomingEventType,
    title: reminder.title,
    dueAt: dueAt.toISOString(),
    overdue: dueAt.getTime() < now.getTime(),
  };
}

/**
 * Build the upcoming section from reminders.
 *
 * Filtering policy:
 * - Limit to reminders due within `MAX_UPCOMING_DAYS_AHEAD` days OR overdue.
 *   A reminder due in 400 days is not useful on the dashboard.
 * - Cap at UPCOMING_LIMIT items.
 * - Sort by due date ascending (most urgent first).
 */
/* function buildUpcomingSection(
  reminders: ReminderDocument[],
  now: Date,
): UpcomingEvent[] {
  const horizon = now.getTime() + MAX_UPCOMING_DAYS_AHEAD * 86_400_000;

  return reminders
    .filter((r) => {
      const t = r.dueAt.getTime();
      // Overdue (past) OR within the horizon.
      return t < now.getTime() || t <= horizon;
    })
    .slice(0, UPCOMING_LIMIT)
    .map((r) => reminderToUpcomingEvent(r, now));
} */

/**
 * Build the `upcoming` array from reminders + future vet visits.
 *
 * Both sources are converted to the unified `UpcomingEvent` shape, merged,
 * sorted by dueAt ascending, and capped at UPCOMING_LIMIT.
 */
function buildUpcomingSection(
  reminders: ReminderDocument[],
  vetVisits: VetVisitDocument[],
  now: Date,
): UpcomingEvent[] {
  const horizon = now.getTime() + MAX_UPCOMING_DAYS_AHEAD * 86_400_000;

  const events: UpcomingEvent[] = [];

  for (const r of reminders) {
    const t = r.dueAt.getTime();
    if (t < now.getTime() || t <= horizon) {
      events.push(reminderToUpcomingEvent(r, now));
    }
  }

  for (const v of vetVisits) {
    // Vet visits are already filtered to scheduled + future by the repository.
    const t = v.visitDate.getTime();
    if (t <= horizon) {
      events.push(vetVisitToUpcomingEvent(v));
    }
  }

  events.sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
  );

  return events.slice(0, UPCOMING_LIMIT);
}

function vetVisitToUpcomingEvent(v: VetVisitDocument): UpcomingEvent {
  const parts: string[] = [];
  if (v.clinicName) parts.push(v.clinicName);
  else if (v.vetName) parts.push(`Dr. ${v.vetName}`);

  const title =
    parts.length > 0 ? `Vet visit - ${parts.join(" ")}` : "Vet visit";

  return {
    id: v._id.toString(),
    type: "vet_visit",
    title,
    dueAt: v.visitDate.toISOString(),
    overdue: false, // Scheduled future visits are never "overdue" by design.
  };
}

/**
 * Build the health section from vaccination data.
 *
 * `activeMedications` stays 0 until Phase 12.
 */
function buildHealthSection(
  latestVaccination: { givenAt: Date } | null,
  nextDueVaccination: { nextDueAt: Date | null } | null,
  activeMedications: number,
): PetDashboard["health"] {
  return {
    lastVaccinationAt: latestVaccination
      ? latestVaccination.givenAt.toISOString()
      : null,
    nextVaccinationDueAt: nextDueVaccination?.nextDueAt?.toISOString() ?? null,
    activeMedications,
  };
}

function buildTripSection(
  trip: TravelPlanDocument | null,
  now: Date,
): PetDashboard["nextTrip"] {
  if (!trip) return null;

  const daysUntil = Math.ceil(
    (trip.departureDate.getTime() - now.getTime()) / 86_400_000,
  );
  const completedCount = trip.checklist.filter((i) => i.completed).length;

  return {
    id: trip._id.toString(),
    name: trip.name,
    destination: trip.destination ?? null,
    departureDate: trip.departureDate.toISOString(),
    daysUntilDeparture: daysUntil,
    checklistProgress: {
      completed: completedCount,
      total: trip.checklist.length,
    },
  };
}

function buildLostReportSection(
  report: LostPetReportDocument,
  now: Date,
): PetDashboard["lostReport"] {
  const daysLost = Math.max(
    0,
    Math.floor((now.getTime() - report.lastSeenAt.getTime()) / 86_400_000),
  );

  return {
    id: report._id.toString(),
    shareToken: report.shareToken,
    shareUrl: `${process.env.PUBLIC_APP_URL ?? "https://pawpilot.app"}/lost/${report.shareToken}`,
    lastSeenAt: report.lastSeenAt.toISOString(),
    lastSeenLocation: report.lastSeenLocation,
    daysLost,
    foundAt: report.foundAt ? report.foundAt.toISOString() : null,
  };
}

function buildStatsSection(
  remindersDueThisWeek: number,
  expensesThisMonthCents: number,
): PetDashboard["stats"] {
  return {
    remindersDueThisWeek,
    expensesThisMonthCents,
  };
}

export const petDashboardService = {
  async getDashboard(userId: string, petId: string): Promise<PetDashboard> {
    const access = await requirePermission(userId, petId, "records:read");
    const { pet, role } = access;
    const petObjectId = pet._id;
    const now = new Date();

    // 2. Fetch everything the dashboard needs in parallel.
    //    Each repository call is scoped by ownerId + petId — no cross-user
    //    leakage possible.
    /* const [
      weights,
      upcomingReminders,
      remindersDueThisWeek,
      latestVaccination,
      nextDueVaccination,
      activeMedications,
      upcomingVetVisits,
      expensesThisMonthCents,
    ] = await Promise.all([
      petDashboardRepository.latestWeightRecords(petObjectId, 2),
      reminderRepository.listUpcomingForPet(
        ownerId,
        petObjectId,
        UPCOMING_LIMIT + 5,
      ),
      reminderRepository.countDueWithinWeek(ownerId, petObjectId, now),
      vaccinationRepository.latestForPet(ownerId, petObjectId),
      vaccinationRepository.nextDueForPet(ownerId, petObjectId, now),
      medicationRepository.countActiveForPet(ownerId, petObjectId, now),
      vetVisitRepository.listUpcomingScheduled(ownerId, petObjectId, now, UPCOMING_LIMIT),
    ]); */
    const [
      weights,
      upcomingReminders,
      remindersDueThisWeek,
      latestVaccination,
      nextDueVaccination,
      activeMedications,
      upcomingVetVisits,
      expensesThisMonthCents,
    ] = await Promise.all([
      petDashboardRepository.latestWeightRecords(petObjectId, 2),
      reminderRepository.listUpcomingForPet(
        petObjectId,
        now,
        UPCOMING_LIMIT + 5,
      ),
      reminderRepository.countDueWithinWeek(petObjectId, now),
      vaccinationRepository.latestForPet(petObjectId),
      vaccinationRepository.nextDueForPet(petObjectId, now),
      medicationRepository.countActiveForPet(petObjectId, now),
      vetVisitRepository.listUpcomingScheduled(
        petObjectId,
        now,
        UPCOMING_LIMIT,
      ),
      expenseRepository.sumInRange(
        petObjectId,
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
      ),
    ]);

    const [latest, previous] = weights;
    const weightSection = buildWeightSection(
      pet.weight ?? null,
      pet.weightUnit ?? "kg",
      latest
        ? {
            weight: latest.weight,
            unit: latest.unit,
            recordedAt: latest.recordedAt,
          }
        : null,
      previous ? { weight: previous.weight } : null,
    );
    const upcoming = buildUpcomingSection(upcomingReminders, upcomingVetVisits, now);
    const stats = buildStatsSection(remindersDueThisWeek, expensesThisMonthCents);
    const health = buildHealthSection(
      latestVaccination ? { givenAt: latestVaccination.givenAt } : null,
      nextDueVaccination ? { nextDueAt: nextDueVaccination.nextDueAt } : null,
      activeMedications,
    );
    const nextTripDoc = await travelRepository.findNextUpcoming(
      petObjectId,
      now,
    );

    const lostReportDoc = await lostPetRepository.findActiveForPet(petObjectId);

    return {
      pet: serializePet(pet, role),
      weight: weightSection,
      upcoming,
      health,
      stats,
      generatedAt: now.toISOString(),
      nextTrip: buildTripSection(nextTripDoc, now),
      lostReport: lostReportDoc
        ? buildLostReportSection(lostReportDoc, now)
        : null,
    };
  },
};
