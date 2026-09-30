'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LiveMap } from '@/components/beti/LiveMap';
import { useT } from '@/components/beti/Shell';
import { api } from '@/lib/client/api';
import type { LiveView } from '@/lib/trips';

const BADGE = {
  active: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40',
  alerted: 'bg-red-600/30 text-red-100 border-red-400/60 animate-pulse',
  safe: 'bg-emerald-600/25 text-emerald-100 border-emerald-400/50',
} as const;

export default function LivePage() {
  const { token } = useParams<{ token: string }>();
  const { t, lang } = useT();
  const [view, setView] = useState<LiveView | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await api<LiveView>(`/api/t/${token}`);
      if (res.status === 404) setExpired(true);
      else if (res.ok && res.data) setView(res.data);
    };
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [token]);

  if (expired) return <p className="pt-16 text-center text-2xl font-bold text-slate-300">⌛ {t('linkExpired')}</p>;
  if (!view) return <p className="pt-16 text-center text-slate-300">{t('loading')}</p>;

  const statusKey = view.status === 'alerted' ? 'statusAlerted' : view.status === 'safe' ? 'statusSafe' : 'statusActive';
  const seen = view.last
    ? new Date(view.last.recordedAt).toLocaleTimeString(lang === 'ur' ? 'ur-PK' : 'en-PK', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-white">📍 {t('liveTitle')} — {view.name}</h1>
      <span className={`self-start rounded-full border px-4 py-1 text-lg font-bold ${BADGE[view.status]}`}>{t(statusKey)}</span>
      {view.last ? (
        <>
          <LiveMap lat={view.last.lat} lng={view.last.lng} />
          <p className="text-slate-300">🕐 {t('lastSeen')}: {seen}</p>
          <a
            href={`https://maps.google.com/?q=${view.last.lat},${view.last.lng}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-3xl bg-white/10 text-white text-xl font-bold py-4 text-center"
          >
            🗺️ {t('openMaps')}
          </a>
        </>
      ) : (
        <p className="text-amber-300 text-lg">📍 {t('gpsOff')}</p>
      )}
      <a href="tel:15" className="rounded-3xl bg-red-600 text-white text-2xl font-bold py-5 text-center">📞 {t('call15')}</a>
    </main>
  );
}
