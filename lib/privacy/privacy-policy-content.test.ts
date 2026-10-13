import {
  PRIVACY_AI_DISCLOSURE,
  PRIVACY_PROCESSORS,
  PRIVACY_RETENTION_ROWS,
  PRIVACY_RIGHTS_TEXT,
} from '@/lib/privacy/privacy-policy-content';
import { BACKUP_RETENTION_DAYS, BILLING_RECORD_RETENTION_YEARS } from '@/lib/privacy/retention';

describe('privacy policy content', () => {
  const allTexts = [
    ...PRIVACY_PROCESSORS.map((processor) => processor.purpose),
    ...PRIVACY_AI_DISCLOSURE,
    ...PRIVACY_RETENTION_ROWS.flatMap((row) => [row.dataClass, row.retention]),
    ...PRIVACY_RIGHTS_TEXT,
  ];

  it('provides Turkish and English for every string', () => {
    for (const text of allTexts) {
      expect(text.tr.trim()).not.toBe('');
      expect(text.en.trim()).not.toBe('');
    }
  });

  it('discloses every processor the app talks to', () => {
    expect(PRIVACY_PROCESSORS.map((processor) => processor.name)).toEqual(
      expect.arrayContaining(['Vercel', 'Appwrite', 'Stripe', 'Upstash', 'Google Analytics', 'Google Sign-In']),
    );
    expect(PRIVACY_PROCESSORS.some((processor) => processor.name.includes('Gemini'))).toBe(true);
  });

  it('states time-bounded retention exceptions that match the deletion contract', () => {
    const englishRetention = PRIVACY_RETENTION_ROWS.map((row) => row.retention.en).join(' ');
    expect(englishRetention).toContain(`${BILLING_RECORD_RETENTION_YEARS} years`);
    expect(englishRetention).toContain(`${BACKUP_RETENTION_DAYS} days`);
  });
});
