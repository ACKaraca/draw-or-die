import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0F1A',
          borderRadius: '6px',
        }}
      >
        <span style={{ fontSize: 20, color: '#FF0033' }}>✏</span>
      </div>
    ),
    { ...size }
  );
}
