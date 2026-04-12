import { NextResponse } from 'next/server';
import { isMultiJuryPromoEnabled } from '@/lib/multi-jury-promo';

export async function GET() {
  const multiJuryPromo = await isMultiJuryPromoEnabled();
  return NextResponse.json({ multiJuryPromo });
}
