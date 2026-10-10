import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Galeri',
    titleEn: 'Gallery',
    descriptionTr: 'Hall of Fame ve Wall of Death: jüriden geçen ve jüriye takılan paftalar.',
    descriptionEn: 'Hall of Fame and Wall of Death: boards that survived the jury and boards that did not.',
  });
}

export default function GalleryLayout({ children }: Props): ReactNode {
  return children;
}
