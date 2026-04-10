import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { linkReferralToUser } from '@/lib/referral';
import { logServerError } from '@/lib/logger';

// POST /api/referral/link
// Yeni kayıt olan kullanıcının profiline referral kodu bağlar.
// Çağrı: kayıt sonrası, email doğrulanmadan önce.
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { referral_code?: unknown };
    const code = typeof body.referral_code === 'string' ? body.referral_code.trim() : '';

    if (!code) {
      return NextResponse.json({ error: 'Referral kodu gerekli.' }, { status: 400 });
    }

    await ensureCoreAppwriteResources();

    const result = await linkReferralToUser(user.id, code);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError('api.referral.link.POST', error);
    return NextResponse.json({ error: 'Referral kodu bağlanamadı.' }, { status: 500 });
  }
}
