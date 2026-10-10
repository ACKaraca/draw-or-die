import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Topluluk',
    titleEn: 'Community',
    descriptionTr: 'Mimarlık öğrencilerinin toplulukla paylaştığı paftalar ve jüri notları.',
    descriptionEn: 'Boards and jury notes shared with the community by architecture students.',
    canonicalPath: '/community',
  });
}

export default function CommunityLayout({ children }: Props): ReactNode {
  return children;
}
