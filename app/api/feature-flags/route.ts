import { NextResponse } from 'next/server';
import { isMultiJuryPromoEnabled } from '@/lib/multi-jury-promo';

const FEATURE_FLAGS_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=300';

export async function GET() {
  const multiJuryPromo = await isMultiJuryPromoEnabled();
  return NextResponse.json(
    { multiJuryPromo },
    { headers: { 'Cache-Control': FEATURE_FLAGS_CACHE_CONTROL } },
  );
}
