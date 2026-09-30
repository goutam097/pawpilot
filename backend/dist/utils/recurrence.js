/**
 * Recurrence rules and next-occurrence computation.
 *
 * Design constraints we're honoring:
 *
 * 1. Rules are a tagged union. No invalid combinations (e.g. `daily` can't
 *    have a `dayOfWeek`). TypeScript enforces this at the call site.
 *
 * 2. Month arithmetic clamps to the last valid day. "Monthly on the 31st"
 *    becomes Feb 28 (or 29 in leap years), not March 3.
 *
 * 3. Year arithmetic uses 12-month arithmetic (not "add 365 days"), so
 *    leap-year handling is free and correct.
 *
 * 4. This function is PURE. No I/O, no side effects, no dependency on `now`.
 *    Callers pass `currentDueAt` explicitly. This makes it trivially
 *    unit-testable across every edge case.
 *
 * KNOWN LIMITATION — DST:
 *   We advance by fixed millisecond intervals for daily/weekly, and by
 *   calendar arithmetic for monthly/yearly. Daily/weekly do NOT respect DST
 *   transitions: a 9am daily reminder will drift by 1 hour twice a year in
 *   DST-affected timezones. Fixing this requires storing a local time and
 *   timezone per reminder, which we defer to a future phase.
 */
const MS_PER_DAY = 86_400_000;
/**
 * Return the number of days in the given month (0-indexed month).
 * Used for month-end clamping.
 */
function daysInMonth(year, monthIndex) {
    // `Date.UTC(year, monthIndex + 1, 0)` gives the last day of `monthIndex`
    // because day 0 of the next month is the last day of this month.
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}
/**
 * Add `months` calendar months to a UTC date, clamping the day-of-month to
 * the last valid day of the target month.
 *
 * Examples (all UTC):
 *   addMonths(new Date('2026-01-31'), 1) → 2026-02-28
 *   addMonths(new Date('2024-01-31'), 1) → 2024-02-29  (leap year)
 *   addMonths(new Date('2026-08-15'), 1) → 2026-09-15
 *   addMonths(new Date('2026-12-15'), 1) → 2027-01-15
 *   addMonths(new Date('2026-01-31'), 3) → 2026-04-30
 *
 * Why not `new Date(y, m + n, d)`?
 *   Native Date rolls over: Jan 31 + 1 month = March 3. That's almost never
 *   what users mean by "monthly." We want "the same day-of-month, or the
 *   last day of the month if the day doesn't exist."
 */
function addMonthsUtc(date, months) {
    const year = date.getUTCFullYear();
    const monthIndex = date.getUTCMonth();
    const day = date.getUTCDate();
    const targetMonthIndex = monthIndex + months;
    // Normalize into [0, 11] and get the corresponding year.
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
    const maxDay = daysInMonth(targetYear, normalizedMonthIndex);
    const clampedDay = Math.min(day, maxDay);
    return new Date(Date.UTC(targetYear, normalizedMonthIndex, clampedDay, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}
/**
 * Compute the next occurrence of a reminder given its current due date and
 * rule.
 *
 * Returns `null` if there is no next occurrence (rule.kind === 'none').
 *
 * The function does NOT check whether the next occurrence is in the future.
 * If `currentDueAt` is in the past and the rule is "daily," the next
 * occurrence may also be in the past. Advancing through missed occurrences
 * is a caller concern (see `advancePastNow` below).
 */
export function computeNextOccurrence(currentDueAt, rule) {
    switch (rule.kind) {
        case 'none':
            return null;
        case 'daily': {
            if (rule.interval < 1) {
                throw new Error(`daily interval must be >= 1, got ${rule.interval}`);
            }
            return new Date(currentDueAt.getTime() + rule.interval * MS_PER_DAY);
        }
        case 'weekly': {
            if (rule.interval < 1) {
                throw new Error(`weekly interval must be >= 1, got ${rule.interval}`);
            }
            return new Date(currentDueAt.getTime() + rule.interval * 7 * MS_PER_DAY);
        }
        case 'monthly': {
            if (rule.interval < 1) {
                throw new Error(`monthly interval must be >= 1, got ${rule.interval}`);
            }
            return addMonthsUtc(currentDueAt, rule.interval);
        }
        case 'yearly': {
            if (rule.interval < 1) {
                throw new Error(`yearly interval must be >= 1, got ${rule.interval}`);
            }
            return addMonthsUtc(currentDueAt, rule.interval * 12);
        }
    }
}
/**
 * Given a starting due date and a rule, advance forward (possibly multiple
 * times) until the next occurrence is strictly in the future.
 *
 * Why this matters:
 *   If a reminder's current occurrence is 3 days ago and the rule is "daily,"
 *   the next occurrence should be tomorrow — not yesterday. Without this,
 *   a user who opens the app after a week offline would see a week of
 *   overdue reminders, and completing one would only advance one day.
 *
 * Why strict (not >= now):
 *   If `dueAt === now`, we still want to advance. Otherwise a reminder at the
 *   exact current second would be "due now" forever if the user completed it
 *   within that same second.
 *
 * Safety: this loop is bounded. Every iteration increases the due date by at
 * least one day (the smallest interval), and we cap iterations at a large
 * number to catch pathological cases (e.g. a rule that produces the same date).
 */
export function advancePastNow(currentDueAt, rule, now) {
    if (rule.kind === 'none') {
        return currentDueAt.getTime() > now.getTime() ? currentDueAt : null;
    }
    // Fast path: if already in the future, no advancing needed.
    if (currentDueAt.getTime() > now.getTime()) {
        return currentDueAt;
    }
    let candidate = currentDueAt;
    const MAX_ITERATIONS = 100_000; // ~274 years of daily occurrences
    let iterations = 0;
    while (candidate.getTime() <= now.getTime()) {
        const next = computeNextOccurrence(candidate, rule);
        if (next === null)
            return null;
        candidate = next;
        iterations += 1;
        if (iterations > MAX_ITERATIONS) {
            throw new Error('advancePastNow: iteration limit exceeded — check rule');
        }
    }
    return candidate;
}
/**
 * Serialize a rule to a plain object suitable for storing in MongoDB.
 * Since our rules are already plain objects with a `kind` discriminator,
 * this is a pass-through — but having the function documents intent and
 * gives us a place to add validation or migration later.
 */
export function serializeRule(rule) {
    return rule;
}
/**
 * Parse a rule from a Mongoose document (which stores it as a nested object).
 * Returns a typed RepeatRule or throws if the shape is invalid.
 *
 * Why a parser and not a direct cast?
 *   Data from the database is untrusted from the type system's perspective.
 *   This function is the boundary where we assert the shape and reject
 *   malformed rules early.
 */
export function parseRule(raw) {
    if (typeof raw !== 'object' || raw === null) {
        throw new Error('Invalid repeat rule: not an object');
    }
    const r = raw;
    const kind = r.kind;
    switch (kind) {
        case 'none':
            return { kind: 'none' };
        case 'daily':
        case 'weekly':
        case 'monthly':
        case 'yearly': {
            const interval = r.interval;
            if (typeof interval !== 'number' || !Number.isInteger(interval) || interval < 1) {
                throw new Error(`Invalid ${kind} rule: interval must be a positive integer`);
            }
            return { kind, interval };
        }
        default:
            throw new Error(`Invalid repeat rule kind: ${String(kind)}`);
    }
}
//# sourceMappingURL=recurrence.js.map