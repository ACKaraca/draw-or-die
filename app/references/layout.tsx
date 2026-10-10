import { buildRouteMetadata } from '@/app/_shared/route-metadata';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

export function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadata({
    titleTr: 'Referans Kütüphanesi',
    titleEn: 'Reference Library',
    descriptionTr: 'Önemli yapıların plan, kesit ve kavramsal analizlerinden oluşan Premium referans kütüphanesi.',
    descriptionEn: 'Premium library of plan, section and concept analyses of landmark buildings.',
  });
}

export default function ReferencesLayout({ children }: Props): ReactNode {
  return children;
}
