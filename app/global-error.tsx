'use client';

import { useEffect, type CSSProperties } from 'react';

import { reportClientError } from '@/lib/logger';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Rendered instead of the root layout, so neither globals.css, next/font nor the language context is
// guaranteed to be available: styles are inline (design token values) and copy is shown in TR + EN.
const COLORS = {
  bg0: '#0A0F1A',
  bg1: '#0D1525',
  neonRed: '#FF0033',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
  border: 'rgba(255, 255, 255, 0.08)',
  borderMd: 'rgba(255, 255, 255, 0.13)',
};

const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SANS_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const buttonBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '16px 32px',
  fontFamily: MONO_STACK,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  cursor: 'pointer',
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    void reportClientError({
      scope: 'app.global-error',
      message: error.message || 'Unhandled root error',
      details: { digest: error.digest ?? null, stack: error.stack ?? null },
    });
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          backgroundColor: COLORS.bg0,
          color: COLORS.text,
          fontFamily: SANS_STACK,
        }}
      >
        <main
          role="alert"
          style={{
            width: '100%',
            maxWidth: 560,
            padding: 32,
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.bg1,
          }}
        >
          <p style={{ margin: 0, fontFamily: MONO_STACK, fontSize: 11, letterSpacing: '0.12em', color: COLORS.neonRed }}>
            DRAW OR DIE
          </p>
          <h1 style={{ margin: '12px 0 0', fontSize: 28, lineHeight: 1.2, textTransform: 'uppercase' }}>
            Bir şeyler ters gitti
          </h1>
          <p lang="en" style={{ margin: '4px 0 0', fontSize: 16, color: COLORS.textMuted, textTransform: 'uppercase' }}>
            Something went wrong
          </p>
          <p style={{ margin: '20px 0 0', fontSize: 14, lineHeight: 1.7, color: COLORS.textMuted }}>
            Sayfayı yeniden yüklemeyi dene; sorun sürerse biraz sonra tekrar gel.
            <br />
            <span lang="en">Try reloading the page; if the problem persists, come back in a few minutes.</span>
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32 }}>
            <button
              type="button"
              onClick={reset}
              style={{ ...buttonBase, border: 'none', backgroundColor: COLORS.neonRed, color: 'white' }}
            >
              Tekrar dene · Try again
            </button>
            {/* Full reload on purpose: the client router may be in a broken state here. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                ...buttonBase,
                fontWeight: 400,
                fontSize: 12,
                borderRadius: 8,
                border: `1px solid ${COLORS.borderMd}`,
                color: COLORS.text,
              }}
            >
              Ana sayfa · Home
            </a>
          </div>

          {error.digest && (
            <p style={{ margin: '24px 0 0', fontFamily: MONO_STACK, fontSize: 10, color: COLORS.textMuted }}>
              Ref: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
