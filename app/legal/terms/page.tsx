import { LegalBrandHeader } from '@/components/LegalBrandHeader';

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-28 sm:px-6">
      <LegalBrandHeader />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-white">Kullanım Koşulları</h1>
      <div className="mt-6 space-y-4 text-slate-300">
        <p>
          Draw or Die, mimarlık öğrencileri ve profesyonelleri için yapay zeka destekli değerlendirme hizmeti sunar.
          Platformu kullanarak aşağıdaki koşulları kabul etmiş olursunuz.
        </p>
        <p>
          Kullanıcı, yüklediği içeriklerin tüm haklarına sahip olduğunu ve üçüncü taraf haklarını ihlal etmediğini beyan eder.
        </p>
        <p>
          Rapido bakiyesi dijital hizmet tüketim birimidir; satın alınan krediler iade edilmez, ancak yasal zorunluluklar saklıdır.
        </p>
        <p>
          Hizmet sürekliliği için sistemde bakım, kapasite ve güvenlik kaynaklı geçici kesintiler uygulanabilir.
        </p>
      </div>
    </div>
  );
}
