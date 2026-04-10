import Link from 'next/link';

export function LegalBrandHeader() {
  return (
    <div className="mb-8 flex items-center justify-between">
      <Link href="/" className="inline-flex items-center gap-2 group">
        <div className="w-5 h-5 bg-neon-red rounded-sm transform rotate-45 group-hover:rotate-90 transition-transform duration-300" />
        <span className="font-display font-bold text-xl tracking-widest text-white">
          DRAW<span className="text-neon-red">OR</span>DIE
        </span>
      </Link>
    </div>
  );
}
