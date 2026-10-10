import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Çerez Politikası',
    titleEn: 'Cookie Policy',
    descriptionTr: 'Draw or Die tarafından kullanılan zorunlu ve analitik çerezler.',
    descriptionEn: 'Necessary and analytics cookies used by Draw or Die.',
    canonicalPath: '/legal/cookies',
  });
}

export default function CookiesLayout({ children }: Props): ReactNode {
  return children;
}
