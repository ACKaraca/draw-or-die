import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Akran Jürisi',
    titleEn: 'Peer Review',
    descriptionTr: 'Projeni diğer mimarlık öğrencilerinin değerlendirmesine aç, onların paftalarını yorumla.',
    descriptionEn: 'Open your project to fellow architecture students and review their boards.',
    canonicalPath: '/peer-review',
  });
}

export default function PeerReviewLayout({ children }: Props): ReactNode {
  return children;
}
