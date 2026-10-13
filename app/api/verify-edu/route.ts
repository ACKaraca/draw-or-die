import { NextResponse, type NextRequest } from 'next/server';
import { ID, Messaging, MessagingProviderType, Users } from 'node-appwrite';

import { isEduTrEmail } from '@/lib/pricing';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PROFILES_ID,
  createAdminClient,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  updateProfileById,
  type UserProfileRow,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { getClientIp } from '@/lib/client-ip';
import {
  EDU_OTP_DELIVERY,
  EDU_OTP_MAX_ATTEMPTS,
  EDU_OTP_TTL_MS,
  generateEduChallengeId,
  generateEduOtp,
  hashEduOtp,
  isEduOtpExpired,
  normalizeEduEmail,
  verifyEduOtpHash,
} from '@/lib/edu-otp';
import { pickLocalized } from '@/lib/i18n';
import { claimOnce } from '@/lib/idempotency';
import { logServerError, logServerInfo } from '@/lib/logger';
import { evaluateRewardEligibility } from '@/lib/reward-policy';
import { getRequestLanguage } from '@/lib/server-i18n';

type AppwriteTarget = {
  $id: string;
  identifier?: string;
  providerType?: string;
  providerId?: string;
};

type AppwriteErrorLike = {
  code?: number;
  message?: string;
  response?: {
    code?: number;
    message?: string;
  };
};

type RateLimitWindow = { maxRequests: number; windowMs: number };

const START_LIMIT_PER_USER: RateLimitWindow = { maxRequests: 3, windowMs: 10 * 60 * 1000 };
const START_LIMIT_PER_EMAIL: RateLimitWindow = { maxRequests: 5, windowMs: 60 * 60 * 1000 };
const START_LIMIT_PER_IP: RateLimitWindow = { maxRequests: 10, windowMs: 10 * 60 * 1000 };
const CONFIRM_LIMIT_PER_USER: RateLimitWindow = { maxRequests: 5, windowMs: 10 * 60 * 1000 };
const CONFIRM_LIMIT_PER_IP: RateLimitWindow = { maxRequests: 20, windowMs: 10 * 60 * 1000 };

/** Every OTP field cleared: used on success, on invalidation, and to drop legacy plaintext state. */
const CLEARED_OTP_STATE = {
  edu_verification_code: '',
  edu_otp_hash: '',
  edu_otp_challenge_id: '',
  edu_otp_attempts: 0,
  edu_otp_delivery: '',
  edu_verification_email: '',
  edu_verification_expires: null,
} as const;

function getAppwriteErrorCode(error: unknown): number | undefined {
  const maybe = error as AppwriteErrorLike;
  if (typeof maybe?.code === 'number') return maybe.code;
  if (typeof maybe?.response?.code === 'number') return maybe.response.code;
  return undefined;
}

function getAppwriteErrorMessage(error: unknown): string {
  const maybe = error as AppwriteErrorLike;
  return maybe?.response?.message || maybe?.message || '';
}

