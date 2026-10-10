import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Gizlilik Politikası',
    titleEn: 'Privacy Policy',
    descriptionTr: 'Draw or Die hangi verileri, hangi hizmet sağlayıcılarla ve hangi amaçla işler.',
    descriptionEn: 'Which data Draw or Die processes, with which service providers, and why.',
    canonicalPath: '/legal/privacy',
  });
}

export default function PrivacyLayout({ children }: Props): ReactNode {
  return children;
}
