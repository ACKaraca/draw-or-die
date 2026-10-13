import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

export const EDU_OTP_LENGTH = 6;
export const EDU_OTP_TTL_MS = 15 * 60 * 1000;
export const EDU_OTP_MAX_ATTEMPTS = 5;

export const EDU_OTP_DELIVERY = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export type EduOtpDeliveryState = (typeof EDU_OTP_DELIVERY)[keyof typeof EDU_OTP_DELIVERY];

const HASH_VERSION = 'v1';
const PURPOSE = 'edu-verify';
const TEST_FALLBACK_SECRET = 'edu-otp-test-only-secret';

export class EduOtpSecretMissingError extends Error {
  constructor() {
    super('EDU_OTP_HMAC_SECRET (or APPWRITE_API_KEY as fallback) is required for edu verification.');
    this.name = 'EduOtpSecretMissingError';
  }
}

export type EduOtpBinding = {
  userId: string;
  email: string;
  challengeId: string;
};

export function normalizeEduEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateEduOtp(): string {
  return String(randomInt(0, 10 ** EDU_OTP_LENGTH)).padStart(EDU_OTP_LENGTH, '0');
}

export function generateEduChallengeId(): string {
  return randomUUID();
}

/**
 * Server-only HMAC key. A dedicated secret is preferred; the Appwrite server key is a
 * server-only fallback (domain-separated so the raw key is never the HMAC key).
 */
function resolveHmacKey(): Buffer {
  const dedicated = (process.env.EDU_OTP_HMAC_SECRET ?? '').trim();
  if (dedicated) return Buffer.from(dedicated, 'utf8');

  const apiKey = (process.env.APPWRITE_API_KEY_LOCAL ?? process.env.APPWRITE_API_KEY ?? '').trim();
  if (apiKey) return createHmac('sha256', apiKey).update('draw-or-die:edu-otp-key:v1').digest();

  if (process.env.NODE_ENV === 'test') return Buffer.from(TEST_FALLBACK_SECRET, 'utf8');
  throw new EduOtpSecretMissingError();
}

/** Keyed hash bound to purpose, user, normalized target email and the single challenge it was issued for. */
export function hashEduOtp(code: string, binding: EduOtpBinding): string {
  const message = [
    HASH_VERSION,
    PURPOSE,
    binding.userId,
    normalizeEduEmail(binding.email),
    binding.challengeId,
    code.trim(),
  ].join('\u001f');
  return `${HASH_VERSION}:${createHmac('sha256', resolveHmacKey()).update(message).digest('hex')}`;
}

export function verifyEduOtpHash(code: string, storedHash: string, binding: EduOtpBinding): boolean {
  if (!/^\d+$/.test(code.trim()) || code.trim().length !== EDU_OTP_LENGTH) return false;
  if (!storedHash.startsWith(`${HASH_VERSION}:`)) return false;

  const expected = Buffer.from(hashEduOtp(code, binding), 'utf8');
  const actual = Buffer.from(storedHash, 'utf8');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function isEduOtpExpired(expiresAt: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!expiresAt) return true;
  const expiresMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresMs) || expiresMs <= nowMs;
}
