'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BigButton } from '@/components/beti/BigButton';
import { useT } from '@/components/beti/Shell';
import { SosPanel } from '@/components/beti/SosPanel';
import { useSos } from '@/components/beti/useSos';
import type { Overview } from '@/lib/account';
import { api } from '@/lib/client/api';
import { saveOfflineInfo } from '@/lib/client/offline';

export default function HomePage() {
  const { t } = useT();
  const router = useRouter();
  const sos = useSos();
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    (async () => {
      const res = await api<Overview>('/api/me');
      if (!res.ok || !res.data) return; // offline: the big buttons still work
      const o = res.data;
      if (!o.profile?.hasPin) {
        router.replace('/app/setup');
        return;
      }
      if (o.openTrip) {
        router.replace(`/app/trip/${o.openTrip.id}`);
        return;
      }
      saveOfflineInfo({ name: o.profile.name, phones: o.contacts.flatMap((c) => (c.phone ? [c.phone] : [])) });
      setOverview(o);
    })();
  }, [router]);

  const ready = overview?.contacts.filter((c) => c.status === 'connected').length ?? 0;
  const broken = overview?.contacts.filter((c) => c.status === 'blocked').length ?? 0;

  return (
    <main className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">🛡️ {t('appName')}</h1>
        <Link href="/app/settings" aria-label={t('settings')} className="text-3xl">⚙️</Link>
      </header>

      {sos.state.phase !== 'idle' ? (
        <SosPanel state={sos.state} onClose={sos.reset} />
      ) : (
        <>
          <BigButton icon="🚗" label={t('startTrip')} tone="go" audio="home-start" href="/app/trip/new" />
          <BigButton icon="🔴" label={t('help')} tone="danger" audio="home-sos" onClick={sos.trigger} />
          {overview && (
            <p className="text-center text-lg text-slate-200">
              👨‍👩‍👧 {ready} {t('contactsReady')}
              {broken > 0 && <span className="block text-amber-400">⚠️ {broken} {t('contactBroken')}</span>}
            </p>
          )}
        </>
      )}
    </main>
  );
}
