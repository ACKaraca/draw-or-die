 'use client';

import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalizedFour } from '@/lib/i18n';

export default function PrivacyPage() {
  const language = useLanguage();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-28 sm:px-6">
      <LegalBrandHeader />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-white">
        {pickLocalizedFour(language, 'Gizlilik Politikası', 'Privacy Policy', 'Datenschutzrichtlinie', 'Informativa sulla privacy')}
      </h1>
      <div className="mt-6 space-y-4 text-slate-300">
        <p>{pickLocalizedFour(language, 'Draw or Die, hesap oluşturma, ödeme ve analiz geçmişi gibi temel işlemler için gerekli asgari veriyi işler.', 'Draw or Die processes only the minimum data needed for core functions such as account creation, payments, and analysis history.', 'Draw or Die verarbeitet nur die Mindestdaten, die für Kernfunktionen wie Kontoerstellung, Zahlungen und Analyseverlauf erforderlich sind.', 'Draw or Die elabora solo i dati minimi necessari per funzioni essenziali come creazione account, pagamenti e cronologia delle analisi.')}</p>
        <p>{pickLocalizedFour(language, 'Yüklenen dosyalar analiz, geçmiş ve galeri özellikleri için saklanabilir. Kullanıcı kendi hesabındaki verileri yönetebilir.', 'Uploaded files may be stored for analysis, history, and gallery features. Users can manage data in their own accounts.', 'Hochgeladene Dateien können für Analyse-, Verlaufs- und Galerie-Funktionen gespeichert werden. Nutzer können ihre eigenen Kontodaten verwalten.', 'I file caricati possono essere conservati per le funzioni di analisi, cronologia e galleria. Gli utenti possono gestire i dati del proprio account.')}</p>
        <p>{pickLocalizedFour(language, 'Ödeme işlemleri Stripe altyapısı ile yürütülür; kart verileri Draw or Die sunucularında tutulmaz.', 'Payments are handled through Stripe; card data is not stored on Draw or Die servers.', 'Zahlungen werden über Stripe abgewickelt; Kartendaten werden nicht auf den Servern von Draw or Die gespeichert.', 'I pagamenti sono gestiti tramite Stripe; i dati della carta non vengono conservati sui server di Draw or Die.')}</p>
        <p>{pickLocalizedFour(language, 'Yasal yükümlülükler haricinde kullanıcı verileri üçüncü taraflarla satılmaz veya paylaşılmaz.', 'Except where required by law, user data is not sold or shared with third parties.', 'Außer wenn gesetzlich vorgeschrieben, werden Nutzerdaten nicht an Dritte verkauft oder weitergegeben.', 'Salvo obblighi di legge, i dati degli utenti non vengono venduti o condivisi con terze parti.')}</p>
      </div>
    </div>
  );
}
