import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'AI Mentor',
    titleEn: 'AI Mentor',
    descriptionTr: 'Jüri savunması ve proje iterasyonu için sohbet tabanlı mimarlık mentoru.',
    descriptionEn: 'Chat-based architecture mentor for jury defense and project iteration.',
    canonicalPath: '/mentor',
  });
}

export default function MentorLayout({ children }: Props): ReactNode {
  return children;
}
