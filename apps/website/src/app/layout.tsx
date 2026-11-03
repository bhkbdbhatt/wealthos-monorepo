import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'WealthOS | Modern wealth management infrastructure',
  description:
    'One platform for advisors, investors, portfolio operations, KYC, goals, and AUM growth.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
