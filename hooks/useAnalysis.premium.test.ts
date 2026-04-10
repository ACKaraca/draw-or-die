import { parsePremiumRescueResult, safeParseJsonObject } from '@/hooks/useAnalysis';

describe('parsePremiumRescueResult', () => {
  it('parses canonical premium payload as-is', () => {
    const parsed = parsePremiumRescueResult({
      flaws: [{ x: 10, y: 20, width: 30, height: 15, reason: 'Zayıf giriş aksı' }],
      practicalSolutions: ['Giriş holünü netleştir'],
      reference: 'Carlo Scarpa - Brion Cemetery',
    }, 'tr');

    expect(parsed).toEqual({
      flaws: [{ x: 10, y: 20, width: 30, height: 15, reason: 'Zayıf giriş aksı' }],
      practicalSolutions: ['Giriş holünü netleştir'],
      reference: 'Carlo Scarpa - Brion Cemetery',
    });
  });

  it('accepts alternate keys and normalized/string coordinates', () => {
    const parsed = parsePremiumRescueResult({
      issues: [
        {
          title: 'Dolaşım kopuk',
          bbox: { x: '0.2', y: '0.15', width: '0.4', height: '0.25' },
        },
      ],
      practical_solutions: ['Ana sirkülasyon hattını tek omurgaya bağla'],
      referenceArchitect: 'Alvaro Siza',
    }, 'tr');

    expect(parsed.flaws).toEqual([
      {
        x: 20,
        y: 15,
        width: 40,
        height: 25,
        reason: 'Dolaşım kopuk',
      },
    ]);
    expect(parsed.practicalSolutions).toEqual(['Ana sirkülasyon hattını tek omurgaya bağla']);
    expect(parsed.reference).toBe('Alvaro Siza');
  });

  it('falls back to placeholder boxes and defaults when coords are missing', () => {
    const parsed = parsePremiumRescueResult({
      flaws: [{ description: 'Kütle oranı dengesiz' }],
      solutions: ['Kütleyi iki ana parçaya böl'],
    }, 'tr');

    expect(parsed.flaws[0]).toEqual({
      x: 10,
      y: 10,
      width: 25,
      height: 20,
      reason: 'Kütle oranı dengesiz',
    });
    expect(parsed.practicalSolutions).toEqual(['Kütleyi iki ana parçaya böl']);
    expect(parsed.reference).toBe('Belirtilmedi');
  });

  it('clamps out-of-range coordinates to safe percentages', () => {
    const parsed = parsePremiumRescueResult({
      annotations: [{ left: '-20', top: '130', w: '220', h: '-3', issue: 'Taşan açıklık' }],
    }, 'tr');

    expect(parsed.flaws[0]).toEqual({
      x: 0,
      y: 100,
      width: 100,
      height: 0,
      reason: 'Taşan açıklık',
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
  });

});
