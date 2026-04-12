 'use client';

import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalizedFour } from '@/lib/i18n';

export default function TermsPage() {
  const language = useLanguage();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-28 sm:px-6">
      <LegalBrandHeader />
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-white">
        {pickLocalizedFour(language, 'Kullanım Koşulları', 'Terms of Use', 'Nutzungsbedingungen', 'Termini di utilizzo')}
      </h1>
      <div className="mt-6 space-y-4 text-slate-300">
        <p>{pickLocalizedFour(language, 'Draw or Die, mimarlık öğrencileri ve profesyonelleri için yapay zeka destekli değerlendirme hizmeti sunar. Platformu kullanarak aşağıdaki koşulları kabul etmiş olursunuz.', 'Draw or Die provides AI-assisted critique services for architecture students and professionals. By using the platform, you accept the terms below.', 'Draw or Die bietet KI-gestützte Bewertungsdienste für Architekturstudierende und Fachleute an. Durch die Nutzung der Plattform akzeptieren Sie die folgenden Bedingungen.', 'Draw or Die offre servizi di valutazione assistita dall’IA per studenti e professionisti di architettura. Utilizzando la piattaforma, accetti i termini seguenti.')}</p>
        <p>{pickLocalizedFour(language, 'Kullanıcı, yüklediği içeriklerin tüm haklarına sahip olduğunu ve üçüncü taraf haklarını ihlal etmediğini beyan eder.', 'The user declares that they own all rights to the uploaded content and that it does not infringe third-party rights.', 'Der Nutzer erklärt, dass er alle Rechte an den hochgeladenen Inhalten besitzt und keine Rechte Dritter verletzt.', 'L’utente dichiara di possedere tutti i diritti sui contenuti caricati e che questi non violano diritti di terzi.')}</p>
        <p>{pickLocalizedFour(language, 'Rapido bakiyesi dijital hizmet tüketim birimidir; satın alınan krediler iade edilmez, ancak yasal zorunluluklar saklıdır.', 'Rapido balance is a digital service consumption unit; purchased credits are non-refundable, subject to legal obligations.', 'Das Rapido-Guthaben ist eine digitale Verbrauchseinheit; gekaufte Guthaben sind nicht erstattungsfähig, vorbehaltlich gesetzlicher Verpflichtungen.', 'Il saldo Rapido è un’unità di consumo per servizi digitali; i crediti acquistati non sono rimborsabili, salvo obblighi di legge.')}</p>
        <p>{pickLocalizedFour(language, 'Hizmet sürekliliği için sistemde bakım, kapasite ve güvenlik kaynaklı geçici kesintiler uygulanabilir.', 'Temporary interruptions due to maintenance, capacity, or security may occur to maintain service continuity.', 'Zur Gewährleistung des Dienstbetriebs können vorübergehende Unterbrechungen aufgrund von Wartung, Kapazität oder Sicherheit auftreten.', 'Per garantire la continuità del servizio possono verificarsi interruzioni temporanee dovute a manutenzione, capacità o sicurezza.')}</p>
      </div>
    </div>
  );
}
