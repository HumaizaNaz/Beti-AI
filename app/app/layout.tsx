import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/beti/Shell';

export const metadata: Metadata = { title: 'Beti AI' };

export default function AppLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
