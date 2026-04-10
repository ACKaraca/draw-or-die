import { NextRequest, NextResponse } from 'next/server';
import { ID, Messaging, MessagingProviderType, Users } from 'node-appwrite';
import { isEduTrEmail } from '@/lib/pricing';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  createAdminClient,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  updateProfileById,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';

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
}): Promise<boolean> {
  const providerId =
    process.env.APPWRITE_EDU_EMAIL_PROVIDER_ID?.trim() ||
    process.env.APPWRITE_EMAIL_PROVIDER_ID?.trim() ||
    undefined;

  const client = createAdminClient();
  const users = new Users(client);
  const messaging = new Messaging(client);

  const normalizedEmail = params.email.trim().toLowerCase();
  const isEmailProvider = (value?: string) => (value ?? '').toLowerCase() === String(MessagingProviderType.Email).toLowerCase();
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
    throw new Error('Edu verification target olusturulamadi.');
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

  return true;
}

/**
 * POST /api/verify-edu - Initiate .edu.tr email verification
 *
 * Body: { email: "student@university.edu.tr" }
 *
 * Stores a 6-digit OTP on user profile and tries to deliver it via email.
 * If messaging provider is not configured, client falls back to manual OTP flow.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const rl = await checkRateLimit(`verify-edu:${user.id}`, { maxRequests: 3, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Çok fazla deneme. 10 dakika bekleyin.' }, { status: 429 });
    }

    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email adresi gereklidir.' }, { status: 400 });
    }

    if (!isEduTrEmail(email)) {
      return NextResponse.json({ error: 'Sadece .edu.tr uzantılı email adresleri kabul edilir.' }, { status: 400 });
    }

    const otpArray = new Uint32Array(1);
    crypto.getRandomValues(otpArray);
    const otp = String(100000 + (otpArray[0] % 900000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await updateProfileById(user.id, {
      edu_verification_code: otp,
      edu_verification_email: email,
      edu_verification_expires: expiresAt,
    });

    let deliveredByEmail = false;
    try {
      deliveredByEmail = await sendEduVerificationEmail({
        userId: user.id,
        email,
        otp,
        expiresAt,
      });
    } catch (deliveryError) {
      console.error('Verify edu delivery error:', deliveryError);
    }

    return NextResponse.json({
      message: deliveredByEmail
        ? `Dogrulama kodu ${email} adresine gonderildi.`
        : `Dogrulama kodu olusturuldu. ${email} icin manuel kod girerek devam edebilirsiniz.`,
      requiresManualEntry: !deliveredByEmail,
      delivery: deliveredByEmail ? 'email' : 'manual',
      ...(process.env.NODE_ENV !== 'production' && !deliveredByEmail ? { devOtp: otp } : {}),
    });
  } catch (error) {
    console.error('Verify edu error:', error);
    return NextResponse.json({ error: 'Doğrulama başlatılamadı.' }, { status: 500 });
  }
}

/**
 * PUT /api/verify-edu - Confirm OTP verification
 *
 * Body: { code: "123456" }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const rl = await checkRateLimit(`verify-edu-confirm:${user.id}`, { maxRequests: 5, windowMs: 10 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Çok fazla deneme. Lütfen bekleyin.' }, { status: 429 });
    }

    const body = await request.json();
    const code = typeof body?.code === 'string' ? body.code.trim() : '';

    if (!code) {
      return NextResponse.json({ error: 'Doğrulama kodu gereklidir.' }, { status: 400 });
    }

    const profile = await getOrCreateProfile(user);

    if (!profile.edu_verification_code) {
      return NextResponse.json({ error: 'Doğrulama başlatılmamış.' }, { status: 400 });
    }

    if (!profile.edu_verification_expires || new Date(profile.edu_verification_expires) < new Date()) {
      return NextResponse.json({ error: 'Doğrulama kodunun süresi dolmuş. Yeni kod gönderin.' }, { status: 400 });
    }

    if (code.length !== profile.edu_verification_code.length) {
      return NextResponse.json({ error: 'Geçersiz doğrulama kodu.' }, { status: 400 });
    }

    let mismatch = 0;
    for (let i = 0; i < code.length; i++) {
      mismatch |= code.charCodeAt(i) ^ profile.edu_verification_code.charCodeAt(i);
    }

    if (mismatch !== 0) {
      return NextResponse.json({ error: 'Geçersiz doğrulama kodu.' }, { status: 400 });
    }

    await updateProfileById(user.id, {
      edu_verified: true,
      edu_email: profile.edu_verification_email ?? '',
      edu_verification_code: '',
      edu_verification_email: '',
      edu_verification_expires: null,
    });

    return NextResponse.json({ message: '.edu.tr email doğrulandı! Öğrenci indirimi aktif.', verified: true });
  } catch (error) {
    console.error('Verify edu confirm error:', error);
    return NextResponse.json({ error: 'Doğrulama tamamlanamadı.' }, { status: 500 });
  }
}
