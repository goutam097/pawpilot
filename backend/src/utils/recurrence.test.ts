import { describe, expect, it } from 'vitest';
import { advancePastNow, computeNextOccurrence, parseRule } from './recurrence.js';

describe('recurrence date arithmetic', () => {
  it('clamps January 31 to February 28 in a non-leap year', () => {
    const next = computeNextOccurrence(
      new Date('2025-01-31T09:30:00.000Z'),
      { kind: 'monthly', interval: 1 },
    );

    expect(next?.toISOString()).toBe('2025-02-28T09:30:00.000Z');
  });

  it('clamps January 31 to February 29 in a leap year', () => {
    const next = computeNextOccurrence(
      new Date('2024-01-31T09:30:00.000Z'),
      { kind: 'monthly', interval: 1 },
    );

    expect(next?.toISOString()).toBe('2024-02-29T09:30:00.000Z');
  });

  it('clamps a yearly February 29 occurrence in a non-leap year', () => {
    const next = computeNextOccurrence(
      new Date('2024-02-29T09:30:00.000Z'),
      { kind: 'yearly', interval: 1 },
    );

    expect(next?.toISOString()).toBe('2025-02-28T09:30:00.000Z');
  });

  it('advances an occurrence equal to now strictly into the future', () => {
    const now = new Date('2026-06-10T09:30:00.000Z');
    const next = advancePastNow(now, { kind: 'daily', interval: 1 }, now);

    expect(next?.getTime()).toBeGreaterThan(now.getTime());
    expect(next?.toISOString()).toBe('2026-06-11T09:30:00.000Z');
  });

  it('rejects invalid rules from persisted data', () => {
    expect(() => parseRule({ kind: 'monthly', interval: 0 })).toThrow();
    expect(() => parseRule({ kind: 'hourly', interval: 1 })).toThrow();
  });
});