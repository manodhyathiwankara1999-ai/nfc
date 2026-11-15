import { AppTheme } from '@/components/layout/AppTheme';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AppTheme>{children}</AppTheme>;
}
