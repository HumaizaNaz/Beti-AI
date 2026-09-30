import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/beti/Shell';

export const metadata: Metadata = { title: 'Beti AI — Help' };

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