async function sendEduVerificationEmail(params: {
  userId: string;
  email: string;
  otp: string;
  expiresAt: string;
}): Promise<void> {
  const providerId =
    process.env.APPWRITE_EDU_EMAIL_PROVIDER_ID?.trim() ||
    process.env.APPWRITE_EMAIL_PROVIDER_ID?.trim() ||
    undefined;

  const client = createAdminClient();
  const users = new Users(client);
  const messaging = new Messaging(client);

  const normalizedEmail = params.email.trim().toLowerCase();
  const isEmailProvider = (value?: string) =>
    (value ?? '').toLowerCase() === String(MessagingProviderType.Email).toLowerCase();
  const doesProviderMatch = (entry: AppwriteTarget, expectedProviderId?: string) => {
    if (!expectedProviderId) return true;
    if (!entry.providerId) return true;
    return entry.providerId === expectedProviderId;
  };

  const listUserTargets = async (): Promise<AppwriteTarget[]> => {
    const response = await users.listTargets({ userId: params.userId });
    return Array.isArray(response.targets) ? (response.targets as AppwriteTarget[]) : [];
  };

  const findEmailTarget = (targets: AppwriteTarget[]) => targets.find((entry) => {
    const sameEmail = (entry.identifier ?? '').trim().toLowerCase() === normalizedEmail;
    return sameEmail && isEmailProvider(entry.providerType) && doesProviderMatch(entry, providerId);
  });

  let targets = await listUserTargets().catch(() => []);
  let resolvedTarget = findEmailTarget(targets);

  if (!resolvedTarget) {
    const createTarget = async (forcedProviderId?: string) => users.createTarget({
      userId: params.userId,
      targetId: ID.unique(),
      providerType: MessagingProviderType.Email,
      identifier: normalizedEmail,
      ...(forcedProviderId ? { providerId: forcedProviderId } : {}),
      name: 'Edu Verification',
    });

    try {
      resolvedTarget = await createTarget(providerId);
    } catch (error) {
      const code = getAppwriteErrorCode(error);
      const message = getAppwriteErrorMessage(error).toLowerCase();
      const providerIssue = Boolean(providerId) && (code === 404 || code === 400 || message.includes('provider'));

      if (providerIssue) {
        try {
          resolvedTarget = await createTarget(undefined);
        } catch (fallbackError) {
          const fallbackCode = getAppwriteErrorCode(fallbackError);
          if (fallbackCode !== 409) {
            throw fallbackError;
          }
        }
      } else if (code !== 409) {
        throw error;
      }

      if (!resolvedTarget) {
        targets = await listUserTargets().catch(() => []);
        resolvedTarget = findEmailTarget(targets);
      }

      if (!resolvedTarget) {
        const reusableTarget = targets.find((entry) => isEmailProvider(entry.providerType));
        if (reusableTarget?.$id) {
          resolvedTarget = await users.updateTarget({
            userId: params.userId,
            targetId: reusableTarget.$id,
            identifier: normalizedEmail,
            ...(providerId ? { providerId } : {}),
            name: 'Edu Verification',
          });
        }
      }
    }
  }

  const targetId = resolvedTarget?.$id;
  if (!targetId) {
    throw new Error('Edu verification target could not be created.');
  }

  const expireDate = new Date(params.expiresAt).toLocaleString('tr-TR');
  const html = `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
  <h2 style="margin: 0 0 12px;">Draw or Die - edu.tr Dogrulama Kodu</h2>
  <p>Merhaba,</p>
  <p>Ogrenci indirimi icin dogrulama kodunuz:</p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">${params.otp}</p>
  <p>Bu kod <strong>${expireDate}</strong> tarihine kadar gecerlidir.</p>
  <p>Eger bu islemi siz yapmadiysaniz bu mesaji dikkate almayin.</p>
</div>`;

  await messaging.createEmail({
    messageId: ID.unique(),
    subject: 'Draw or Die edu.tr dogrulama kodu',
    content: html,
    targets: [targetId],
    html: true,
  });
}

function getMessages(request: NextRequest) {
  const lang = getRequestLanguage(request);
  return {
    signIn: pickLocalized(lang, 'Giriş yapmanız gerekiyor.', 'You must sign in.'),
    tooMany: pickLocalized(lang, 'Çok fazla deneme. Lütfen biraz bekleyin.', 'Too many attempts. Please wait a while.'),
    invalidBody: pickLocalized(lang, 'Geçersiz istek gövdesi.', 'Invalid request body.'),
    emailRequired: pickLocalized(lang, 'Email adresi gereklidir.', 'Email address is required.'),
    eduOnly: pickLocalized(
      lang,
      'Sadece .edu.tr uzantılı email adresleri kabul edilir.',
      'Only .edu.tr email addresses are accepted.',
    ),
    verifiedEmailRequired: pickLocalized(
      lang,
      'Öğrenci doğrulaması için önce hesabınızın e-postasını doğrulayın.',
      'Verify your account email before student verification.',
    ),
    deliveryFailed: pickLocalized(
      lang,
      'Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin.',
      'The verification email could not be sent. Please try again later.',
    ),
    startFailed: pickLocalized(lang, 'Doğrulama başlatılamadı.', 'Could not start verification.'),
    sent: (email: string) => pickLocalized(
      lang,
      `Doğrulama kodu ${email} adresine gönderildi.`,
      `A verification code was sent to ${email}.`,
    ),
    codeRequired: pickLocalized(lang, 'Doğrulama kodu gereklidir.', 'Verification code is required.'),
    invalidCode: pickLocalized(
      lang,
      'Kod geçersiz veya süresi dolmuş. Gerekirse yeni kod isteyin.',
      'The code is invalid or expired. Request a new code if needed.',
    ),
    attemptsExhausted: pickLocalized(
      lang,
      'Çok fazla hatalı deneme. Lütfen yeni bir kod isteyin.',
      'Too many wrong attempts. Please request a new code.',
    ),
    confirmFailed: pickLocalized(lang, 'Doğrulama tamamlanamadı.', 'Could not complete verification.'),
    verified: pickLocalized(
      lang,
      '.edu.tr email doğrulandı! Öğrenci indirimi aktif.',
      '.edu.tr email verified! Student discount is active.',
    ),
  };
}

