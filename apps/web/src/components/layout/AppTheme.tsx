import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-app-inter',
});

export function AppTheme({ children }: { children: React.ReactNode }) {
  return <div className={`${inter.variable} app-theme`}>{children}</div>;
}
