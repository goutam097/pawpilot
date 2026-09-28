import { Types } from 'mongoose';
import { petRepository } from '../repositories/petRepository.js';
import { petDashboardRepository } from '../repositories/petDashboardRepository.js';
import { serializePet } from './petService.js';
import { AppError } from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
/**
 * Pet dashboard service.
 *
 * Builds one aggregated view for a pet. Everything the dashboard shows comes
 * from this function — no client-side data fetching for individual sections.
 *
 * Structure: each section is computed by a dedicated private function, and
 * `build()` composes them. This makes adding a section (e.g. `health` in
 * Phase 11) a one-function addition, not a rewrite.
 *
 * Data ownership: every repository call scoped by `ownerId`. The `getDashboard`
 * service function never touches Mongo directly.
 */
function toObjectId(id) {
    return new Types.ObjectId(id);
}
/**
 * Build the `weight` section.
 *
 * Reads the two most recent weight records (if any) and computes change.
 * The pet's `weight` field is our fallback when there are no records yet —
 * a user who set a weight at pet creation sees it on the dashboard, even
 * before they've logged a formal weight record.
 */
function buildWeightSection(petWeight, petWeightUnit, latest, previous) {
    // Prefer the latest weight record; fall back to the pet's stored weight.
    // This gives a coherent story: "pet's current weight" is the same number
    // whether you look at the pet detail or the dashboard.
    if (latest) {
        const change = previous ? Math.round((latest.weight - previous.weight) * 100) / 100 : null;
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
 * Placeholder upcoming events. Phase 9 populates this from the Reminder
 * collection; Phase 11 from Vaccination; Phase 12 from Medication.
 *
 * Returning `[]` now keeps the response shape stable.
 */
async function buildUpcomingSection() {
    return [];
}
/**
 * Placeholder health section. Phase 11 (vaccinations) and Phase 12
 * (medications) fill this in.
 */
function buildHealthSection() {
    return {
        lastVaccinationAt: null,
        nextVaccinationDueAt: null,
        activeMedications: 0,
    };
}
/**
 * Placeholder stats. Phase 9 (reminders), Phase 16 (expenses).
 */
function buildStatsSection() {
    return {
        remindersDueThisWeek: 0,
        expensesThisMonthCents: null,
    };
}
export const petDashboardService = {
    async getDashboard(userId, petId) {
        // First, verify the pet exists AND belongs to the user. This single
        // call is our authorization check. If it returns null, we throw 404
        // (never 403 — see Phase 7's reasoning on not leaking existence).
        const ownerId = toObjectId(userId);
        const pet = await petRepository.findByIdForOwner(petId, ownerId);
        if (!pet) {
            throw new AppError('Pet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.PET_NOT_FOUND);
        }
        const petWeightValue = typeof pet.weight === 'number' ? pet.weight : null;
        const petWeightUnit = pet.weightUnit === 'kg' || pet.weightUnit === 'lb' ? pet.weightUnit : 'kg';
        // Fetch the two most recent weight records in one query.
        // If the pet has fewer than 2, we get what exists.
        const petObjectId = toObjectId(petId);
        const weights = await petDashboardRepository.latestWeightRecords(ownerId, petObjectId, 2);
        const [latest, prev] = weights;
        const latestWeight = latest && typeof latest.weight === 'number' && (latest.unit === 'kg' || latest.unit === 'lb')
            ? { weight: latest.weight, unit: latest.unit, recordedAt: latest.recordedAt }
            : null;
        const previousWeight = prev && typeof prev.weight === 'number' ? { weight: prev.weight } : null;
        // Build sections. Each is independent; failures here don't take down
        // the others (though for now they can't fail).
        const weightSection = buildWeightSection(petWeightValue, petWeightUnit, latestWeight, previousWeight);
        const upcoming = await buildUpcomingSection();
        const health = buildHealthSection();
        const stats = buildStatsSection();
        return {
            pet: serializePet(pet),
            weight: weightSection,
            upcoming,
            health,
            stats,
            generatedAt: new Date().toISOString(),
        };
    },
};
//# sourceMappingURL=petDashboardService.js.map