import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { GrowthTrackingBoot } from '@/components/GrowthTrackingBoot';
import { SiteFooter } from '@/components/SiteFooter';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { RuntimeTextLocalizer } from '@/components/RuntimeTextLocalizer';
import { ReferralCaptureInner } from '@/components/ReferralCapture';

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
    images: [{ url: '/1.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Draw or Die | Architectural Jury',
    description: 'AI-powered brutal architectural jury and critique platform.',
    images: ['/1.png'],
  },
  icons: {
    icon: '/1.png',
    shortcut: '/1.png',
    apple: '/1.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <CookieConsentBanner />
      </body>
    </html>
  );
}
