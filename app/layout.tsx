import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { GrowthTrackingBoot } from '@/components/GrowthTrackingBoot';
import { SiteFooter } from '@/components/SiteFooter';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { RuntimeTextLocalizer } from '@/components/RuntimeTextLocalizer';
import { ReferralCaptureInner } from '@/components/ReferralCapture';
import { MotionPreferences } from '@/components/ui/MotionPreferences';
import { SITE_TITLE_TEMPLATE, resolveServerLanguage } from '@/app/_shared/route-metadata';
import { pickLocalized } from '@/lib/i18n';
import { buildRobotsMetadata, isProductionRequestHeaders, resolveMetadataBase } from '@/lib/site-identity';
import {
  COOKIE_CONSENT_STORAGE_KEY,
  normalizeCookieConsentStatus,
  type CookieConsentStatus,
} from '@/lib/cookie-consent';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
});

// og:title / og:description / og:image are intentionally left out: Next fills them per route from
// each page's title/description and from app/opengraph-image.tsx, and twitter inherits from openGraph.
export async function generateMetadata(): Promise<Metadata> {
  const [language, headerStore] = await Promise.all([resolveServerLanguage(), headers()]);
  const isProduction = isProductionRequestHeaders(headerStore);
  const robots = buildRobotsMetadata(isProduction);
  const defaultTitle = pickLocalized(
    language,
    'Draw or Die | Yapay Zeka Destekli Mimari Jüri',
    'Draw or Die | AI Architectural Jury',
  );

  return {
    title: {
      default: defaultTitle,
      template: SITE_TITLE_TEMPLATE,
    },
    description: pickLocalized(
      language,
      'Paftanı yükle, jüriyle yüzleş: mimarlık öğrencileri için yapay zeka destekli, çoklu persona jüri değerlendirmesi.',
      'Upload your board, face the jury: AI-powered, multi-persona architectural critique for architecture students.',
    ),
    applicationName: 'Draw or Die',
    metadataBase: resolveMetadataBase(isProduction),
    // Inherited by every route; dev/preview/unknown hosts stay out of search indexes.
    ...(robots ? { robots } : {}),
    openGraph: {
      type: 'website',
      siteName: 'Draw or Die',
      locale: language === 'tr' ? 'tr_TR' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
    },
    icons: {
      icon: '/icon.svg',
      shortcut: '/icon.svg',
      apple: '/icon.svg',
    },
  };
}

async function resolveInitialConsentStatus(): Promise<CookieConsentStatus> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_CONSENT_STORAGE_KEY)?.value ?? null;
  return normalizeCookieConsentStatus(raw);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [initialConsentStatus, initialLanguage] = await Promise.all([
    resolveInitialConsentStatus(),
    resolveServerLanguage(),
  ]);

  return (
    <html lang={initialLanguage} className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <GoogleAnalytics />
        <GrowthTrackingBoot />
        <Suspense fallback={null}>
          <ReferralCaptureInner />
        </Suspense>
        <AuthProvider>
          <RuntimeTextLocalizer initialLanguage={initialLanguage}>
            <MotionPreferences>
              <main className="flex-1">
                {children}
              </main>
              <SiteFooter />
            </MotionPreferences>
            {/* Inside the localizer so the banner follows the UI language. */}
            <CookieConsentBanner initialConsentStatus={initialConsentStatus} />
          </RuntimeTextLocalizer>
        </AuthProvider>
      </body>
    </html>
  );
}
