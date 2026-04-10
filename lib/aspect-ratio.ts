const MIN_CARD_ASPECT_RATIO = 0.55;
const MAX_CARD_ASPECT_RATIO = 1.85;

export function clampAspectRatio(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0.75;
  const normalized = Number(value);
  if (normalized <= 0) return 0.75;
  if (normalized < MIN_CARD_ASPECT_RATIO) return MIN_CARD_ASPECT_RATIO;
  if (normalized > MAX_CARD_ASPECT_RATIO) return MAX_CARD_ASPECT_RATIO;
  return normalized;
}

export function deriveAspectRatio(width: number | null | undefined, height: number | null | undefined): number {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 0.75;
  const safeWidth = Number(width);
  const safeHeight = Number(height);
  if (safeWidth <= 0 || safeHeight <= 0) return 0.75;
  return clampAspectRatio(safeWidth / safeHeight);
}

export function aspectRatioToStyleValue(value: number | null | undefined): string {
  return String(clampAspectRatio(value));
}
