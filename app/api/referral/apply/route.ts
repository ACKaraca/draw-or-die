import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest, getOrCreateProfile } from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { applyReferralReward } from '@/lib/referral';
import { logServerError } from '@/lib/logger';

// POST /api/referral/apply
// Email doğrulaması tamamlandıktan sonra çağrılır.
// Sistemi aktif ise hem yeni kullanıcıya hem referans verene rapido verir.
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();
    await getOrCreateProfile(user);

    const result = await applyReferralReward(user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rewarded: result.rewarded,
      rapido: result.rapido ?? null,
    });
  } catch (error) {
    logServerError('api.referral.apply.POST', error);
    return NextResponse.json({ error: 'Referral ödülü verilemedi.' }, { status: 500 });
  }
}
