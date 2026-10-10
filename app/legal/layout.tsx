import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Yasal Merkez',
    titleEn: 'Legal Hub',
    descriptionTr: 'Draw or Die kullanım koşulları, gizlilik ve çerez politikaları.',
    descriptionEn: 'Draw or Die terms of use, privacy and cookie policies.',
  });
}

export default function LegalLayout({ children }: Props): ReactNode {
  return children;
}
