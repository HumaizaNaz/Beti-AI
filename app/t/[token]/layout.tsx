import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/beti/Shell';

export const metadata: Metadata = { title: 'Beti AI — Live', robots: { index: false, follow: false } };

export default function LiveLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
