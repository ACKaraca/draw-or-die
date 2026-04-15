import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { GrowthTrackingBoot } from '@/components/GrowthTrackingBoot';
import { SiteFooter } from '@/components/SiteFooter';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { RuntimeTextLocalizer } from '@/components/RuntimeTextLocalizer';
import { ReferralCaptureInner } from '@/components/ReferralCapture';
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

export const metadata: Metadata = {
  title: 'Draw or Die | Architectural Jury',
  description: 'AI-powered brutal architectural jury and critique platform.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://drawordie.ackaraca.me'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Draw or Die',
    title: 'Draw or Die | Architectural Jury',
    description: 'AI-powered brutal architectural jury and critique platform.',
    images: [{ url: '/icon.svg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Draw or Die | Architectural Jury',
    description: 'AI-powered brutal architectural jury and critique platform.',
    images: ['/icon.svg'],
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

async function resolveInitialConsentStatus(): Promise<CookieConsentStatus> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_CONSENT_STORAGE_KEY)?.value ?? null;
  return normalizeCookieConsentStatus(raw);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialConsentStatus = await resolveInitialConsentStatus();

  return (
    <html lang="tr" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen flex flex-col" suppressHydrationWarning>
        <GoogleAnalytics />
        <GrowthTrackingBoot />
        <Suspense fallback={null}>
          <ReferralCaptureInner />
        </Suspense>
        <AuthProvider>
          <RuntimeTextLocalizer>
            <main className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </RuntimeTextLocalizer>
        </AuthProvider>
        <CookieConsentBanner initialConsentStatus={initialConsentStatus} />
      </body>
    </html>
  );
}
