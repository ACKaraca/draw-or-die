import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await buildRouteMetadata({
    titleTr: 'Hesap',
    titleEn: 'Account',
    descriptionTr: 'Draw or Die hesap doğrulama ve şifre sıfırlama.',
    descriptionEn: 'Draw or Die account verification and password reset.',
  });

  // One-time token links (verification / recovery) must never be indexed.
  return { ...metadata, robots: { index: false, follow: false } };
}

export default function AuthLayout({ children }: Props): ReactNode {
  return children;
}