async function isRateLimited(windows: Array<[string, RateLimitWindow]>): Promise<boolean> {
  for (const [key, config] of windows) {
    const result = await checkRateLimit(key, config);
    if (!result.allowed) return true;
  }
  return false;
}

function readStringField(body: unknown, field: string): string {
  if (body === null || typeof body !== 'object') return '';
  const value = (body as Record<string, unknown>)[field];
  return typeof value === 'string' ? value.trim() : '';
}

async function invalidateChallenge(userId: string): Promise<void> {
  try {
    await updateProfileById(userId, CLEARED_OTP_STATE);
  } catch (error) {
    logServerError('api.verify-edu.invalidate', error, { userId });
  }
}

/**
 * Spends one attempt with a bounded atomic increment. Returns false once the challenge has used
 * all attempts, or when the counter cannot be written (fail closed).
 */
async function consumeAttempt(rowId: string): Promise<boolean> {
  try {
    await getAdminTables().incrementRowColumn<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId,
      column: 'edu_otp_attempts',
      value: 1,
      max: EDU_OTP_MAX_ATTEMPTS,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/verify-edu - Send an .edu.tr verification code
 *
 * Body: { email: "student@university.edu.tr" }
 *
 * Only a keyed hash of the code is stored, bound to user + email + challenge. The code itself only
 * ever goes to the mailbox; a failed delivery invalidates the challenge.
 */
export async function POST(request: NextRequest) {
  const messages = getMessages(request);
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: messages.signIn }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: messages.invalidBody }, { status: 400 });
    }

    const email = normalizeEduEmail(readStringField(body, 'email'));
    if (!email) {
      return NextResponse.json({ error: messages.emailRequired }, { status: 400 });
    }
    if (!isEduTrEmail(email)) {
      return NextResponse.json({ error: messages.eduOnly }, { status: 400 });
    }

    const eligibility = evaluateRewardEligibility({ kind: 'edu_verification', identity: user });
    if (!eligibility.eligible) {
      logServerInfo('reward.denied', { kind: 'edu_verification', userId: user.id, reason: eligibility.reason });
      return NextResponse.json({ error: messages.verifiedEmailRequired }, { status: 403 });
    }

    const isLimited = await isRateLimited([
      [`verify-edu:${user.id}`, START_LIMIT_PER_USER],
      [`verify-edu-email:${email}`, START_LIMIT_PER_EMAIL],
      [`verify-edu-ip:${getClientIp(request)}`, START_LIMIT_PER_IP],
    ]);
    if (isLimited) {
      return NextResponse.json({ error: messages.tooMany }, { status: 429 });
    }

    const otp = generateEduOtp();
    const challengeId = generateEduChallengeId();
    const expiresAt = new Date(Date.now() + EDU_OTP_TTL_MS).toISOString();

    // Stored before delivery so the mailed code works on arrival, but unusable until marked `sent`.
    // A new hash + challenge id supersedes any earlier code; legacy plaintext is cleared here.
    await updateProfileById(user.id, {
      edu_verification_code: '',
      edu_otp_hash: hashEduOtp(otp, { userId: user.id, email, challengeId }),
      edu_otp_challenge_id: challengeId,
      edu_otp_attempts: 0,
      edu_otp_delivery: EDU_OTP_DELIVERY.PENDING,
      edu_verification_email: email,
      edu_verification_expires: expiresAt,
    });

    try {
      await sendEduVerificationEmail({ userId: user.id, email, otp, expiresAt });
    } catch (deliveryError) {
      logServerError('api.verify-edu.delivery', deliveryError, { userId: user.id, challengeId });
      await invalidateChallenge(user.id);
      return NextResponse.json({ error: messages.deliveryFailed }, { status: 502 });
    }

    try {
      await updateProfileById(user.id, { edu_otp_delivery: EDU_OTP_DELIVERY.SENT });
    } catch (error) {
      logServerError('api.verify-edu.mark-sent', error, { userId: user.id, challengeId });
      return NextResponse.json({ error: messages.deliveryFailed }, { status: 502 });
    }

    logServerInfo('edu-otp.sent', { userId: user.id, challengeId, expiresAt });
    return NextResponse.json({
      message: messages.sent(email),
      requiresManualEntry: false,
      delivery: 'email',
      expiresAt,
    });
  } catch (error) {
    logServerError('api.verify-edu.POST', error);
    return NextResponse.json({ error: messages.startFailed }, { status: 500 });
  }
}

