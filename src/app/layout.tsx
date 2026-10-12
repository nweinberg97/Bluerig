import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Archivo } from 'next/font/google';
import './globals.css';
import './site.css';

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });

export const metadata: Metadata = {
  title: 'Bluerig · Websites for HVAC and plumbing shops',
  description: 'A website your crew can update from the truck in under a minute.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B1015' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
