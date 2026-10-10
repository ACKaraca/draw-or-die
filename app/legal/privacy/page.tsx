 'use client';

import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalizedFour } from '@/lib/i18n';

const PRIVACY_CONTACT_EMAIL = 'support@ackaraca.me';

type LocalizedText = { tr: string; en: string; de: string; it: string };

// Keep in sync with the integrations actually in use (AI_BASE_URL in docs/ENVIRONMENT.md, lib/appwrite,
// app/api/checkout, components/GoogleAnalytics.tsx); this list is the user-facing processor disclosure.
const PROCESSORS: Array<{ name: string; purpose: LocalizedText }> = [
  {
    name: 'Google Gemini · Vercel AI Gateway',
    purpose: {
      tr: 'Yüklediğiniz paftalar, PDF’lerden çıkarılan metinler ve proje bilgileriniz; jüri eleştirisi, AI Mentor yanıtları ve diğer analizleri üretmek için Vercel AI Gateway üzerinden Google’ın Gemini modellerine gönderilir.',
      en: 'Your uploaded boards, text extracted from PDFs and project details are sent to Google’s Gemini models through the Vercel AI Gateway to generate jury critiques, AI Mentor replies and other analyses.',
      de: 'Ihre hochgeladenen Boards, aus PDFs extrahierter Text und Projektangaben werden über das Vercel AI Gateway an die Gemini-Modelle von Google gesendet, um Jury-Kritiken, AI-Mentor-Antworten und weitere Analysen zu erstellen.',
      it: 'Le tavole caricate, il testo estratto dai PDF e i dettagli del progetto vengono inviati ai modelli Gemini di Google tramite Vercel AI Gateway per generare critiche della giuria, risposte dell’AI Mentor e altre analisi.',
    },
  },
  {
    name: 'Vercel',
    purpose: {
      tr: 'Uygulamanın barındırılması ve sunucu tarafı isteklerin işlenmesi.',
      en: 'Hosting of the application and processing of server-side requests.',
      de: 'Hosting der Anwendung und Verarbeitung serverseitiger Anfragen.',
      it: 'Hosting dell’applicazione ed elaborazione delle richieste lato server.',
    },
  },
  {
    name: 'Appwrite',
    purpose: {
      tr: 'Hesap ve oturum yönetimi, doğrulama ve şifre sıfırlama e-postaları, profil verileri, analiz geçmişi ve yüklenen dosyaların saklanması (Appwrite Cloud, Frankfurt bölgesi).',
      en: 'Account and session management, verification and password-reset emails, profile data, analysis history and storage of uploaded files (Appwrite Cloud, Frankfurt region).',
      de: 'Konto- und Sitzungsverwaltung, Bestätigungs- und Passwort-Reset-E-Mails, Profildaten, Analyseverlauf und Speicherung hochgeladener Dateien (Appwrite Cloud, Region Frankfurt).',
      it: 'Gestione di account e sessioni, email di verifica e reimpostazione password, dati del profilo, cronologia delle analisi e archiviazione dei file caricati (Appwrite Cloud, regione di Francoforte).',
    },
  },
  {
    name: 'Stripe',
    purpose: {
      tr: 'Premium abonelik ve Rapido satın alımlarının ödeme işlemleri. Kart bilgileri yalnızca Stripe tarafından işlenir; Draw or Die sunucularında tutulmaz.',
      en: 'Payment processing for Premium subscriptions and Rapido purchases. Card details are handled only by Stripe and are never stored on Draw or Die servers.',
      de: 'Zahlungsabwicklung für Premium-Abonnements und Rapido-Käufe. Kartendaten werden ausschließlich von Stripe verarbeitet und nie auf den Servern von Draw or Die gespeichert.',
      it: 'Elaborazione dei pagamenti per abbonamenti Premium e acquisti di Rapido. I dati della carta sono gestiti solo da Stripe e non vengono mai conservati sui server di Draw or Die.',
    },
  },
  {
    name: 'Google Analytics',
    purpose: {
      tr: 'Yalnızca analitik çerezlere onay verdiğinizde; site kullanımını ölçmek ve ürünü geliştirmek için. Ayrıntılar Çerez Politikası’ndadır.',
      en: 'Only if you accept analytics cookies; used to measure site usage and improve the product. See the Cookie Policy for details.',
      de: 'Nur wenn Sie Analyse-Cookies akzeptieren; zur Messung der Website-Nutzung und Verbesserung des Produkts. Details in der Cookie-Richtlinie.',
      it: 'Solo se accetti i cookie analitici; per misurare l’utilizzo del sito e migliorare il prodotto. Dettagli nell’informativa sui cookie.',
    },
  },
  {
    name: 'Google Sign-In',
    purpose: {
      tr: 'Google ile giriş yapmayı seçerseniz, Google hesabınızdaki adınız ve e-posta adresiniz kimlik doğrulama için paylaşılır.',
      en: 'If you choose to sign in with Google, the name and email address of your Google account are shared for authentication.',
      de: 'Wenn Sie sich mit Google anmelden, werden Name und E-Mail-Adresse Ihres Google-Kontos zur Authentifizierung übermittelt.',
      it: 'Se scegli di accedere con Google, il nome e l’indirizzo email del tuo account Google vengono condivisi per l’autenticazione.',
    },
  },
];

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

      <h2 className="mt-10 font-display text-xl font-bold uppercase tracking-[0.04em] text-white">
        {pickLocalizedFour(language, 'Hizmet Sağlayıcılar', 'Service Providers', 'Dienstleister', 'Fornitori di servizi')}
      </h2>
      <ul className="mt-4 space-y-3">
        {PROCESSORS.map((processor) => (
          <li key={processor.name} className="rounded-xl border border-white/8 bg-[var(--color-bg-1)] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-white">{processor.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {pickLocalizedFour(language, processor.purpose.tr, processor.purpose.en, processor.purpose.de, processor.purpose.it)}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-xl font-bold uppercase tracking-[0.04em] text-white">
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
