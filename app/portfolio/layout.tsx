import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Portfolyo Oluşturucu',
    titleEn: 'Portfolio Builder',
    descriptionTr: 'Projelerinden düzenli bir mimarlık portfolyosu oluştur.',
    descriptionEn: 'Turn your projects into a structured architecture portfolio.',
    canonicalPath: '/portfolio',
  });
}

export default function PortfolioLayout({ children }: Props): ReactNode {
  return children;
}
