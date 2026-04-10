import { LegalBrandHeader } from '@/components/LegalBrandHeader';

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-28 sm:px-6">
      <LegalBrandHeader />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-white">Gizlilik Politikası</h1>
      <div className="mt-6 space-y-4 text-slate-300">
        <p>
          Draw or Die, hesap oluşturma, ödeme ve analiz geçmişi gibi temel işlemler için gerekli asgari veriyi işler.
        </p>
        <p>
          Yüklenen dosyalar analiz, geçmiş ve galeri özellikleri için saklanabilir. Kullanıcı kendi hesabındaki verileri yönetebilir.
        </p>
        <p>
          Ödeme işlemleri Stripe altyapısı ile yürütülür; kart verileri Draw or Die sunucularında tutulmaz.
        </p>
        <p>
          Yasal yükümlülükler haricinde kullanıcı verileri üçüncü taraflarla satılmaz veya paylaşılmaz.
        </p>
      </div>
    </div>
  );
}
