 'use client';

import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalizedFour } from '@/lib/i18n';

export default function CookiesPage() {
  const language = useLanguage();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-28 sm:px-6">
      <LegalBrandHeader />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-white">
        {pickLocalizedFour(language, 'Çerez Politikası', 'Cookie Policy', 'Cookie-Richtlinie', 'Informativa sui cookie')}
      </h1>
      <div className="mt-6 space-y-4 text-slate-300">
        <p>{pickLocalizedFour(language, 'Platform deneyimini iyileştirmek için zorunlu çerezler ve oturum çerezleri kullanılır.', 'Necessary and session cookies are used to improve the platform experience.', 'Erforderliche und Sitzungscookies werden verwendet, um das Plattformerlebnis zu verbessern.', 'Vengono utilizzati cookie necessari e di sessione per migliorare l’esperienza della piattaforma.')}</p>
        <p>{pickLocalizedFour(language, 'Google Analytics, sadece kullanıcı açık onay verdiğinde etkinleşir. Onay verildiğinde Google Signals, User-ID/kullanıcı tarafından sağlanan veri ölçümü, ayrıntılı konum-cihaz metrikleri ve reklam kişiselleştirme için gerekli izinler devreye girer. Onay verilmezse analitik ve reklam çerezleri devre dışı kalır, sadece zorunlu teknik çerezler çalışır.', 'Google Analytics activates only when the user gives explicit consent. When consent is given, Google Signals, User-ID/user-provided data measurement, detailed location-device metrics, and ad personalization permissions are enabled. Without consent, analytics and advertising cookies remain disabled and only strictly necessary technical cookies run.', 'Google Analytics wird nur aktiviert, wenn der Nutzer ausdrücklich zustimmt. Bei Zustimmung werden Google Signals, User-ID/vom Nutzer bereitgestellte Messdaten, detaillierte Standort-Geräte-Metriken und die für die Anzeigenpersonalisierung erforderlichen Berechtigungen aktiviert. Ohne Zustimmung bleiben Analyse- und Werbecookies deaktiviert; nur zwingend notwendige technische Cookies laufen.', 'Google Analytics si attiva solo quando l’utente fornisce un consenso esplicito. Quando il consenso è dato, vengono abilitati Google Signals, la misurazione dei dati forniti dall’utente/User-ID, metriche dettagliate posizione-dispositivo e le autorizzazioni per la personalizzazione degli annunci. Senza consenso, i cookie analitici e pubblicitari restano disattivati e funzionano solo i cookie tecnici strettamente necessari.')}</p>
        <p>{pickLocalizedFour(language, 'Güvenlik, kimlik doğrulama ve ödeme yönlendirme süreçlerinde teknik çerezler aktif olabilir.', 'Technical cookies may be active for security, authentication, and payment redirect flows.', 'Technische Cookies können für Sicherheits-, Authentifizierungs- und Zahlungsweiterleitungsprozesse aktiv sein.', 'I cookie tecnici possono essere attivi nei flussi di sicurezza, autenticazione e reindirizzamento dei pagamenti.')}</p>
        <p>{pickLocalizedFour(language, 'Analitik veriler ürün kullanımını anlamak, performans sorunlarını tespit etmek ve kullanıcı deneyimini geliştirmek amacıyla anonimleştirilmiş şekilde işlenir.', 'Analytics data is processed in anonymized form to understand product usage, detect performance issues, and improve user experience.', 'Analysedaten werden anonymisiert verarbeitet, um die Produktnutzung zu verstehen, Leistungsprobleme zu erkennen und die Benutzererfahrung zu verbessern.', 'I dati analitici vengono trattati in forma anonimizzata per comprendere l’uso del prodotto, individuare problemi di prestazioni e migliorare l’esperienza utente.')}</p>
        <p>{pickLocalizedFour(language, 'Tarayıcı ayarlarınızdan çerezleri yönetebilir veya silebilirsiniz; ancak bu durumda bazı özellikler çalışmayabilir.', 'You can manage or delete cookies from your browser settings; however, some features may not work in that case.', 'Sie können Cookies in Ihren Browsereinstellungen verwalten oder löschen; einige Funktionen funktionieren dann jedoch möglicherweise nicht.', 'Puoi gestire o eliminare i cookie dalle impostazioni del browser; tuttavia, alcune funzionalità potrebbero non funzionare.')}</p>
      </div>
    </div>
  );
}
