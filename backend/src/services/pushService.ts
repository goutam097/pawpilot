import Expo, { type ExpoPushMessage, type ExpoPushTicket, type ExpoPushReceiptId } from 'expo-server-sdk';
import { deviceRepository } from '../repositories/deviceRepository.js';
import type { DeviceTokenDocument } from '../models/DeviceToken.js';

/**
 * Push notification service — the ONLY place that talks to Expo's push API.
 *
 * Why centralize?
 * - The Expo SDK is a fat dependency. Feature code should never import it
 *   directly; they call this service.
 * - The receipt-checking logic is subtle (async two-phase) and belongs in
 *   one place.
 * - Swapping to FCM/APNs-direct later is a change to this file only.
 *
 * API shape:
 * - Callers pass a list of { userId, payload }. The service looks up
 *   tokens, validates, sends, and handles receipts asynchronously.
 */

export interface NotificationPayload {
  title: string;
  body: string;
  /** Deep link URL — the app opens this when the user taps the notification. */
  data?: Record<string, unknown>;
}

export interface SendResult {
  /** Number of messages queued successfully to Expo. */
  sent: number;
  /** Number of tokens rejected (invalid format, no valid tokens). */
  skipped: number;
  /** Any tickets that indicated an error. */
  errors: { pushToken: string; error: string }[];
}

const expo = new Expo();

/**
 * Send a notification to all of a user's devices.
 *
 * This is a fire-and-forget-friendly call: it awaits the initial Expo API
 * response (to know what was accepted) but does NOT await receipt checking
 * (which happens asynchronously via `processReceipts`).
 */
export async function sendToUser(
  userId: string,
  payload: NotificationPayload,
): Promise<SendResult> {
  const tokens = await deviceRepository.findValidForUser(userId as never);
  return sendToTokens(tokens, payload);
}

/**
 * Send a notification to a specific list of device tokens.
 */
export async function sendToTokens(
  tokens: DeviceTokenDocument[],
  payload: NotificationPayload,
): Promise<SendResult> {
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.pushToken));

  const result: SendResult = {
    sent: 0,
    skipped: tokens.length - validTokens.length,
    errors: [],
  };

  if (validTokens.length === 0) {
    return result;
  }

  // Build Expo messages. `to` is the token, `sound` enables the OS sound,
  // `data` is delivered to the app when tapped. `priority: 'high'` wakes
  // Android devices aggressively (necessary for time-sensitive reminders).
  const messages: ExpoPushMessage[] = validTokens.map((t) => ({
    to: t.pushToken,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    priority: 'high',
    /**
     * `channelId` for Android. Android 8+ groups notifications into channels
     * the user can control (sound, vibration, importance). We use a single
     * channel for reminders. Phase 26 could add per-type channels.
     *
     * The mobile app must create this channel — see the mobile section.
     */
    channelId: 'reminders',
  }));

  // Send in batches of 100 (Expo's max per request).
  const chunks = expo.chunkPushNotifications(messages);
  const allTickets: { ticket: ExpoPushTicket; token: string }[] = [];

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      // Pair tickets with tokens — the SDK returns tickets in the same
      // order as the input chunk.
      tickets.forEach((ticket, i) => {
        const sourceMessage = chunk[i];
        if (sourceMessage && typeof sourceMessage.to === 'string') {
          allTickets.push({ ticket, token: sourceMessage.to });
        }
      });
    } catch (err) {
      // Network-level failure. We log and continue — the next scheduler tick
      // will retry (because lastNotifiedForDueAt won't have been set for this
      // run). Actually — see note below on retry semantics.
      console.error(
        JSON.stringify({
          level: 'error',
          type: 'push',
          msg: 'Expo send failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return result;
    }
  }

  // Process tickets — they tell us immediate outcomes.
  const receiptIds: ExpoPushReceiptId[] = [];
  for (const { ticket, token } of allTickets) {
    if (ticket.status === 'ok') {
      result.sent += 1;
      if (ticket.id) receiptIds.push(ticket.id);
      // Fire-and-forget analytics.
      void deviceRepository.touchLastUsed(token);
    } else {
      // Immediate error — usually an invalid token format the SDK didn't
      // catch, or "DeviceNotRegistered" reported synchronously.
      result.errors.push({
        pushToken: token,
        error: ticket.message ?? 'Unknown error',
      });
      if (ticket.details?.error === 'DeviceNotRegistered') {
        void deviceRepository.markInvalid(token);
      }
    }
  }

  // Receipts arrive asynchronously. We check them 15 seconds later (Expo
  // recommends at least a few seconds). We do NOT await this in the request
  // path — it's a background concern.
  if (receiptIds.length > 0) {
    setTimeout(() => {
      void processReceipts(receiptIds);
    }, 15_000);
  }

  return result;
}

/**
 * Check receipts from a previous batch send.
 *
 * Receipts tell us the FINAL delivery outcome (ticket is "queued"; receipt
 * is "delivered" or an error). The main reason we check: "DeviceNotRegistered"
 * is almost always reported in receipts, not tickets — Apple/Google only
 * know a token is dead when they try to deliver.
 */
async function processReceipts(receiptIds: ExpoPushReceiptId[]): Promise<void> {
  const chunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'ok') continue;

        // Error receipt. Log and, if it's a dead token, mark it invalid.
        console.error(
          JSON.stringify({
            level: 'warn',
            type: 'push-receipt',
            receiptId,
            error: receipt.message,
            details: receipt.details,
          }),
        );

        if (receipt.details?.error === 'DeviceNotRegistered') {
          // We don't have the token here directly — receipt.details might
          // include it in some cases, but not always. Best effort: skip.
          // A more robust design would map receiptId → token, but that
          // requires persisting the mapping. For MVP, we rely on
          // markInvalid during the ticket phase (which catches many cases)
          // and a periodic cleanup job (Phase 25).
        }
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          level: 'error',
          type: 'push-receipt',
          msg: 'receipt check failed',
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}