'use client';

import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalizedFour } from '@/lib/i18n';
import {
  PRIVACY_AI_DISCLOSURE,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_PROCESSORS,
  PRIVACY_RETENTION_ROWS,
  PRIVACY_RIGHTS_TEXT,
  localizePolicyText,
} from '@/lib/privacy/privacy-policy-content';

const SECTION_HEADING_CLASS = 'mt-10 font-display text-xl font-bold uppercase tracking-[0.04em] text-white';

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
        <p>{pickLocalizedFour(language, 'Yüklenen dosyalar analiz, geçmiş ve galeri özellikleri için saklanabilir. Kullanıcının galeriye veya topluluğa paylaşmayı seçtiği paftalar herkese açık olarak görüntülenir. Kullanıcı kendi hesabındaki verileri yönetebilir.', 'Uploaded files may be stored for analysis, history, and gallery features. Boards you choose to share to the gallery or community are publicly visible. Users can manage data in their own accounts.', 'Hochgeladene Dateien können für Analyse-, Verlaufs- und Galerie-Funktionen gespeichert werden. Boards, die Sie in der Galerie oder Community teilen, sind öffentlich sichtbar. Nutzer können ihre eigenen Kontodaten verwalten.', 'I file caricati possono essere conservati per le funzioni di analisi, cronologia e galleria. Le tavole che scegli di condividere nella galleria o nella community sono visibili pubblicamente. Gli utenti possono gestire i dati del proprio account.')}</p>
        <p>{pickLocalizedFour(language, 'Kullanıcı verileri satılmaz. Veriler yalnızca aşağıda listelenen hizmet sağlayıcılarla, hizmetin çalışması için gerekli ölçüde ve yasal yükümlülükler kapsamında paylaşılır.', 'User data is never sold. Data is shared only with the service providers listed below, to the extent needed to run the service, and where required by law.', 'Nutzerdaten werden niemals verkauft. Daten werden nur mit den unten aufgeführten Dienstleistern geteilt, soweit dies für den Betrieb des Dienstes erforderlich ist, sowie wenn gesetzlich vorgeschrieben.', 'I dati degli utenti non vengono mai venduti. I dati sono condivisi solo con i fornitori di servizi elencati di seguito, nella misura necessaria al funzionamento del servizio e ove richiesto dalla legge.')}</p>
      </div>

      <h2 className={SECTION_HEADING_CLASS}>
        {pickLocalizedFour(language, 'Hizmet Sağlayıcılar', 'Service Providers', 'Dienstleister', 'Fornitori di servizi')}
      </h2>
      <ul className="mt-4 space-y-3">
        {PRIVACY_PROCESSORS.map((processor) => (
          <li key={processor.name} className="rounded-xl border border-white/8 bg-[var(--color-bg-1)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-white">{processor.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{localizePolicyText(language, processor.purpose)}</p>
          </li>
        ))}
      </ul>

      <h2 className={SECTION_HEADING_CLASS}>
        {pickLocalizedFour(language, 'Yapay Zeka ve Herkese Açık İçerik', 'AI and Public Content', '', '')}
      </h2>
      <div className="mt-4 space-y-4 text-slate-300">
        {PRIVACY_AI_DISCLOSURE.map((text) => (
          <p key={text.en}>{localizePolicyText(language, text)}</p>
        ))}
      </div>

      <h2 className={SECTION_HEADING_CLASS}>
        {pickLocalizedFour(language, 'Saklama Süreleri', 'Retention', '', '')}
      </h2>
      <dl className="mt-4 divide-y divide-white/8 rounded-xl border border-white/8 bg-[var(--color-bg-1)]">
        {PRIVACY_RETENTION_ROWS.map((row) => (
          <div key={row.dataClass.en} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4">
            <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-white">
              {localizePolicyText(language, row.dataClass)}
            </dt>
            <dd className="text-sm leading-relaxed text-slate-300">{localizePolicyText(language, row.retention)}</dd>
          </div>
        ))}
      </dl>

      <h2 className={SECTION_HEADING_CLASS}>
        {pickLocalizedFour(language, 'Haklarınız', 'Your Rights', '', '')}
      </h2>
      <div className="mt-4 space-y-4 text-slate-300">
        {PRIVACY_RIGHTS_TEXT.map((text) => (
          <p key={text.en}>{localizePolicyText(language, text)}</p>
        ))}
      </div>

      <h2 className={SECTION_HEADING_CLASS}>
        {pickLocalizedFour(language, 'İletişim', 'Contact', 'Kontakt', 'Contatti')}
      </h2>
      <p className="mt-4 text-slate-300">
        {pickLocalizedFour(
          language,
          'Verilerinize erişim, düzeltme veya silme talepleri ve gizlilikle ilgili sorularınız için:',
          'For requests to access, correct or delete your data, or any privacy question, contact:',
          'Für Anfragen zu Auskunft, Berichtigung oder Löschung Ihrer Daten sowie Fragen zum Datenschutz:',
          'Per richieste di accesso, rettifica o cancellazione dei tuoi dati o per domande sulla privacy:',
        )}{' '}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
          {PRIVACY_CONTACT_EMAIL}
        </a>
      </p>
    </div>
  );
}
