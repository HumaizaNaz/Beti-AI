import type { ReactNode } from 'react';
import { Shell } from '@/components/beti/Shell';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
