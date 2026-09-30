import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
/**
 * Notification service — the ONLY place we touch expo-notifications.
 *
 * Responsibilities:
 * 1. Configure the foreground notification handler.
 * 2. Create the Android notification channel.
 * 3. Request permission and get the Expo push token.
 * 4. Return the token + platform for registration with our backend.
 *
 * Not responsible for: talking to our backend (that's the auth/devices hook).
 */
/**
 * Called once at app start. Controls how notifications are presented while
 * the app is in the foreground.
 *
 * Why `shouldShowBanner: true` in foreground?
 *   Without this, iOS silently drops notifications when the app is
 *   foregrounded — surprising users who set a reminder and expect a banner.
 *   Android's behavior is similar. We want consistency: notification arrives,
 *   banner shows, regardless of app state.
 */
export function configureNotificationHandler() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}
/**
 * Create the Android notification channel.
 *
 * Android 8+ requires every notification to belong to a channel, and the
 * channel's properties (importance, sound, vibration) control the user
 * experience. Our backend sends notifications with `channelId: 'reminders'`,
 * so this channel MUST exist before the first notification arrives.
 *
 * Idempotent: calling it multiple times is safe — the OS ignores repeat
 * creations with the same ID.
 */
export async function setupAndroidChannel() {
    if (Platform.OS !== 'android')
        return;
    await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        description: 'Vaccination, medication, and appointment reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0a7ea4',
        sound: 'default',
    });
}
/**
 * Request permission and return the Expo push token.
 *
 * Called after the user logs in — not on app start. Why?
 * - On iOS especially, requesting permission before the user knows what
 *   the app does leads to denials (which are permanent in some SDK versions).
 * - After login, the user has seen the app is about PawPilot, and the
 *   prompt context is clearer.
 */
export async function getPushToken() {
    // Physical device check. Push tokens aren't available in simulators,
    // and Android emulators can be flaky.
    if (!Device.isDevice) {
        return { status: 'unsupported' };
    }
    // Platform check. Web push is a different model (service workers); we
    // don't support it in this phase.
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        return { status: 'unsupported' };
    }
    try {
        // Check current permission status first — this avoids re-prompting.
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            return { status: 'denied' };
        }
        // The project ID is required for `getExpoPushTokenAsync`. It comes from
        // the EAS project configuration (also known as `projectId`).
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ??
            Constants.easConfig?.projectId;
        if (!projectId) {
            return {
                status: 'error',
                message: 'Missing EAS projectId. Run `eas init` or configure in app.json.',
            };
        }
        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        return {
            status: 'granted',
            pushToken: tokenResponse.data,
            platform: Platform.OS,
            deviceModel: Device.modelName ?? null,
        };
    }
    catch (err) {
        return {
            status: 'error',
            message: err instanceof Error ? err.message : String(err),
        };
    }
}
/**
 * Extract the deep-link URL from a notification's data payload.
 * Returns null if the payload doesn't have one (defensive).
 */
export function extractDeepLink(data) {
    if (typeof data !== 'object' || data === null)
        return null;
    const url = data.url;
    return typeof url === 'string' ? url : null;
}
//# sourceMappingURL=notifications.js.map