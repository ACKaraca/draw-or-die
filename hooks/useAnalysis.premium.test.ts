import { parsePremiumRescueResult, safeParseJsonObject } from '@/hooks/useAnalysis';

describe('parsePremiumRescueResult', () => {
  it('parses canonical premium payload with severity and rescue safeguards', () => {
    const parsed = parsePremiumRescueResult({
      flaws: [{ x: 10, y: 20, width: 30, height: 15, reason: 'Weak entry axis' }],
      practicalSolutions: ['Clarify the entry hall'],
      reference: 'Carlo Scarpa - Brion Cemetery',
    }, 'en');

    expect(parsed).toEqual({
      flaws: [{ x: 10, y: 20, width: 30, height: 15, reason: 'Weak entry axis', severity: 'MEDIUM' }],
      practicalSolutions: [
        'Clarify the entry hall',
        'For #1: Weak entry axis',
        'Rework the remaining critical board decisions with technical justification (3).',
        'Rework the remaining critical board decisions with technical justification (4).',
        'Rework the remaining critical board decisions with technical justification (5).',
        'Rework the remaining critical board decisions with technical justification (6).',
      ],
      reference: 'Carlo Scarpa - Brion Cemetery',
      imageEditPlanEnabled: false,
    });
  });

  it('accepts alternate keys and normalized/string coordinates', () => {
    const parsed = parsePremiumRescueResult({
      issues: [
        {
          title: 'Circulation is broken',
          severity: 'critical',
          bbox: { x: '0.2', y: '0.15', width: '0.4', height: '0.25' },
        },
      ],
      practical_solutions: ['Tie the main circulation into one clear spine'],
      referenceArchitect: 'Alvaro Siza',
    }, 'en');

    expect(parsed.flaws).toEqual([
      {
        x: 20,
        y: 15,
        width: 40,
        height: 25,
        reason: 'Circulation is broken',
        severity: 'CRITICAL',
      },
    ]);
    expect(parsed.practicalSolutions).toHaveLength(6);
    expect(parsed.practicalSolutions[0]).toBe('Tie the main circulation into one clear spine');
    expect(parsed.reference).toBe('Alvaro Siza');
  });

  it('falls back to visible placeholder boxes and defaults when coords are missing', () => {
    const parsed = parsePremiumRescueResult({
      flaws: [{ description: 'Mass proportion is unstable' }],
      solutions: ['Split the mass into two primary volumes'],
    }, 'en');

    expect(parsed.flaws[0]).toEqual({
      x: 8,
      y: 8,
      width: 24,
      height: 12,
      reason: 'Mass proportion is unstable',
      severity: 'MEDIUM',
    });
    expect(parsed.practicalSolutions).toHaveLength(6);
    expect(parsed.practicalSolutions[0]).toBe('Split the mass into two primary volumes');
    expect(parsed.reference).toBe('Not specified');
  });

  it('clamps out-of-range coordinates to visible safe percentages', () => {
    const parsed = parsePremiumRescueResult({
      annotations: [{ left: '-20', top: '130', w: '220', h: '-3', issue: 'Oversized span' }],
    }, 'en');

    expect(parsed.flaws[0]).toEqual({
      x: 0,
      y: 96,
      width: 100,
      height: 4,
      reason: 'Oversized span',
      severity: 'MEDIUM',
    });
  });

  it('rejects arrays when parsing generic json objects', () => {
    expect(safeParseJsonObject('[1,2,3]')).toEqual({});
  });

  it('localizes fallback correctly to English', () => {
    const parsed = parsePremiumRescueResult({}, 'en');
    expect(parsed.reference).toBe('Not specified');
    expect(parsed.flaws).toEqual([]);
    expect(parsed.practicalSolutions).toEqual([]);
    expect(parsed.imageEditPlanEnabled).toBe(false);
  });
});
