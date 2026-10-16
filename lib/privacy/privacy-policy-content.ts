import { pickLocalizedFour, type SupportedLanguage } from '@/lib/i18n';
import {
  BACKUP_RETENTION_DAYS,
  BILLING_RECORD_RETENTION_YEARS,
} from '@/lib/privacy/retention';

/** de/it are optional; empty values fall back to English via `pickLocalizedFour`. */
export type PolicyText = { tr: string; en: string; de?: string; it?: string };

export function localizePolicyText(language: SupportedLanguage, text: PolicyText): string {
  return pickLocalizedFour(language, text.tr, text.en, text.de ?? '', text.it ?? '');
}

export const PRIVACY_CONTACT_EMAIL = 'support@ackaraca.me';

// Keep in sync with the integrations actually in use (AI_BASE_URL in docs/ENVIRONMENT.md, lib/appwrite,
// app/api/checkout, components/GoogleAnalytics.tsx, lib/rate-limit.ts); this is the user-facing processor list.
export const PRIVACY_PROCESSORS: ReadonlyArray<{ name: string; purpose: PolicyText }> = [
  {
    name: 'Google Gemini · Vercel AI Gateway',
    purpose: {
      tr: 'Yüklediğiniz paftalar, PDF’lerden çıkarılan metinler, proje bilgileriniz, AI Mentor mesajlarınız ve kişiselleştirme için kullanılan AI hafıza notları; jüri eleştirisi, AI Mentor yanıtları ve diğer analizleri üretmek için Vercel AI Gateway üzerinden Google’ın Gemini modellerine gönderilir.',
      en: 'Your uploaded boards, text extracted from PDFs, project details, AI Mentor messages and the AI memory notes used for personalisation are sent to Google’s Gemini models through the Vercel AI Gateway to generate jury critiques, AI Mentor replies and other analyses.',
      de: 'Ihre hochgeladenen Boards, aus PDFs extrahierter Text, Projektangaben, AI-Mentor-Nachrichten und die zur Personalisierung genutzten KI-Gedächtnisnotizen werden über das Vercel AI Gateway an die Gemini-Modelle von Google gesendet, um Jury-Kritiken, AI-Mentor-Antworten und weitere Analysen zu erstellen.',
      it: 'Le tavole caricate, il testo estratto dai PDF, i dettagli del progetto, i messaggi all’AI Mentor e le note di memoria AI usate per la personalizzazione vengono inviati ai modelli Gemini di Google tramite Vercel AI Gateway per generare critiche della giuria, risposte dell’AI Mentor e altre analisi.',
    },
  },
  {
    name: 'Vercel',
    purpose: {
      tr: 'Uygulamanın barındırılması, sunucu tarafı isteklerin işlenmesi ve kısa süreli operasyonel sunucu kayıtları (hesap kimliği ve IP adresi içerebilir).',
      en: 'Hosting of the application, processing of server-side requests and short-lived operational server logs (may include your account ID and IP address).',
      de: 'Hosting der Anwendung, Verarbeitung serverseitiger Anfragen und kurzlebige Betriebsprotokolle (können Konto-ID und IP-Adresse enthalten).',
      it: 'Hosting dell’applicazione, elaborazione delle richieste lato server e log operativi di breve durata (possono includere ID account e indirizzo IP).',
    },
  },
  {
    name: 'Appwrite',
    purpose: {
      tr: 'Hesap ve oturum yönetimi, doğrulama ve şifre sıfırlama e-postaları, profil verileri, analiz geçmişi, AI Mentor sohbetleri ve yüklenen dosyaların saklanması (Appwrite Cloud, Frankfurt bölgesi).',
      en: 'Account and session management, verification and password-reset emails, profile data, analysis history, AI Mentor chats and storage of uploaded files (Appwrite Cloud, Frankfurt region).',
      de: 'Konto- und Sitzungsverwaltung, Bestätigungs- und Passwort-Reset-E-Mails, Profildaten, Analyseverlauf, AI-Mentor-Chats und Speicherung hochgeladener Dateien (Appwrite Cloud, Region Frankfurt).',
      it: 'Gestione di account e sessioni, email di verifica e reimpostazione password, dati del profilo, cronologia delle analisi, chat con l’AI Mentor e archiviazione dei file caricati (Appwrite Cloud, regione di Francoforte).',
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
    name: 'Upstash',
    purpose: {
      tr: 'Etkinleştirildiğinde kötüye kullanımı önlemek için istek sınırlama: IP adresiniz veya hesap kimliğiniz, en fazla bir saatlik kısa ömürlü sayaç anahtarı olarak kullanılır.',
      en: 'When enabled, request rate limiting to prevent abuse: your IP address or account ID is used as a short-lived counter key that expires within an hour.',
    },
  },
  {
    name: 'Google Analytics',
    purpose: {
      tr: 'Yalnızca analitik çerezleri kabul ettiğinizde; site kullanımını ölçmek ve ürünü geliştirmek için. Kabul etmeden önce Google etiket kütüphanesi yüklenmez ve Google’a istek gönderilmez. Ayrıntılar Çerez Politikası’ndadır.',
      en: 'Only if you accept analytics cookies; used to measure site usage and improve the product. Before you accept, the Google tag library is not loaded and no request is sent to Google. See the Cookie Policy for details.',
      de: 'Nur wenn Sie Analyse-Cookies akzeptieren; zur Messung der Website-Nutzung und Verbesserung des Produkts. Vor Ihrer Zustimmung wird die Google-Tag-Bibliothek nicht geladen und keine Anfrage an Google gesendet. Details in der Cookie-Richtlinie.',
      it: 'Solo se accetti i cookie analitici; per misurare l’utilizzo del sito e migliorare il prodotto. Prima del consenso la libreria Google tag non viene caricata e nessuna richiesta viene inviata a Google. Dettagli nell’informativa sui cookie.',
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

export const PRIVACY_AI_DISCLOSURE: readonly PolicyText[] = [
  {
    tr: 'Jüri eleştirileri ve AI Mentor yanıtları yapay zeka tarafından üretilir ve yalnızca tavsiye niteliğindedir; akademik veya mesleki bir değerlendirmenin yerini tutmaz.',
    en: 'Jury critiques and AI Mentor replies are generated by AI and are advisory only; they do not replace an academic or professional assessment.',
  },
  {
    tr: 'Hizmet, eleştirileri kişiselleştirmek için analizlerinizden AI hafıza notları türetir. Bunların bir kısmı (ör. çıkarılan mimari stil) profilde gösterilmez; tümü veri dışa aktarımınızda yer alır ve hesap silindiğinde silinir.',
    en: 'To personalise critiques, the service derives AI memory notes from your analyses. Some of them (e.g. an inferred architectural style) are not shown on your profile; all of them are included in your data export and deleted with your account.',
  },
  {
    tr: 'Galeriye veya topluluğa paylaştığınız ve onaylanan paftalar herkese açıktır ve arama motorlarınca dizinlenebilir.',
    en: 'Boards you share to the gallery or community and that are approved are public and may be indexed by search engines.',
  },
];

export const PRIVACY_RETENTION_ROWS: ReadonlyArray<{ dataClass: PolicyText; retention: PolicyText }> = [
  {
    dataClass: { tr: 'Hesap ve profil', en: 'Account and profile' },
    retention: { tr: 'Hesabınız var olduğu sürece; hesap silindiğinde silinir.', en: 'For as long as your account exists; deleted when you delete your account.' },
  },
  {
    dataClass: { tr: 'Analiz geçmişi ve yüklenen dosyalar', en: 'Analysis history and uploaded files' },
    retention: {
      tr: 'Siz silene kadar. Geçmişten silinen kayıtlar 30 gün içinde kalıcı olarak temizlenir; hesap silindiğinde hemen silinir.',
      en: 'Until you delete them. Entries removed from history are purged within 30 days; all are deleted immediately when you delete your account.',
    },
  },
  {
    dataClass: { tr: 'AI Mentor sohbetleri ve AI hafıza notları', en: 'AI Mentor chats and AI memory notes' },
    retention: { tr: 'Siz silene veya hesabınızı silene kadar.', en: 'Until you delete them or your account.' },
  },
  {
    dataClass: { tr: 'Galeri, topluluk, portfolyo ve geri bildirim içerikleri', en: 'Gallery, community, portfolio and feedback content' },
    retention: { tr: 'Siz kaldırana veya hesabınızı silene kadar.', en: 'Until you remove it or delete your account.' },
  },
  {
    dataClass: { tr: 'Ödeme ve fatura kayıtları', en: 'Payment and billing records' },
    retention: {
      tr: `Yasal saklama yükümlülüğü nedeniyle hesap silindikten sonra da en fazla ${BILLING_RECORD_RETENTION_YEARS} yıl saklanır, ardından silinir.`,
      en: `Kept after account deletion for at most ${BILLING_RECORD_RETENTION_YEARS} years because of statutory bookkeeping obligations, then deleted.`,
    },
  },
  {
    dataClass: { tr: 'Stripe müşteri kaydı', en: 'Stripe customer record' },
    retention: {
      tr: 'Hesap silme talebinden sonra varsa aktif abonelik ve Stripe müşteri kaydı işletmeci tarafından elle iptal edilip kapatılır; bu adım tamamlanana kadar talep “engellendi” olarak görünür. Silmeden önce aboneliğinizi iptal etmeniz önerilir.',
      en: 'After a deletion request, the operator manually cancels any active subscription and closes the Stripe customer record; until that step is done the request shows as “blocked”. Cancel your subscription before deleting your account.',
    },
  },
  {
    dataClass: { tr: 'Yedekler', en: 'Backups' },
    retention: {
      tr: `Silinen veriler, sağlayıcı yedeklerinden en geç ${BACKUP_RETENTION_DAYS} gün içinde düşer; bu süre içinde yedekler yalnızca felaket kurtarma için kullanılır.`,
      en: `Deleted data ages out of provider backups within ${BACKUP_RETENTION_DAYS} days at most; during that window backups are used only for disaster recovery.`,
    },
  },
  {
    dataClass: { tr: 'Sunucu kayıtları', en: 'Server logs' },
    retention: { tr: 'Operasyonel kayıtlar en fazla 30 gün tutulur.', en: 'Operational logs are kept for at most 30 days.' },
  },
  {
    dataClass: { tr: 'Silme talebi kaydı', en: 'Deletion request record' },
    retention: {
      tr: `Talebin yerine getirildiğini kanıtlamak için yalnızca takma adlandırılmış (hash) kimlik ve adım durumları ${BILLING_RECORD_RETENTION_YEARS} yıla kadar saklanır; e-posta veya içerik tutulmaz.`,
      en: `To prove the request was honoured, only a pseudonymised (hashed) ID and step statuses are kept for up to ${BILLING_RECORD_RETENTION_YEARS} years; no email or content is kept.`,
    },
  },
  {
    dataClass: { tr: 'Çerez tercihi', en: 'Cookie preference' },
    retention: {
      tr: 'Yalnızca tarayıcınızda 12 ay saklanır; sunucuya kaydedilmez.',
      en: 'Stored only in your browser for 12 months; never saved on our servers.',
    },
  },
];

export const PRIVACY_RIGHTS_TEXT: readonly PolicyText[] = [
  {
    tr: 'Profil sayfasındaki “Verilerim” bölümünden tüm hesap verilerinizi JSON olarak indirebilir veya hesabınızın silinmesini talep edebilirsiniz. Silme talebi önce kayıt altına alınır, ardından her sistem tek tek silinir ve durumu raporlanır; tamamlanamayan bir adım olursa talep açık kalır ve tekrar denediğinizde kaldığı yerden devam eder.',
    en: 'From the “My data” section of your profile you can download all of your account data as JSON or request deletion of your account. A deletion request is recorded first, then each system is deleted one by one and its status is reported; if a step cannot finish, the request stays open and resumes where it stopped when you retry.',
  },
];
