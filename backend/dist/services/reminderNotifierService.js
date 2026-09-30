import { ReminderModel } from '../models/Reminder.js';
import { deviceRepository } from '../repositories/deviceRepository.js';
import { sendToTokens } from './pushService.js';
/**
 * Reminder notifier — the polling loop that dispatches push notifications
 * for due reminders.
 *
 * Runs on a timer (default 60s). Each tick:
 *   1. Query reminders whose `notifyAt <= now` and haven't been notified
 *      for the current `dueAt`.
 *   2. For each, fetch the user's valid devices, send a push, and mark the
 *      reminder as notified (if at least one send succeeded).
 *
 * Scaling notes:
 * - Single-instance: safe. The interval is the only caller.
 * - Multi-instance: this design would double-fire. Moving to a distributed
 *   job queue with locking is a Phase 25 concern.
 *
 * Failure modes:
 * - If sendToTokens throws (network error), we don't mark the reminder as
 *   notified, so it retries next tick.
 * - If sendToTokens returns 0 sent, same — retry next tick.
 * - If sendToTokens returns >0 sent, we mark notified even if some devices
 *   failed. Rationale: users prefer one notification to none, and retries
 *   would double-notify successful devices.
 */
const TICK_INTERVAL_MS = 60_000; // 1 minute
const BATCH_SIZE = 100; // Max reminders per tick
let intervalHandle = null;
let isRunning = false; // Prevent overlapping ticks if a tick takes > 60s
/**
 * Query reminders whose notification time has arrived.
 *
 * Time window: notifyAt between (now - lookback) and now.
 *
 * Why a lookback?
 *   If the server was down for a minute and restarted, we want to catch
 *   reminders that became due during the gap. A 60-second lookback (matching
 *   the tick interval) is a safe upper bound.
 *
 *   Caveat: if the server was down for an hour, we'd miss anything more than
 *   60s old. A production system would use a proper scheduled job queue and
 *   could set the lookback to the actual downtime. For MVP, we accept this
 *   — a minute of downtime at most likely means a deployment, and reminders
 *   are usually not that time-sensitive.
 */
async function findDueReminders(now) {
    return ReminderModel.find({
        completed: false,
        notificationEnabled: true,
        notifyAt: { $lte: now },
        $expr: {
            $or: [
                { $eq: ['$lastNotifiedForDueAt', null] },
                { $ne: ['$lastNotifiedForDueAt', '$dueAt'] },
            ],
        },
    })
        .select('_id ownerId petId title description dueAt')
        .limit(BATCH_SIZE)
        .lean()
        .exec();
}
/**
 * Build the notification payload for a reminder.
 *
 * Deep link: `pawpilot://pet/<petId>/reminders/<reminderId>` — the mobile
 * app's Expo Router will route this to the reminder edit screen.
 *
 * Title/body copy: short and specific. "Max's heartworm pill is due" is
 * better than "Reminder: heartworm pill" because it names the pet (which
 * matters to the owner) and uses the owner's language ("is due" vs "due now").
 */
function buildPayload(reminder) {
    const overdue = reminder.dueAt.getTime() < Date.now();
    return {
        title: overdue ? 'Overdue: ' + reminder.title : reminder.title,
        body: reminder.description ?? (overdue ? 'This reminder is overdue.' : 'Tap to view.'),
        data: {
            // Deep link — the mobile app parses this on notification tap.
            url: `pawpilot://pet/${reminder.petId.toString()}/reminders/${reminder._id.toString()}`,
            // Also include ids in case the app prefers them.
            petId: reminder.petId.toString(),
            reminderId: reminder._id.toString(),
            type: 'reminder',
        },
    };
}
/**
 * One tick of the notifier.
 *
 * Exported so tests can call it directly with a controlled `now`.
 */
export async function runNotifierTick(now = new Date()) {
    const reminders = await findDueReminders(now);
    const result = { scanned: reminders.length, notified: 0, failed: 0 };
    for (const reminder of reminders) {
        try {
            // Fetch the reminder's owner's devices. Each reminder is scoped to
            // one user, and we send to all their valid devices.
            const tokens = await deviceRepository.findValidForUser(reminder.ownerId);
            if (tokens.length === 0) {
                // No devices registered. Mark notified anyway so we don't retry
                // forever — the user can't receive it. If they register a device
                // later, future reminders will reach them.
                await ReminderModel.updateOne({ _id: reminder._id }, { $set: { lastNotifiedForDueAt: reminder.dueAt } });
                continue;
            }
            const sendResult = await sendToTokens(tokens, buildPayload(reminder));
            if (sendResult.sent > 0) {
                await ReminderModel.updateOne({ _id: reminder._id }, { $set: { lastNotifiedForDueAt: reminder.dueAt } });
                result.notified += 1;
            }
            else {
                // All sends failed. Don't mark — retry next tick.
                result.failed += 1;
            }
        }
        catch (err) {
            // Per-reminder errors shouldn't kill the whole tick.
            result.failed += 1;
            console.error(JSON.stringify({
                level: 'error',
                type: 'notifier',
                msg: 'failed to dispatch reminder',
                reminderId: reminder._id.toString(),
                error: err instanceof Error ? err.message : String(err),
            }));
        }
    }
    return result;
}
/**
 * Start the polling loop.
 *
 * Idempotent: calling twice has no effect. This guards against accidental
 * double-startup in hot-reload scenarios.
 */
export function startReminderNotifier() {
    if (intervalHandle)
        return;
    console.log(JSON.stringify({
        level: 'info',
        type: 'notifier',
        msg: 'reminder notifier started',
        intervalMs: TICK_INTERVAL_MS,
    }));
    intervalHandle = setInterval(() => {
        if (isRunning)
            return; // Skip if the previous tick hasn't finished.
        isRunning = true;
        runNotifierTick()
            .then((result) => {
            if (result.scanned > 0) {
                console.log(JSON.stringify({
                    level: 'info',
                    type: 'notifier',
                    msg: 'tick complete',
                    ...result,
                }));
            }
        })
            .catch((err) => {
            console.error(JSON.stringify({
                level: 'error',
                type: 'notifier',
                msg: 'tick threw',
                error: err instanceof Error ? err.message : String(err),
            }));
        })
            .finally(() => {
            isRunning = false;
        });
    }, TICK_INTERVAL_MS);
    // `unref()` so the interval doesn't keep the process alive on its own.
    // The HTTP server keeps us alive; when the server closes for shutdown,
    // this timer won't prevent exit.
    intervalHandle.unref();
}
export function stopReminderNotifier() {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
        console.log(JSON.stringify({ level: 'info', type: 'notifier', msg: 'reminder notifier stopped' }));
    }
}
//# sourceMappingURL=reminderNotifierService.js.map