/**
 * PUT /api/verify-edu - Confirm the emailed code
 *
 * Body: { code: "123456" }
 *
 * Missing, undelivered, expired, wrong, superseded and replayed codes all get the same response.
 */
export async function PUT(request: NextRequest) {
  const messages = getMessages(request);
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: messages.signIn }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const isLimited = await isRateLimited([
      [`verify-edu-confirm:${user.id}`, CONFIRM_LIMIT_PER_USER],
      [`verify-edu-confirm-ip:${getClientIp(request)}`, CONFIRM_LIMIT_PER_IP],
    ]);
    if (isLimited) {
      return NextResponse.json({ error: messages.tooMany }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: messages.invalidBody }, { status: 400 });
    }

    const code = readStringField(body, 'code');
    if (!code) {
      return NextResponse.json({ error: messages.codeRequired }, { status: 400 });
    }

    const eligibility = evaluateRewardEligibility({ kind: 'edu_verification', identity: user });
    if (!eligibility.eligible) {
      logServerInfo('reward.denied', { kind: 'edu_verification', userId: user.id, reason: eligibility.reason });
      return NextResponse.json({ error: messages.verifiedEmailRequired }, { status: 403 });
    }

    const profile = await getOrCreateProfile(user);
    const invalidResponse = () => NextResponse.json({ error: messages.invalidCode }, { status: 400 });

    const storedHash = profile.edu_otp_hash ?? '';
    const challengeId = profile.edu_otp_challenge_id ?? '';
    const targetEmail = profile.edu_verification_email ?? '';

    if (!storedHash || !challengeId || !targetEmail) {
      // Legacy plaintext codes are never compared; drop them so they cannot linger.
      if (profile.edu_verification_code) await invalidateChallenge(user.id);
      return invalidResponse();
    }
    if (profile.edu_otp_delivery !== EDU_OTP_DELIVERY.SENT) {
      return invalidResponse();
    }
    if (isEduOtpExpired(profile.edu_verification_expires)) {
      await invalidateChallenge(user.id);
      logServerInfo('edu-otp.expired', { userId: user.id, challengeId });
      return invalidResponse();
    }
    if (!profile.row_id) {
      return NextResponse.json({ error: messages.confirmFailed }, { status: 500 });
    }

    if (!(await consumeAttempt(profile.row_id))) {
      await invalidateChallenge(user.id);
      logServerInfo('edu-otp.attempts_exhausted', { userId: user.id, challengeId });
      return NextResponse.json({ error: messages.attemptsExhausted }, { status: 429 });
    }

    if (!verifyEduOtpHash(code, storedHash, { userId: user.id, email: targetEmail, challengeId })) {
      logServerInfo('edu-otp.mismatch', { userId: user.id, challengeId });
      return invalidResponse();
    }

    // Single use: of all concurrent requests with the right code, only one claims the challenge.
    if (!(await claimOnce(`edu-otp-consume:${challengeId}`))) {
      logServerInfo('edu-otp.replay', { userId: user.id, challengeId });
      return invalidResponse();
    }

    await updateProfileById(user.id, {
      ...CLEARED_OTP_STATE,
      edu_verified: true,
      edu_email: targetEmail,
    });

    logServerInfo('edu-otp.verified', { userId: user.id, challengeId });
    return NextResponse.json({ message: messages.verified, verified: true });
  } catch (error) {
    logServerError('api.verify-edu.PUT', error);
    return NextResponse.json({ error: messages.confirmFailed }, { status: 500 });
  }
}
