import { ImageResponse } from 'next/og';

// Colors mirror the design tokens in app/globals.css (ImageResponse cannot read CSS variables).
const BG_0 = '#0A0F1A';
const NEON_RED = '#FF0033';
const TEXT = '#E2E8F0';
const TEXT_MUTED = '#94A3B8';
const GRID_LINE = 'rgba(255, 255, 255, 0.05)';

export const alt = 'Draw or Die — AI architecture jury. Upload your board, face the jury.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          backgroundColor: BG_0,
          backgroundImage: `linear-gradient(${GRID_LINE} 1px, transparent 1px), linear-gradient(90deg, ${GRID_LINE} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          color: TEXT,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 44,
              height: 44,
              backgroundColor: NEON_RED,
              borderRadius: 6,
              transform: 'rotate(45deg)',
            }}
          />
          <div style={{ display: 'flex', fontSize: 40, letterSpacing: 8, fontWeight: 700 }}>
            <span>DRAW</span>
            <span style={{ color: NEON_RED }}>OR</span>
            <span>DIE</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '8px 20px',
              marginBottom: 32,
              border: `2px solid rgba(255, 0, 51, 0.4)`,
              backgroundColor: 'rgba(255, 0, 51, 0.1)',
              borderRadius: 99,
              color: NEON_RED,
              fontSize: 22,
              letterSpacing: 4,
            }}
          >
            AI ARCHITECTURE JURY
          </div>
          <div style={{ display: 'flex', fontSize: 92, lineHeight: 1.02, letterSpacing: -2 }}>UPLOAD YOUR BOARD,</div>
          <div style={{ display: 'flex', fontSize: 92, lineHeight: 1.02, letterSpacing: -2, color: NEON_RED }}>
            FACE THE JURY.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            color: TEXT_MUTED,
            letterSpacing: 2,
          }}
        >
          <span>Multi-persona critique · PDF-aware review · AI Mentor</span>
          <span style={{ color: TEXT }}>drawordie.app</span>
        </div>
      </div>
    ),
    size,
  );
}
