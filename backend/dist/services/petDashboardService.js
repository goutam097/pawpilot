import { Types } from "mongoose";
import { petRepository } from "../repositories/petRepository.js";
import { petDashboardRepository } from "../repositories/petDashboardRepository.js";
import { reminderRepository } from "../repositories/reminderRepository.js";
import { medicationRepository } from '../repositories/medicationRepository.js';
import { serializePet } from "./petService.js";
import { AppError } from "../utils/AppError.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { ERROR_CODES } from "../constants/errorCodes.js";
import { vaccinationRepository } from '../repositories/vaccinationRepository.js';
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
function toObjectId(id) {
    return new Types.ObjectId(id);
}
function buildWeightSection(petWeight, petWeightUnit, latest, previous) {
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
function reminderToUpcomingEvent(reminder, now) {
    const dueAt = reminder.dueAt;
    return {
        id: reminder._id.toString(),
        type: reminder.type,
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
function buildUpcomingSection(reminders, now) {
    const horizon = now.getTime() + MAX_UPCOMING_DAYS_AHEAD * 86_400_000;
    return reminders
        .filter((r) => {
        const t = r.dueAt.getTime();
        // Overdue (past) OR within the horizon.
        return t < now.getTime() || t <= horizon;
    })
        .slice(0, UPCOMING_LIMIT)
        .map((r) => reminderToUpcomingEvent(r, now));
}
/**
 * Build the health section from vaccination data.
 *
 * `activeMedications` stays 0 until Phase 12.
 */
function buildHealthSection(latestVaccination, nextDueVaccination, activeMedications) {
    return {
        lastVaccinationAt: latestVaccination ? latestVaccination.givenAt.toISOString() : null,
        nextVaccinationDueAt: nextDueVaccination?.nextDueAt?.toISOString() ?? null,
        activeMedications,
    };
}
function buildStatsSection(remindersDueThisWeek) {
    return {
        remindersDueThisWeek,
        expensesThisMonthCents: null, // Phase 16
    };
}
export const petDashboardService = {
    async getDashboard(userId, petId) {
        const ownerId = toObjectId(userId);
        // 1. Verify pet ownership. If the pet doesn't exist or isn't ours → 404.
        //    This is the ONLY pet ownership check we do; downstream queries use
        //    the confirmed ownerId + petId without re-verifying.
        const pet = await petRepository.findByIdForOwner(petId, ownerId);
        if (!pet) {
            throw new AppError("Pet not found", HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
        }
        const petObjectId = toObjectId(petId);
        const now = new Date();
        // 2. Fetch everything the dashboard needs in parallel.
        //    Each repository call is scoped by ownerId + petId — no cross-user
        //    leakage possible.
        const [weights, upcomingReminders, remindersDueThisWeek, latestVaccination, nextDueVaccination, activeMedications,] = await Promise.all([
            petDashboardRepository.latestWeightRecords(ownerId, petObjectId, 2),
            reminderRepository.listUpcomingForPet(ownerId, petObjectId, UPCOMING_LIMIT + 5),
            reminderRepository.countDueWithinWeek(ownerId, petObjectId, now),
            vaccinationRepository.latestForPet(ownerId, petObjectId),
            vaccinationRepository.nextDueForPet(ownerId, petObjectId, now),
            medicationRepository.countActiveForPet(ownerId, petObjectId, now),
        ]);
        const [latest, previous] = weights;
        const weightSection = buildWeightSection(pet.weight ?? null, pet.weightUnit ?? 'kg', latest
            ? { weight: latest.weight, unit: latest.unit, recordedAt: latest.recordedAt }
            : null, previous ? { weight: previous.weight } : null);
        const upcoming = buildUpcomingSection(upcomingReminders, now);
        const stats = buildStatsSection(remindersDueThisWeek);
        const health = buildHealthSection(latestVaccination ? { givenAt: latestVaccination.givenAt } : null, nextDueVaccination ? { nextDueAt: nextDueVaccination.nextDueAt } : null, activeMedications);
        return {
            pet: serializePet(pet),
            weight: weightSection,
            upcoming,
            health,
            stats,
            generatedAt: now.toISOString(),
        };
    },
};
//# sourceMappingURL=petDashboardService.js.map