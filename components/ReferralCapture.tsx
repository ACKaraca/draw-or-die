'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export const REFERRAL_STORAGE_KEY = 'dod_referral_code';

// URL'de ?ref=CODE varsa localStorage'a kaydeder.
// Layout'ta render edilir; kullanıcı kaydolurken bu değer okunur.
export function ReferralCaptureInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('ref');
    if (!code || typeof window === 'undefined') return;

    const normalized = code.trim().toUpperCase();
    if (normalized.length >= 4 && normalized.length <= 16) {
      try {
        window.localStorage.setItem(REFERRAL_STORAGE_KEY, normalized);
      } catch {
        // Storage erişim hatası görmezden gelinir
      }
    }
  }, [searchParams]);

  return null;
}
