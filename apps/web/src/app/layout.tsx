import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/layout/QueryProvider';

export const metadata: Metadata = {
  title: {
    default: 'nfc-ecard',
    template: '%s — nfc-ecard',
  },
  description: 'RFID/NFC digital business cards with beautiful, customizable profiles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
