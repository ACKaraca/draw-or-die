import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest, getOrCreateProfile } from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { applyReferralReward } from '@/lib/referral';
import { logServerError } from '@/lib/logger';
import { rejectIfHeld } from '@/lib/p0-holds';
import { getRequestLanguage } from '@/lib/server-i18n';

// POST /api/referral/apply
// Email doğrulaması tamamlandıktan sonra çağrılır.
// Sistemi aktif ise hem yeni kullanıcıya hem referans verene rapido verir.
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    // P0 hold: no new referral grants while rewards are held.
    const heldResponse = await rejectIfHeld('rewards', getRequestLanguage(request));
    if (heldResponse) return heldResponse;

    await ensureCoreAppwriteResources();
    await getOrCreateProfile(user);

    const result = await applyReferralReward(user);

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
