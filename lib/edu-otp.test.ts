/** @jest-environment node */
import {
  EDU_OTP_LENGTH,
  generateEduChallengeId,
  generateEduOtp,
  hashEduOtp,
  isEduOtpExpired,
  verifyEduOtpHash,
} from '@/lib/edu-otp';

const BINDING = { userId: 'user-1', email: 'Student@Akdeniz.edu.tr', challengeId: 'challenge-1' };

describe('edu OTP hashing', () => {
  it('generates 6-digit codes and unique challenge ids', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateEduOtp()));
    for (const code of codes) expect(code).toMatch(new RegExp(`^\\d{${EDU_OTP_LENGTH}}$`));
    expect(generateEduChallengeId()).not.toBe(generateEduChallengeId());
  });

  it('stores a keyed hash, never the code', () => {
    const hash = hashEduOtp('123456', BINDING);
    expect(hash).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(hash).not.toContain('123456');
  });

  it('accepts only the same code for the same user, email and challenge', () => {
    const hash = hashEduOtp('123456', BINDING);
    expect(verifyEduOtpHash('123456', hash, BINDING)).toBe(true);
    // Email is normalized, so case does not matter.
    expect(verifyEduOtpHash('123456', hash, { ...BINDING, email: 'student@akdeniz.edu.tr' })).toBe(true);

    expect(verifyEduOtpHash('123457', hash, BINDING)).toBe(false);
    expect(verifyEduOtpHash('123456', hash, { ...BINDING, userId: 'user-2' })).toBe(false);
    expect(verifyEduOtpHash('123456', hash, { ...BINDING, email: 'other@akdeniz.edu.tr' })).toBe(false);
    expect(verifyEduOtpHash('123456', hash, { ...BINDING, challengeId: 'challenge-2' })).toBe(false);
  });

  it('never accepts legacy plaintext values or malformed input', () => {
    expect(verifyEduOtpHash('123456', '123456', BINDING)).toBe(false);
    expect(verifyEduOtpHash('12345', hashEduOtp('12345', BINDING), BINDING)).toBe(false);
    expect(verifyEduOtpHash('abcdef', hashEduOtp('abcdef', BINDING), BINDING)).toBe(false);
  });

  it('depends on the server secret', () => {
    const original = process.env.EDU_OTP_HMAC_SECRET;
    try {
      process.env.EDU_OTP_HMAC_SECRET = 'secret-a';
      const hashA = hashEduOtp('123456', BINDING);
      process.env.EDU_OTP_HMAC_SECRET = 'secret-b';
      expect(hashEduOtp('123456', BINDING)).not.toBe(hashA);
      expect(verifyEduOtpHash('123456', hashA, BINDING)).toBe(false);
    } finally {
      if (original === undefined) delete process.env.EDU_OTP_HMAC_SECRET;
      else process.env.EDU_OTP_HMAC_SECRET = original;
    }
  });

  it('treats missing, invalid and past expiries as expired', () => {
    const now = Date.parse('2026-10-13T10:00:00.000Z');
    expect(isEduOtpExpired(null, now)).toBe(true);
    expect(isEduOtpExpired('not-a-date', now)).toBe(true);
    expect(isEduOtpExpired('2026-10-13T09:59:59.000Z', now)).toBe(true);
    expect(isEduOtpExpired('2026-10-13T10:05:00.000Z', now)).toBe(false);
  });
});
