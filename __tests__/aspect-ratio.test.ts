import {
  clampAspectRatio,
  deriveAspectRatio,
  aspectRatioToStyleValue,
} from '@/lib/aspect-ratio';

describe('aspect-ratio helpers', () => {
  describe('clampAspectRatio', () => {
    it('returns 0.75 for non-finite values', () => {
      expect(clampAspectRatio(null)).toBe(0.75);
      expect(clampAspectRatio(undefined)).toBe(0.75);
      expect(clampAspectRatio(NaN)).toBe(0.75);
      expect(clampAspectRatio(Infinity)).toBe(0.75);
    });

    it('returns 0.75 for zero or negative values', () => {
      expect(clampAspectRatio(0)).toBe(0.75);
      expect(clampAspectRatio(-1)).toBe(0.75);
    });

    it('clamps values below MIN_CARD_ASPECT_RATIO (0.55)', () => {
      expect(clampAspectRatio(0.1)).toBe(0.55);
      expect(clampAspectRatio(0.54)).toBe(0.55);
    });

    it('clamps values above MAX_CARD_ASPECT_RATIO (1.85)', () => {
      expect(clampAspectRatio(2.0)).toBe(1.85);
      expect(clampAspectRatio(1.86)).toBe(1.85);
    });

    it('returns the value if it is within range [0.55, 1.85]', () => {
      expect(clampAspectRatio(0.55)).toBe(0.55);
      expect(clampAspectRatio(1.0)).toBe(1);
      expect(clampAspectRatio(1.85)).toBe(1.85);
      expect(clampAspectRatio(0.75)).toBe(0.75);
    });
  });

  describe('deriveAspectRatio', () => {
    it('returns 0.75 if width or height is not finite', () => {
      expect(deriveAspectRatio(null, 100)).toBe(0.75);
      expect(deriveAspectRatio(100, null)).toBe(0.75);
      expect(deriveAspectRatio(undefined, 100)).toBe(0.75);
      expect(deriveAspectRatio(100, undefined)).toBe(0.75);
      expect(deriveAspectRatio(NaN, 100)).toBe(0.75);
      expect(deriveAspectRatio(100, Infinity)).toBe(0.75);
    });

    it('returns 0.75 if width or height is zero or negative', () => {
      expect(deriveAspectRatio(0, 100)).toBe(0.75);
      expect(deriveAspectRatio(100, 0)).toBe(0.75);
      expect(deriveAspectRatio(-10, 100)).toBe(0.75);
      expect(deriveAspectRatio(100, -5)).toBe(0.75);
    });

    it('returns clamped aspect ratio for valid width and height', () => {
      // 100 / 100 = 1.0 (within range)
      expect(deriveAspectRatio(100, 100)).toBe(1);

      // 100 / 200 = 0.5 (below 0.55 -> 0.55)
      expect(deriveAspectRatio(100, 200)).toBe(0.55);

      // 200 / 100 = 2.0 (above 1.85 -> 1.85)
      expect(deriveAspectRatio(200, 100)).toBe(1.85);
    });
  });

  describe('aspectRatioToStyleValue', () => {
    it('returns clamped aspect ratio as a string', () => {
      expect(aspectRatioToStyleValue(1.0)).toBe('1');
      expect(aspectRatioToStyleValue(0.5)).toBe('0.55');
      expect(aspectRatioToStyleValue(2.0)).toBe('1.85');
      expect(aspectRatioToStyleValue(null)).toBe('0.75');
    });
  });
});
