import { LegalBrandHeader } from '@/components/LegalBrandHeader';

export default function CookiesPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-28 sm:px-6">
      <LegalBrandHeader />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-white">Çerez Politikası</h1>
      <div className="mt-6 space-y-4 text-slate-300">
        <p>
          Platform deneyimini iyileştirmek için zorunlu çerezler ve oturum çerezleri kullanılır.
        </p>
        <p>
          Google Analytics, sadece kullanici acik onay verdiginde etkinlesir. Onay verildiginde Google Signals, User-ID/kullanici tarafindan saglanan veri olcumu, ayrintili konum-cihaz metrikleri ve reklam kisisellestirme icin gerekli izinler devreye girer.
          Onay verilmezse analitik ve reklam cerezleri devre disi kalir, sadece zorunlu teknik cerezler calisir.
        </p>
        <p>
          Güvenlik, kimlik doğrulama ve ödeme yönlendirme süreçlerinde teknik çerezler aktif olabilir.
        </p>
        <p>
          Analitik veriler ürün kullanımını anlamak, performans sorunlarını tespit etmek ve kullanıcı deneyimini geliştirmek amacıyla anonimleştirilmiş şekilde işlenir.
        </p>
        <p>
          Tarayıcı ayarlarınızdan çerezleri yönetebilir veya silebilirsiniz; ancak bu durumda bazı özellikler çalışmayabilir.
        </p>
      </div>
    </div>
  );
}
