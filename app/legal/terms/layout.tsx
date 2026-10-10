import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Kullanım Koşulları',
    titleEn: 'Terms of Use',
    descriptionTr: 'Draw or Die platformunun kullanım koşulları.',
    descriptionEn: 'Terms of use for the Draw or Die platform.',
    canonicalPath: '/legal/terms',
  });
}

export default function TermsLayout({ children }: Props): ReactNode {
  return children;
}
