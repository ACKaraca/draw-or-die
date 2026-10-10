import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Stüdyo İtirafları',
    titleEn: 'Studio Confessions',
    descriptionTr: 'Stüdyo hayatından anonim ve yapay zeka ile moderasyonu yapılan itiraflar.',
    descriptionEn: 'Anonymous, AI-moderated confessions from studio life.',
    canonicalPath: '/confessions',
  });
}

export default function ConfessionsLayout({ children }: Props): ReactNode {
  return children;
}
