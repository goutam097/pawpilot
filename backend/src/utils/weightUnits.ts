/**
 * Weight unit conversion.
 *
 * Two units supported: kg and lb. USD-style simplicity — no oz, no stone.
 *
 * Conversion constant is exact per NIST: 1 lb = 0.45359237 kg exactly.
 * Which means 1 kg = 1 / 0.45359237 ≈ 2.2046226218 lb.
 *
 * We round to 2 decimal places after conversion. That matches the display
 * precision users expect for pet weights (e.g., 28.2 kg, 62.17 lb).
 */

export type WeightUnit = 'kg' | 'lb';

const KG_TO_LB = 2.2046226218;

export function convertWeight(
  value: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit,
): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'kg' && toUnit === 'lb') {
    return round2(value * KG_TO_LB);
  }
  // fromUnit === 'lb' && toUnit === 'kg'
  return round2(value / KG_TO_LB);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}