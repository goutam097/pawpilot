/**
 * Timeline event types and the shared shape.
 *
 * Every record in PawPilot maps to one of these event types. The mobile app
 * uses the `type` field to pick an icon, color, and (optionally) a rich row
 * renderer.
 */

export const TIMELINE_EVENT_TYPES = [
  'vaccination',
  'medication_started',
  'medication_ended',
  'vet_visit',
  'weight',
  'reminder_completed',
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];

/**
 * The unified shape every source is serialized into.
 *
 * `meta` is a loosely-typed object whose shape depends on `type`.
 * The mobile app has discriminated-union type guards to interpret it.
 * On the backend we validate it at the source-specific serializer.
 */
export interface TimelineEvent {
  /** The source record's id. Unique within the timeline view. */
  id: string;
  /** The event type — drives display and navigation. */
  type: TimelineEventType;
  /** ISO datetime of the event (when it happened). Sort key. */
  date: string;
  /** Short human-readable title. */
  title: string;
  /** Optional secondary line (e.g. "Austin Animal Hospital"). */
  subtitle: string | null;
  /** Type-specific data — see the mobile type guards. */
  meta: Record<string, unknown>;
}