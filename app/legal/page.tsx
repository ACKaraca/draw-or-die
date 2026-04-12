 'use client';

import Link from 'next/link';
import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalizedFour } from '@/lib/i18n';

const links = [
  {
    href: '/legal/terms',
    label: { tr: 'Kullanım Koşulları', en: 'Terms of Use', de: 'Nutzungsbedingungen', it: 'Termini di utilizzo' },
  },
  {
    href: '/legal/privacy',
    label: { tr: 'Gizlilik Politikası', en: 'Privacy Policy', de: 'Datenschutzrichtlinie', it: 'Informativa sulla privacy' },
  },
  {
    href: '/legal/cookies',
    label: { tr: 'Çerez Politikası', en: 'Cookie Policy', de: 'Cookie-Richtlinie', it: 'Informativa sui cookie' },
  },
];

export default function LegalIndexPage() {
  const language = useLanguage();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-28 sm:px-6">
      <LegalBrandHeader />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-white">
        {pickLocalizedFour(language, 'Yasal Merkez', 'Legal Hub', 'Rechtszentrum', 'Centro legale')}
      </h1>
      <p className="mt-3 text-slate-300">
        {pickLocalizedFour(
          language,
          'Draw or Die platformunun kullanım, gizlilik ve çerez politikalarını aşağıdaki sayfalardan inceleyebilirsiniz.',
          'You can review the Draw or Die platform’s terms, privacy, and cookie policies below.',
          'Sie können die Nutzungs-, Datenschutz- und Cookie-Richtlinien von Draw or Die unten einsehen.',
          'Puoi consultare di seguito i termini, l’informativa sulla privacy e la politica sui cookie di Draw or Die.',
        )}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-mono uppercase tracking-wider text-slate-200 hover:bg-white/10"
          >
            {pickLocalizedFour(language, link.label.tr, link.label.en, link.label.de, link.label.it)}
          </Link>
        ))}
      </div>
    </div>
  );
}
