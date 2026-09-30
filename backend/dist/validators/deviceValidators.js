import { z } from 'zod';
/**
 * Validators for device registration.
 *
 * The push token format is enforced as a string with a length cap. We don't
 * regex against the exact Expo format because that format has changed
 * historically (ExponentPushToken vs ExpoPushToken) and may change again.
 * The `expo-server-sdk` will reject malformed tokens at send time; we just
 * need to prevent obviously bad input from reaching the DB.
 */
export const registerDeviceSchema = z
    .object({
    pushToken: z
        .string()
        .trim()
        .min(1, 'pushToken is required')
        .max(200, 'pushToken is too long'),
    platform: z.enum(['ios', 'android', 'web']),
    deviceModel: z
        .string()
        .trim()
        .max(100)
        .optional()
        .nullable(),
    appVersion: z
        .string()
        .trim()
        .max(50)
        .optional()
        .nullable(),
})
    .strict();
export const unregisterDeviceSchema = z
    .object({
    pushToken: z.string().trim().min(1, 'pushToken is required').max(200),
})
    .strict();
//# sourceMappingURL=deviceValidators.js.map