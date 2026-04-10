import Link from 'next/link';
import { LegalBrandHeader } from '@/components/LegalBrandHeader';

const links = [
  { href: '/legal/terms', label: 'Kullanım Koşulları' },
  { href: '/legal/privacy', label: 'Gizlilik Politikası' },
  { href: '/legal/cookies', label: 'Çerez Politikası' },
];

export default function LegalIndexPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-28 sm:px-6">
      <LegalBrandHeader />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-white">Yasal Merkez</h1>
      <p className="mt-3 text-slate-300">
        Draw or Die platformunun kullanım, gizlilik ve çerez politikalarını aşağıdaki sayfalardan inceleyebilirsiniz.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-mono uppercase tracking-wider text-slate-200 hover:bg-white/10"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
