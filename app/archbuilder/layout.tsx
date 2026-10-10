import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'ArchBuilder',
    titleEn: 'ArchBuilder',
    descriptionTr: 'Proje fikrinden adım adım plan şemasına: ArchBuilder ile mimari planlamayı yapılandır.',
    descriptionEn: 'From project intent to a step-by-step plan scheme: structure architectural planning with ArchBuilder.',
    canonicalPath: '/archbuilder',
  });
}

export default function ArchBuilderLayout({ children }: Props): ReactNode {
  return children;
}
