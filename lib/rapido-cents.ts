export const RAPIDO_PRECISION_SCALE = 100;

export function normalizeRapidoFractionCents(value: unknown): number {
  if (!Number.isFinite(value)) return 0;
  const parsed = Math.floor(Number(value));
  if (parsed <= 0) return 0;
  if (parsed >= RAPIDO_PRECISION_SCALE) return RAPIDO_PRECISION_SCALE - 1;
  return parsed;
}

export function toRapidoCents(rapidoPens: number, fractionCents: number): number {
  const whole = Number.isFinite(rapidoPens) ? Math.max(0, Math.floor(rapidoPens)) : 0;
  return whole * RAPIDO_PRECISION_SCALE + normalizeRapidoFractionCents(fractionCents);
}

export function splitRapidoCents(totalCents: number): { rapidoPens: number; rapidoFractionCents: number } {
  const normalized = Math.max(0, Math.floor(totalCents));
  return {
    rapidoPens: Math.floor(normalized / RAPIDO_PRECISION_SCALE),
    rapidoFractionCents: normalized % RAPIDO_PRECISION_SCALE,
  };
}

export function toRapidoDisplay(totalCents: number): number {
  return Math.round(totalCents) / RAPIDO_PRECISION_SCALE;
}

export function rapidoUnitsToCents(units: number): number {
  return Math.round(units * RAPIDO_PRECISION_SCALE);
}
