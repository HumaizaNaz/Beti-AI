'use client';

import { useEffect, useState } from 'react';
import { playAudio } from '@/lib/audio';
import { helpSmsBody, loadOfflineInfo, smsLink, type OfflineInfo } from '@/lib/client/offline';
import { useT } from './Shell';
import type { SosState } from './useSos';

export function SosPanel({ state, onClose }: { state: SosState; onClose: () => void }) {
  const { t } = useT();
  const [info, setInfo] = useState<OfflineInfo | null>(null);

  useEffect(() => {
    setInfo(loadOfflineInfo());
  }, []);
  useEffect(() => {
    if (state.phase === 'offline') playAudio('net-off');
  }, [state.phase]);

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-red-950/60 border border-red-500/40 p-5 text-center">
      {state.phase === 'sending' && <p className="text-2xl font-bold text-white animate-pulse">📡 {t('sending')}</p>}
      {state.phase === 'sent' && <p className="text-2xl font-bold text-emerald-300">✅ {t('alertSent')} ({state.sent})</p>}
      {state.phase === 'failed' && <p className="text-2xl font-bold text-red-300">❌ {t('alertFailed')}</p>}
      {state.phase === 'offline' && (
        <>
          <p className="text-2xl font-bold text-amber-300">📵 {t('noNet')}</p>
          {info && info.phones.length > 0 && (
            <a
              href={smsLink(info.phones, helpSmsBody(info.name, state.lat, state.lng))}
              className="rounded-3xl bg-amber-500 text-black text-2xl font-bold py-5"
            >
              💬 {t('sendSms')}
            </a>
          )}
        </>
      )}
      <a href="tel:15" className="rounded-3xl bg-red-600 text-white text-2xl font-bold py-5">📞 {t('call15')}</a>
      {state.phase !== 'sending' && (
        <button type="button" onClick={onClose} className="text-slate-300 underline">{t('back')}</button>
      )}
    </div>
  );
}
