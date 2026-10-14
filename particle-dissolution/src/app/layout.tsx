import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dissolve — pixel to crowd',
  description:
    'A real-time Three.js experience: a pixel-art character is scanned, dissolves into a flowing particle field, reconstructs as a crowd of colourful silhouettes — and back again.',
};

export const viewport: Viewport = {
  themeColor: '#15161a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <noscript>
          <p
            style={{
              position: 'fixed',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              margin: 0,
              padding: 32,
              textAlign: 'center',
            }}
          >
            This experience needs JavaScript and WebGL 2.
          </p>
        </noscript>
      </body>
    </html>
  );
}
